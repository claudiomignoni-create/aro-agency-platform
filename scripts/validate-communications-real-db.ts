import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const databaseUrl = process.env.ARO_TEST_DATABASE_URL;
const confirmation = process.env.ARO_TEST_DATABASE_CONFIRM;
const allowedHosts = (process.env.ARO_TEST_DATABASE_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

if (!databaseUrl) {
  throw new Error("Set ARO_TEST_DATABASE_URL to a disposable Supabase database.");
}
const safeDatabaseUrl = databaseUrl;

if (confirmation !== "DISPOSABLE") {
  throw new Error("Set ARO_TEST_DATABASE_CONFIRM=DISPOSABLE after confirming the database can be destroyed.");
}

const parsedUrl = new URL(safeDatabaseUrl);
const databaseHost = parsedUrl.hostname.toLowerCase();
const knownProductionRef = "vsevxuxinfqpwtpykhon";

if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol)) {
  throw new Error("ARO_TEST_DATABASE_URL must use PostgreSQL.");
}

if (
  safeDatabaseUrl.includes(knownProductionRef) ||
  parsedUrl.username.includes(knownProductionRef) ||
  databaseHost.includes(knownProductionRef)
) {
  throw new Error("Refusing to run against the known ARO production Supabase project.");
}

if (!allowedHosts.length || !allowedHosts.includes(databaseHost)) {
  throw new Error("Database host is not explicitly listed in ARO_TEST_DATABASE_ALLOWED_HOSTS.");
}

function redactedOutput(value: string) {
  let result = value.replaceAll(safeDatabaseUrl, "[redacted-database-url]");
  if (parsedUrl.password) {
    result = result.replaceAll(parsedUrl.password, "[redacted-password]");
    try {
      result = result.replaceAll(decodeURIComponent(parsedUrl.password), "[redacted-password]");
    } catch {
      // URL parsing already validated the connection string.
    }
  }
  return result;
}

function psqlArgs(args: string[]) {
  return ["--set", "ON_ERROR_STOP=1", safeDatabaseUrl, ...args];
}

function runPsql(args: string[]) {
  const result = spawnSync("psql", psqlArgs(args), {
    encoding: "utf8",
    stdio: "pipe"
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(redactedOutput(result.stdout));
    process.stderr.write(redactedOutput(result.stderr));
    throw new Error(`psql failed: ${args.join(" ")}`);
  }

  return result.stdout.trim();
}

function runPsqlExpectFailure(args: string[]) {
  const result = spawnSync("psql", psqlArgs(args), {
    encoding: "utf8",
    stdio: "pipe"
  });

  if (result.error) throw result.error;
  if (result.status === 0) {
    throw new Error(`psql unexpectedly succeeded: ${args.join(" ")}`);
  }
}

function runPsqlAsync(args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn("psql", psqlArgs(args), { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (status: number | null) => {
      if (status === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error(redactedOutput(stderr || stdout || `psql exited with status ${status}`)));
    });
  });
}

const supabaseCompatibility = runPsql([
  "--tuples-only",
  "--no-align",
  "--command",
  "select (to_regclass('auth.users') is not null and to_regclass('storage.objects') is not null)::text;"
]);

if (supabaseCompatibility !== "true") {
  throw new Error("A generic PostgreSQL database is insufficient. Use Supabase local or a disposable Supabase staging project.");
}

const existingState = runPsql([
  "--tuples-only",
  "--no-align",
  "--command",
  `select concat_ws(
    '|',
    (select count(*) from pg_tables where schemaname = 'public'),
    (select count(*) from auth.users),
    (select count(*) from storage.objects)
  );`
]);

if (existingState !== "0|0|0") {
  throw new Error("Disposable database is not empty. Refusing to apply migrations or alter existing data.");
}

const migrations = readdirSync("supabase/migrations")
  .filter((file) => /^\d{3}_.+\.sql$/.test(file))
  .sort();

if (migrations.length !== 25 || !migrations[0]?.startsWith("001_") || !migrations[24]?.startsWith("025_")) {
  throw new Error("Expected the complete migration sequence 001-025.");
}

for (const migration of migrations) {
  console.log(`Applying ${migration}`);
  runPsql(["--file", join("supabase/migrations", migration)]);
}

const tempDir = mkdtempSync(join(tmpdir(), "aro-communications-db-"));
const assertionFile = join(tempDir, "communications-behavior.sql");

