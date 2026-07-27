import { readdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const databaseUrl = process.env.ARO_TEST_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Set ARO_TEST_DATABASE_URL to a disposable PostgreSQL or local Supabase database.");
}

if (databaseUrl.includes("vsevxuxinfqpwtpykhon")) {
  throw new Error("Refusing to run against the known ARO production Supabase project.");
}

const safeDatabaseUrl = databaseUrl;

function runPsql(args: string[]) {
  const result = spawnSync("psql", ["--set", "ON_ERROR_STOP=1", safeDatabaseUrl, ...args], {
    encoding: "utf8",
    stdio: "pipe"
  });

  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`psql failed: ${args.join(" ")}`);
  }

  return result.stdout;
}

const migrations = readdirSync("supabase/migrations")
  .filter((file) => file.endsWith(".sql"))
  .sort();

for (const migration of migrations) {
  console.log(`Applying ${migration}`);
  runPsql(["--file", join("supabase/migrations", migration)]);
}

const tempDir = mkdtempSync(join(tmpdir(), "aro-communications-db-"));
const assertionFile = join(tempDir, "communications-assertions.sql");

writeFileSync(
  assertionFile,
  `
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'verify_model_update_code') then
    raise exception 'verify_model_update_code missing';
  end if;

  if not exists (select 1 from pg_proc where proname = 'apply_model_update_submission') then
    raise exception 'apply_model_update_submission missing';
  end if;

  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'presentation_share_links') then
    raise exception 'presentation_share_links missing';
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') and
     not has_function_privilege('service_role', 'public.claim_outbound_emails(integer)', 'EXECUTE') then
    raise exception 'service_role cannot execute claim_outbound_emails';
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'model_update_files'
      and constraint_name = 'model_update_files_status_check'
  ) then
    raise exception 'model_update_files_status_check missing';
  end if;
end $$;
`
);

runPsql(["--file", assertionFile]);
console.log("Disposable database validation completed.");
