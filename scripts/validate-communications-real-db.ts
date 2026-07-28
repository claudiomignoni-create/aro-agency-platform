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

if (migrations.length !== 26 || !migrations[0]?.startsWith("001_") || !migrations[25]?.startsWith("026_")) {
  throw new Error("Expected the complete migration sequence 001-026.");
}

const tempDir = mkdtempSync(join(tmpdir(), "aro-communications-db-"));
const upgradeFixtureFile = join(tempDir, "presentation-upgrade-fixture.sql");
const upgradeAssertionFile = join(tempDir, "presentation-upgrade-assertions.sql");

for (const migration of migrations.slice(0, -1)) {
  console.log(`Applying ${migration}`);
  runPsql(["--file", join("supabase/migrations", migration)]);
}

writeFileSync(
  upgradeFixtureFile,
  `
insert into public.presentations (
  id,
  title,
  description,
  status,
  public_token_hash,
  snapshot,
  version_number,
  published_at,
  expires_at
)
values (
  '00000000-0000-0000-0000-000000000901',
  'Existing presentation before migration 026',
  'Upgrade-safe presentation',
  'sent',
  repeat('8', 64),
  '{
    "title":"Existing presentation before migration 026",
    "models":[{
      "display_name":"Snapshot Model",
      "public_model_key":"legacyModelKey",
      "measurements":{"height_cm":180},
      "media":[]
    }]
  }'::jsonb,
  1,
  now(),
  now() + interval '7 days'
);

insert into public.presentation_versions (
  id,
  presentation_id,
  version_number,
  snapshot
)
select
  '00000000-0000-0000-0000-000000000902',
  id,
  1,
  snapshot
from public.presentations
where id = '00000000-0000-0000-0000-000000000901';

insert into public.presentation_recipients (
  id,
  presentation_id,
  recipient_name,
  recipient_email,
  sent_at
)
values (
  '00000000-0000-0000-0000-000000000903',
  '00000000-0000-0000-0000-000000000901',
  'Upgrade Client',
  'upgrade-client@example.test',
  now()
);

insert into public.presentation_share_links (
  id,
  presentation_id,
  presentation_version_id,
  recipient_id,
  public_token_hash,
  expires_at
)
values (
  '00000000-0000-0000-0000-000000000904',
  '00000000-0000-0000-0000-000000000901',
  '00000000-0000-0000-0000-000000000902',
  '00000000-0000-0000-0000-000000000903',
  repeat('9', 64),
  now() + interval '7 days'
);
`
);

runPsql(["--file", upgradeFixtureFile]);

const selectionMigration = migrations.at(-1);
if (!selectionMigration) throw new Error("Missing migration 026.");
console.log(`Applying ${selectionMigration}`);
runPsql(["--file", join("supabase/migrations", selectionMigration)]);