writeFileSync(
  assertionFile,
  `
insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'model-a@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'model-b@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles (id, role, full_name)
values
  ('00000000-0000-0000-0000-000000000001', 'admin', 'Test Admin'),
  ('00000000-0000-0000-0000-000000000002', 'model', 'Model A'),
  ('00000000-0000-0000-0000-000000000003', 'model', 'Model B');

insert into public.models (id, user_id, display_name, status, is_published, location)
values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000002', 'Model A', 'approved', true, 'Original A'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000003', 'Model B', 'approved', true, 'Original B');

insert into public.model_update_requests (
  id,
  model_id,
  title,
  status,
  public_token_hash,
  verification_required,
  expires_at
)
values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 'Update A', 'started', repeat('a', 64), true, now() + interval '1 day'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000102', 'Update B', 'started', repeat('b', 64), false, now() + interval '1 day');

insert into public.model_update_request_fields (
  request_id,
  field_key,
  field_group,
  is_sensitive,
  allow_auto_apply,
  position
)
values
  ('00000000-0000-0000-0000-000000000201', 'location', 'profile', false, true, 1),
  ('00000000-0000-0000-0000-000000000201', 'banking', 'sensitive', true, false, 2),
  ('00000000-0000-0000-0000-000000000202', 'location', 'profile', false, true, 1);

insert into public.model_update_submissions (
  id,
  request_id,
  model_id,
  status,
  draft_payload
)
values (
  '00000000-0000-0000-0000-000000000211',
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000101',
  'draft',
  '{"location":"Safe City","banking":"private bank value"}'::jsonb
);

do $$
declare
  payload jsonb;
begin
  payload := public.get_public_model_update_request_by_token(repeat('a', 64));
  if payload->'draft_payload'->>'location' <> 'Safe City' then
    raise exception 'safe draft value was not returned';
  end if;
  if payload->'draft_payload' ? 'banking' then
    raise exception 'sensitive draft value was returned';
  end if;

  begin
    perform public.sanitize_model_update_payload(
      '00000000-0000-0000-0000-000000000201',
      '{"unknown":"value"}'::jsonb,
      false
    );
    raise exception 'unknown payload unexpectedly accepted';
  exception
    when others then
      if sqlerrm = 'unknown payload unexpectedly accepted' or sqlerrm not like '%field_not_requested%' then
        raise;
      end if;
  end;

  begin
    perform public.submit_model_update_request(
      repeat('a', 64),
      '{"location":"Safe City","banking":"private bank value"}'::jsonb
    );
    raise exception 'sensitive payload unexpectedly accepted without OTP';
  exception
    when others then
      if sqlerrm = 'sensitive payload unexpectedly accepted without OTP'
        or sqlerrm not like '%sensitive_field_requires_verification%'
      then
        raise;
      end if;
  end;
end $$;

insert into public.model_update_verification_codes (
  id,
  request_id,
  model_id,
  code_hash,
  expires_at
)
values (
  '00000000-0000-0000-0000-000000000221',
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000101',
  repeat('c', 64),
  now() + interval '10 minutes'
);

do $$
declare
  attempt integer;
begin
  for attempt in 1..5 loop
    if public.verify_model_update_code(repeat('a', 64), repeat('d', 64)) then
      raise exception 'wrong OTP was accepted';
    end if;
  end loop;

  if (select attempt_count from public.model_update_verification_codes where id = '00000000-0000-0000-0000-000000000221') <> 5 then
    raise exception 'wrong OTP attempts were not incremented';
  end if;

  if public.verify_model_update_code(repeat('a', 64), repeat('c', 64)) then
    raise exception 'sixth OTP attempt was not blocked';
  end if;
end $$;

insert into public.model_update_verification_codes (
  id,
  request_id,
  model_id,
  code_hash,
  expires_at
)
values (
  '00000000-0000-0000-0000-000000000222',
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000101',
  repeat('e', 64),
  now() + interval '10 minutes'
);

do $$
declare
  payload jsonb;
begin
  if not public.verify_model_update_code(repeat('a', 64), repeat('e', 64)) then
    raise exception 'correct OTP was rejected';
  end if;

  if not public.submit_model_update_request(
    repeat('a', 64),
    '{"location":"Safe City","banking":"private bank value"}'::jsonb
  ) then
    raise exception 'verified submission failed';
  end if;

  payload := public.get_public_model_update_request_by_token(repeat('a', 64));
  if payload->'draft_payload' is distinct from 'null'::jsonb then
    raise exception 'submitted draft payload remained public';
  end if;

  if not exists (
    select 1
    from public.model_update_submissions
    where request_id = '00000000-0000-0000-0000-000000000201'
      and submitted_payload->>'banking' = 'private bank value'
  ) then
    raise exception 'private admin submission payload was not preserved';
  end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', false);

do $$
begin
  if public.get_my_model_update_request('00000000-0000-0000-0000-000000000202') is not null then
    raise exception 'model A accessed model B request';
  end if;
  if public.get_my_model_update_request('00000000-0000-0000-0000-000000000201') is null then
    raise exception 'model A could not access own request';
  end if;
end $$;

reset role;

insert into public.presentations (
  id,
  title,
  status,
  public_token_hash,
  snapshot,
  version_number,
  published_at,
  expires_at
)
values
  (
    '00000000-0000-0000-0000-000000000301',
    'Valid presentation',
    'published',
    repeat('f', 64),
    '{"models":[]}'::jsonb,
    1,
    now(),
    now() + interval '1 day'
  ),
  (
    '00000000-0000-0000-0000-000000000302',
    'Expired presentation',
    'published',
    repeat('0', 64),
    '{"models":[]}'::jsonb,
    1,
    now() - interval '2 days',
    now() - interval '1 day'
  );

insert into public.presentation_versions (id, presentation_id, version_number, snapshot)
values (
  '00000000-0000-0000-0000-000000000311',
  '00000000-0000-0000-0000-000000000301',
  1,
  '{"models":[]}'::jsonb
);

insert into public.presentation_share_links (
  id,
  presentation_id,
  presentation_version_id,
  public_token_hash,
  expires_at,
  revoked_at
)
values
  ('00000000-0000-0000-0000-000000000321', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000311', repeat('1', 64), now() + interval '1 day', null),
  ('00000000-0000-0000-0000-000000000322', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000311', repeat('2', 64), now() + interval '1 day', null),
  ('00000000-0000-0000-0000-000000000323', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000311', repeat('3', 64), now() + interval '1 day', now()),
  ('00000000-0000-0000-0000-000000000324', '00000000-0000-0000-0000-000000000302', null, repeat('4', 64), now() - interval '1 day', null);

do $$
begin
  if public.get_public_presentation_by_token(repeat('1', 64)) is null
    or public.get_public_presentation_by_token(repeat('2', 64)) is null
  then
    raise exception 'previous valid share links stopped working';
  end if;
  if public.get_public_presentation_by_token(repeat('3', 64)) is not null then
    raise exception 'revoked share link remained valid';
  end if;
  if public.get_public_presentation_by_token(repeat('4', 64)) is not null then
    raise exception 'expired presentation remained valid';
  end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

do $$
begin
  if not exists (
    select 1
    from public.model_update_submissions
    where request_id = '00000000-0000-0000-0000-000000000201'
      and submitted_payload->>'banking' = 'private bank value'
  ) then
    raise exception 'admin could not access private submitted payload';
  end if;
end $$;

select public.create_presentation_delivery(
  '00000000-0000-0000-0000-000000000301',
  'Recipient',
  'recipient@example.test',
  'system_draft',
  'Subject',
  '<p>Body</p>',
  'Body',
  repeat('5', 64),
  'request-nonce-0000000001',
  null,
  null,
  null
);

select public.create_presentation_delivery(
  '00000000-0000-0000-0000-000000000301',
  'Recipient',
  'recipient@example.test',
  'system_draft',
  'Subject changed on duplicate',
  '<p>Changed</p>',
  'Changed',
  repeat('5', 64),
  'request-nonce-0000000001',
  null,
  null,
  null
);

reset role;

do $$
begin
  if (select count(*) from public.presentation_recipients where presentation_id = '00000000-0000-0000-0000-000000000301' and recipient_email = 'recipient@example.test') <> 1 then
    raise exception 'idempotency created duplicate recipients';
  end if;
  if (select count(*) from public.presentation_share_links where presentation_id = '00000000-0000-0000-0000-000000000301' and public_token_hash = repeat('5', 64)) <> 1 then
    raise exception 'idempotency created duplicate share links';
  end if;
  if (select count(*) from public.outbound_emails where presentation_id = '00000000-0000-0000-0000-000000000301' and recipient_email = 'recipient@example.test') <> 1 then
    raise exception 'idempotency created duplicate outbound emails';
  end if;

  if has_function_privilege('anon', 'public.get_public_presentation_by_token(text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.get_public_model_update_request_by_token(text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.check_communication_rate_limit(text,text,text)', 'EXECUTE')
  then
    raise exception 'anon retained access to a server-only RPC';
  end if;

  if not has_function_privilege('service_role', 'public.claim_outbound_emails(integer)', 'EXECUTE') then
    raise exception 'service_role cannot claim outbound emails';
  end if;

  begin
    perform public.check_communication_rate_limit(repeat('a', 64), repeat('b', 64), 'unknown_operation');
    raise exception 'unknown rate limit operation was accepted';
  exception
    when others then
      if sqlerrm = 'unknown rate limit operation was accepted'
        or sqlerrm not like '%unsupported_rate_limit_operation%'
      then
        raise;
      end if;
  end;
end $$;

insert into public.model_update_submissions (
  id,
  request_id,
  model_id,
  status,
  draft_payload,
  submitted_payload,
  submitted_at
)
values (
  '00000000-0000-0000-0000-000000000212',
  '00000000-0000-0000-0000-000000000202',
  '00000000-0000-0000-0000-000000000102',
  'submitted',
  '{"location":"Changed B"}'::jsonb,
  '{"location":"Changed B"}'::jsonb,
  now()
);

update public.model_update_requests
set status = 'submitted', submitted_at = now()
where id = '00000000-0000-0000-0000-000000000202';

insert into public.model_update_files (
  id,
  submission_id,
  media_type,
  bucket,
  object_path,
  original_name,
  mime_type,
  size_bytes,
  status
)
values (
  '00000000-0000-0000-0000-000000000231',
  '00000000-0000-0000-0000-000000000212',
  'invalid_media_type',
  'model-portfolio',
  'models/test/invalid.bin',
  'invalid.bin',
  'application/octet-stream',
  1,
  'pending_review'
);

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

do $$
begin
  begin
    perform public.apply_model_update_submission(
      '00000000-0000-0000-0000-000000000202',
      array['location'],
      array['00000000-0000-0000-0000-000000000231']::uuid[]
    );
    raise exception 'apply unexpectedly succeeded';
  exception
    when others then
      if sqlerrm = 'apply unexpectedly succeeded' then
        raise;
      end if;
  end;
end $$;

reset role;

do $$
begin
  if (select location from public.models where id = '00000000-0000-0000-0000-000000000102') <> 'Original B' then
    raise exception 'model update did not roll back';
  end if;
  if (select status from public.model_update_requests where id = '00000000-0000-0000-0000-000000000202') <> 'submitted' then
    raise exception 'request status did not roll back';
  end if;
  if (select status from public.model_update_files where id = '00000000-0000-0000-0000-000000000231') <> 'pending_review' then
    raise exception 'file status did not roll back';
  end if;
end $$;

insert into public.outbound_emails (
  id,
  recipient_email,
  subject,
  body_html,
  body_text,
  status,
  mode,
  idempotency_key
)
values
  ('00000000-0000-0000-0000-000000000401', 'worker-one@example.test', 'Queue 1', '<p>Queue 1</p>', 'Queue 1', 'queued', 'send_now', 'worker-queue-one'),
  ('00000000-0000-0000-0000-000000000402', 'worker-two@example.test', 'Queue 2', '<p>Queue 2</p>', 'Queue 2', 'queued', 'send_now', 'worker-queue-two');
`
);

runPsql(["--file", assertionFile]);

runPsqlExpectFailure([
  "--command",
  "set role anon; select public.get_public_presentation_by_token(repeat('1', 64));"
]);

const workerCommand = "set role service_role; select id from public.claim_outbound_emails(1);";
const workerResults = await Promise.all([
  runPsqlAsync(["--tuples-only", "--no-align", "--command", workerCommand]),
  runPsqlAsync(["--tuples-only", "--no-align", "--command", workerCommand])
]);
const claimedIds = workerResults.flatMap((result) =>
  result.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? []
);

if (claimedIds.length !== 2 || new Set(claimedIds).size !== 2) {
  throw new Error("Concurrent workers did not claim two distinct outbound emails.");
}

runPsql([
  "--command",
  `do $$
  begin
    if (select count(*) from public.outbound_emails where id in ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000402') and status = 'processing') <> 2 then
      raise exception 'worker claims were not committed';
    end if;
  end $$;`
]);

console.log("Disposable Supabase behavioral validation completed.");