writeFileSync(
  upgradeAssertionFile,
  `
do $$
declare
  first_submission jsonb;
  payload jsonb;
  second_submission jsonb;
  state_payload jsonb;
begin
  payload := public.get_public_presentation_by_token(repeat('9', 64));
  if payload is null
    or payload->>'title' <> 'Existing presentation before migration 026'
    or payload->'snapshot'->'models'->0->>'display_name' <> 'Snapshot Model'
  then
    raise exception 'migration 026 broke an existing presentation link or snapshot';
  end if;

  state_payload := public.get_public_presentation_link_state(repeat('9', 64));
  if state_payload->>'state' <> 'active'
    or state_payload->>'recipient_name' <> 'Upgrade Client'
  then
    raise exception 'existing presentation state was not preserved during upgrade';
  end if;

  perform public.save_public_presentation_model_decision(
    repeat('9', 64),
    'legacyModelKey',
    'yes'
  );
  perform public.save_public_presentation_model_decision(
    repeat('9', 64),
    'legacyModelKey',
    'maybe'
  );

  if (
    select count(*)
    from public.presentation_model_selections
    where presentation_id = '00000000-0000-0000-0000-000000000901'
      and public_model_key = 'legacyModelKey'
  ) <> 1 then
    raise exception 'decision update created a duplicate selection';
  end if;

  if (
    select decision
    from public.presentation_model_selections
    where presentation_id = '00000000-0000-0000-0000-000000000901'
      and public_model_key = 'legacyModelKey'
  ) <> 'maybe' then
    raise exception 'decision update did not persist the latest value';
  end if;

  begin
    perform public.save_public_presentation_model_decision(
      repeat('9', 64),
      'outsideSnapshotKey',
      'yes'
    );
    raise exception 'model outside the immutable snapshot was accepted';
  exception
    when others then
      if sqlerrm = 'model outside the immutable snapshot was accepted'
        or sqlerrm not like '%model_not_in_presentation_snapshot%'
      then
        raise;
      end if;
  end;

  first_submission := public.submit_public_presentation_selection(
    repeat('9', 64),
    'Structured client note'
  );
  second_submission := public.submit_public_presentation_selection(
    repeat('9', 64),
    'Structured client note'
  );

  if first_submission->>'submitted_at' <> second_submission->>'submitted_at' then
    raise exception 'double submission was not idempotent';
  end if;

  if (
    select count(*)
    from public.presentation_access_events
    where presentation_id = '00000000-0000-0000-0000-000000000901'
      and event_type = 'selection_submitted'
  ) <> 1 then
    raise exception 'double submission created duplicate submission events';
  end if;

  if (
    select client_note
    from public.presentation_selection_responses
    where presentation_id = '00000000-0000-0000-0000-000000000901'
  ) <> 'Structured client note' then
    raise exception 'client note was not preserved';
  end if;

  update public.presentation_share_links
  set expires_at = now() - interval '1 minute'
  where id = '00000000-0000-0000-0000-000000000904';

  if public.get_public_presentation_link_state(repeat('9', 64))->>'state' <> 'expired' then
    raise exception 'expired share link did not enter expired state';
  end if;

  begin
    perform public.save_public_presentation_model_decision(
      repeat('9', 64),
      'legacyModelKey',
      'no'
    );
    raise exception 'expired link accepted a selection change';
  exception
    when others then
      if sqlerrm = 'expired link accepted a selection change'
        or sqlerrm not like '%presentation_link_inactive%'
      then
        raise;
      end if;
  end;

  update public.presentation_share_links
  set expires_at = now() + interval '7 days',
      revoked_at = now()
  where id = '00000000-0000-0000-0000-000000000904';

  if public.get_public_presentation_link_state(repeat('9', 64))->>'state' <> 'revoked' then
    raise exception 'revoked share link did not enter revoked state';
  end if;

  update public.presentation_share_links
  set revoked_at = null
  where id = '00000000-0000-0000-0000-000000000904';

  update public.presentations
  set status = 'draft'
  where id = '00000000-0000-0000-0000-000000000901';

  if public.get_public_presentation_link_state(repeat('9', 64))->>'state' <> 'not_published'
    or public.get_public_presentation_by_token(repeat('9', 64)) is not null
  then
    raise exception 'unpublished presentation remained publicly available';
  end if;

  update public.presentations
  set status = 'sent'
  where id = '00000000-0000-0000-0000-000000000901';
end $$;
`
);

runPsql(["--file", upgradeAssertionFile]);

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
    '{"models":[{"id":"00000000-0000-0000-0000-000000000101","display_name":"Model A"}]}'::jsonb,
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
  '{"models":[{"id":"00000000-0000-0000-0000-000000000101","display_name":"Model A"}]}'::jsonb
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

update public.outbound_emails
set status = 'sent',
    sent_at = now()
where presentation_id = '00000000-0000-0000-0000-000000000301'
  and recipient_email = 'recipient@example.test';

update public.presentation_recipients
set sent_at = now(),
    opened_at = now()
where presentation_id = '00000000-0000-0000-0000-000000000301'
  and recipient_email = 'recipient@example.test';

insert into public.presentation_access_events (
  presentation_id,
  event_type,
  metadata
)
select
  '00000000-0000-0000-0000-000000000301',
  'opened',
  jsonb_build_object('share_link_id', sl.id::text)
from public.presentation_share_links sl
where sl.public_token_hash = repeat('5', 64);

do $$
declare
  dashboard jsonb;
begin
  dashboard := public.get_email_center_dashboard(now() - interval '1 day', now() + interval '1 day');

  if (dashboard->'metrics'->'emails_sent'->>'current')::integer <> 1 then
    raise exception 'email center sent metric is incorrect';
  end if;
  if (dashboard->'metrics'->'models_presented'->>'current')::integer <> 1 then
    raise exception 'email center distinct model metric is incorrect';
  end if;
  if (dashboard->'metrics'->'presentations_sent'->>'current')::integer <> 1 then
    raise exception 'email center presentation metric is incorrect';
  end if;
  if (dashboard->'metrics'->'responses'->>'available')::boolean then
    raise exception 'email center invented response synchronization';
  end if;
  if dashboard->'featured'->>'subject' <> 'Subject' then
    raise exception 'email center featured delivery is incorrect';
  end if;
  if jsonb_array_length(dashboard->'top_models') <> 1 then
    raise exception 'email center model ranking is incorrect';
  end if;
  if dashboard::text like '%private bank value%' then
    raise exception 'email center exposed a sensitive submission value';
  end if;
end $$;

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
    or has_function_privilege('anon', 'public.get_email_center_dashboard(timestamptz,timestamptz)', 'EXECUTE')
    or has_function_privilege('anon', 'public.save_public_presentation_model_decision(text,text,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.submit_public_presentation_selection(text,text)', 'EXECUTE')
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

runPsqlExpectFailure([
  "--command",
  "set role anon; select * from public.presentation_model_selections;"
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
