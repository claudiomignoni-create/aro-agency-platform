import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createPkcePair,
  deterministicToken,
  randomToken,
  sha256,
  signOAuthState,
  verifyOAuthState
} from "../src/lib/communications/security";
import {
  aroGoogleEmail,
  googleMailboxScope,
  googleScopes,
  hasGoogleMailboxScope
} from "../src/lib/communications/google-workspace";

test("secure public tokens are random and stored by hash", () => {
  const first = randomToken();
  const second = randomToken();

  assert.notEqual(first, second);
  assert.equal(sha256(first).length, 64);
  assert.notEqual(sha256(first), first);
});

test("presentation delivery tokens are deterministic without exposing their input", () => {
  process.env.EMAIL_TOKEN_ENCRYPTION_KEY = "test-secret-for-delivery";
  const first = deterministicToken("presentation-delivery", "presentation|recipient|nonce");
  const second = deterministicToken("presentation-delivery", "presentation|recipient|nonce");

  assert.equal(first, second);
  assert.notEqual(first, "presentation|recipient|nonce");
  assert.ok(first.length >= 40);
});

test("OAuth state is signed and rejects tampering", () => {
  process.env.EMAIL_TOKEN_ENCRYPTION_KEY = "test-secret-for-state";
  const state = signOAuthState({ profileId: "profile-1" });
  const payload = verifyOAuthState<{ profileId: string }>(state);

  assert.equal(payload.profileId, "profile-1");
  assert.throws(() => verifyOAuthState(`${state}tampered`));
});

test("PKCE pair uses S256-compatible values", () => {
  const pair = createPkcePair();

  assert.ok(pair.verifier.length > 40);
  assert.ok(pair.challenge.length > 40);
  assert.notEqual(pair.verifier, pair.challenge);
});

test("Google Workspace integration uses gmail.modify without full mailbox deletion scope", () => {
  assert.equal(aroGoogleEmail, "claudio@arolab.co");
  assert.ok(googleScopes.includes(googleMailboxScope));
  assert.equal(
    googleScopes.includes("https://www.googleapis.com/auth/gmail.compose" as never),
    false
  );
  assert.equal(googleScopes.includes("https://mail.google.com/" as never), false);
  assert.equal(hasGoogleMailboxScope([...googleScopes]), true);
  assert.equal(
    hasGoogleMailboxScope(["https://www.googleapis.com/auth/gmail.compose"]),
    false
  );
});

test("communication migration creates token hashes, queue states and RLS", async () => {
  const sql = await readFile("supabase/migrations/025_email_presentations_model_portal.sql", "utf8");
  const digestCalls = Array.from(sql.matchAll(/(?:([a-z_]+)\.)?digest\s*\(/gi));

  assert.match(sql, /google_workspace_connections/);
  assert.match(sql, /outbound_emails/);
  assert.match(sql, /model_update_requests/);
  assert.match(sql, /presentations/);
  assert.match(sql, /public_token_hash text not null unique/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /retry_pending/);
  assert.doesNotMatch(sql, /DROP TABLE/i);
  assert.doesNotMatch(sql, /DROP TYPE/i);
  assert.doesNotMatch(sql, /TRUNCATE/i);
  assert.equal(digestCalls.length, 2);
  assert.equal(digestCalls.every((match) => match[1] === "extensions"), true);
});

test("public presentation snapshots strip private media paths", async () => {
  const sql = await readFile("supabase/migrations/026_presentation_model_selections.sql", "utf8");
  const publicPage = await readFile("src/app/p/[token]/page.tsx", "utf8");
  const data = await readFile("src/lib/communications/data.ts", "utf8");
  const publicFunction = sql.slice(sql.indexOf("create or replace function public.get_public_presentation_by_token"));

  assert.match(publicFunction, /'media_type', media_item\.value->'media_type'/);
  assert.doesNotMatch(publicFunction, /'storage_bucket'/);
  assert.doesNotMatch(publicFunction, /'storage_path'/);
  assert.doesNotMatch(publicFunction, /'thumbnail_path'/);
  assert.match(publicFunction, /'public_media_key'/);
  assert.match(publicFunction, /order by media_item\.ordinality/);
  assert.match(data, /getPresentationPrivateMediaRefsByToken/);
  assert.match(publicPage, /signPresentationMedia\(presentation, privateRefs, token\)/);
  assert.match(publicPage, /privateRefs\[item\.public_media_key\]/);
  assert.doesNotMatch(publicPage, /privateRefs\[modelIndex\]/);
});

test("public presentation access uses server-only security definer RPCs", async () => {
  const sql = await readFile("supabase/migrations/026_presentation_model_selections.sql", "utf8");
  const publicPage = await readFile("src/app/p/[token]/page.tsx", "utf8");
  const data = await readFile("src/lib/communications/data.ts", "utf8");

  assert.match(sql, /security definer/);
  assert.match(sql, /set search_path = public/);
  assert.match(sql, /get_public_presentation_by_token/);
  assert.match(sql, /presentation_share_links/);
  assert.match(sql, /status in \('published', 'sent'\)/);
  assert.match(sql, /expires_at is null or p\.expires_at > now\(\)/);
  assert.match(sql, /grant execute on function public\.get_public_presentation_by_token\(text\) to service_role/);
  assert.doesNotMatch(sql, /grant execute on function public\.get_public_presentation_by_token\(text\) to anon/);
  assert.doesNotMatch(publicPage, /\.from\("presentations"\)/);
  assert.match(data, /const supabase = createAdminClient\(\)/);
  assert.match(data, /\.rpc\("get_public_presentation_by_token"/);
});

test("public model update access returns only safe drafts and stops after submission", async () => {
  const sql = await readFile("supabase/migrations/025_email_presentations_model_portal.sql", "utf8");
  const updatePage = await readFile("src/app/update/[token]/page.tsx", "utf8");
  const data = await readFile("src/lib/communications/data.ts", "utf8");

  assert.match(sql, /get_public_model_update_request_by_token/);
  assert.match(sql, /save_model_update_request_draft/);
  assert.match(sql, /submit_model_update_request/);
  assert.match(sql, /safe_field\.is_sensitive = false/);
  assert.match(sql, /when r\.status in \('submitted', 'review_required'\)/);
  assert.match(sql, /'banking'/);
  assert.match(sql, /'health'/);
  assert.match(sql, /'passport'/);
  assert.match(sql, /'documents'/);
  assert.match(sql, /r\.expires_at > now\(\)/);
  assert.doesNotMatch(updatePage, /\.from\("model_update_requests"\)/);
  assert.match(updatePage, /const submitted =/);
  assert.match(updatePage, /if \(!submitted\)/);
  assert.match(updatePage, /Atualização enviada/);
  assert.match(data, /\.rpc\("save_model_update_request_draft"/);
  assert.match(data, /\.rpc\("submit_model_update_request"/);
  assert.match(data, /createAdminClient\(\)/);
  assert.match(sql, /grant execute on function public\.submit_model_update_request\(text, jsonb\) to service_role/);
  assert.doesNotMatch(sql, /grant execute on function public\.submit_model_update_request\(text, jsonb\) to anon/);
});

test("all token and rate-limit RPCs are executable only by the server role", async () => {
  const sql = await readFile("supabase/migrations/025_email_presentations_model_portal.sql", "utf8");
  const serverOnlyFunctions = [
    "get_public_presentation_by_token\\(text\\)",
    "mark_public_presentation_opened\\(text\\)",
    "get_public_model_update_request_by_token\\(text\\)",
    "mark_model_update_request_opened\\(text\\)",
    "start_model_update_request\\(text\\)",
    "save_model_update_request_draft\\(text, jsonb\\)",
    "submit_model_update_request\\(text, jsonb\\)",
    "verify_model_update_code\\(text, text\\)",
    "check_communication_rate_limit\\(text, text, text\\)"
  ];

  for (const functionSignature of serverOnlyFunctions) {
    assert.match(sql, new RegExp(`grant execute on function public\\.${functionSignature} to service_role`));
    assert.doesNotMatch(sql, new RegExp(`grant execute on function public\\.${functionSignature} to (anon|authenticated)`));
  }
});

test("model portal update requests are model-owned RPCs instead of model_id filters", async () => {
  const sql = await readFile("supabase/migrations/025_email_presentations_model_portal.sql", "utf8");
  const portal = await readFile("src/lib/model-portal.ts", "utf8");

  assert.match(sql, /current_model_id\(\)/);
  assert.match(sql, /get_my_model_update_requests/);
  assert.match(sql, /where r\.model_id = model_uuid/);
  assert.match(portal, /\.rpc\("get_my_model_update_requests"\)/);
  assert.doesNotMatch(portal, /\.from\("model_update_requests"\)[^]*\.eq\("model_id"/);
});

test("model update payloads, uploads and OTP are validated and rate limited", async () => {
  const sql = await readFile("supabase/migrations/025_email_presentations_model_portal.sql", "utf8");
  const data = await readFile("src/lib/communications/data.ts", "utf8");
  const upload = await readFile("src/app/update/[token]/uploads/route.ts", "utf8");
  const otp = await readFile("src/app/update/[token]/verification-code/route.ts", "utf8");
  const form = await readFile("src/app/update/[token]/model-update-form.tsx", "utf8");

  assert.match(sql, /sanitize_model_update_payload/);
  assert.match(sql, /verify_model_update_code/);
  assert.match(sql, /attempt_count = attempt_count \+ 1/);
  assert.match(sql, /field_not_requested/);
  assert.match(sql, /sensitive_field_requires_verification/);
  assert.match(sql, /sensitive_verified boolean/);
  assert.match(sql, /consumed_at = now\(\)/);
  assert.match(sql, /communication_rate_limits/);
  assert.match(sql, /check_communication_rate_limit/);
  assert.match(sql, /unsupported_rate_limit_operation/);
  assert.match(sql, /'update_submit', 5, 300/);
  assert.match(sql, /delete from public\.communication_rate_limits/);
  assert.doesNotMatch(sql, /p_window_seconds/);
  assert.match(data, /operation: "update_start"/);
  assert.match(upload, /createSignedUploadUrl/);
  assert.match(upload, /validateStoredObject/);
  assert.match(upload, /createHash\("sha256"\)/);
  assert.match(upload, /detectFileSignature/);
  assert.match(upload, /0x1a, 0x45, 0xdf, 0xa3/);
  assert.match(upload, /maxSynchronousVideoBytes = 25/);
  assert.match(upload, /validation_error_sanitized/);
  assert.match(upload, /status: "validating"/);
  assert.match(upload, /status: "rejected"/);
  assert.match(upload, /extensions:/);
  assert.match(form, /uploadToSignedUrl/);
  assert.match(upload, /model_update_verification_codes/);
  assert.match(otp, /crypto\.randomInt\(100000, 1000000\)/);
  assert.match(otp, /\.rpc\("verify_model_update_code"/);
  assert.match(otp, /code_hash: sha256\(code\)/);
  assert.match(otp, /encrypted_payload: encryptSecret/);
  assert.match(otp, /const genericBodyText = "ARO — Código de verificação"/);
  assert.doesNotMatch(otp, /body_text: privateBodyText/);
  assert.doesNotMatch(otp, /return NextResponse\.json\([^)]*code/);
  assert.match(form, /fileSha256/);
  assert.match(form, /height_cm/);
  assert.match(form, /verification-code/);
});

test("email queue claims atomically and retries with backoff", async () => {
  const sql = await readFile("supabase/migrations/025_email_presentations_model_portal.sql", "utf8");
  const queue = await readFile("src/app/api/communications/process-email-queue/route.ts", "utf8");
  const delivery = await readFile("src/lib/communications/email-delivery-server.ts", "utf8");
  const reminders = await readFile("src/app/api/communications/process-model-update-reminders/route.ts", "utf8");

  assert.match(sql, /claim_outbound_emails/);
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /status = 'processing'/);
  assert.match(sql, /grant execute on function public\.claim_outbound_emails\(integer\) to service_role/);
  assert.match(queue, /processEmailQueue/);
  assert.match(delivery, /\.rpc\("claim_outbound_emails"/);
  assert.match(delivery, /retry_pending/);
  assert.match(delivery, /delayMinutes/);
  assert.match(delivery, /resolveEmailContent/);
  assert.match(delivery, /encrypted_payload: null/);
  assert.match(delivery, /encrypted_payload: retry \? email\.encrypted_payload : null/);
  assert.match(sql, /redact_finalized_outbound_email_payload/);
  assert.match(sql, /new\.status in \('sent', 'failed', 'canceled'\)/);
  assert.match(reminders, /onConflict: "idempotency_key"/);
  assert.match(reminders, /status: "queued"/);
  assert.doesNotMatch(reminders, /status: "sent"/);
});

test("presentation edits and publication use transactional RPCs", async () => {
  const sql = await readFile("supabase/migrations/025_email_presentations_model_portal.sql", "utf8");
  const actions = await readFile("src/app/admin/presentations/actions.ts", "utf8");

  assert.match(sql, /update_presentation_draft/);
  assert.match(sql, /publish_presentation_snapshot/);
  assert.match(sql, /for update/);
  assert.match(actions, /\.rpc\("update_presentation_draft"/);
  assert.match(actions, /\.rpc\("publish_presentation_snapshot"/);
  assert.doesNotMatch(actions, /\.from\("presentation_models"\)\.delete/);
  assert.doesNotMatch(actions, /\.from\("presentation_versions"\)\.insert/);
});

test("model update admin review is transactional", async () => {
  const sql = await readFile("supabase/migrations/025_email_presentations_model_portal.sql", "utf8");
  const actions = await readFile("src/app/admin/model-updates/actions.ts", "utf8");
  const detail = await readFile("src/app/admin/model-updates/[id]/page.tsx", "utf8");

  assert.match(sql, /apply_model_update_submission/);
  assert.match(sql, /for update/);
  assert.match(sql, /previous_snapshot/);
  assert.match(sql, /approved_file_ids/);
  assert.match(actions, /\.rpc\("apply_model_update_submission"/);
  assert.doesNotMatch(actions, /measurementsUpdate/);
  assert.match(detail, /selected_fields/);
  assert.match(detail, /approved_file_ids/);
  assert.match(detail, /submitted_payload/);
});

test("presentation emails preserve links and create deliveries transactionally", async () => {
  const sql = await readFile("supabase/migrations/025_email_presentations_model_portal.sql", "utf8");
  const actions = await readFile("src/app/admin/presentations/actions.ts", "utf8");
  const emailPage = await readFile("src/app/admin/presentations/[id]/email/page.tsx", "utf8");

  assert.match(sql, /create table if not exists public\.presentation_share_links/);
  assert.match(sql, /create_presentation_delivery/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /if found then/);
  assert.match(actions, /\.rpc\(\s*"create_presentation_delivery"/);
  assert.match(actions, /deterministicToken/);
  assert.match(actions, /request_nonce/);
  assert.match(emailPage, /name="request_nonce"/);
  assert.doesNotMatch(actions, /\.from\("presentation_recipients"\)\.insert/);
  assert.doesNotMatch(actions, /\.from\("presentation_share_links"\)\.insert/);
  assert.doesNotMatch(actions, /\.from\("outbound_emails"\)\s*\.upsert/);
  assert.doesNotMatch(actions, /\.from\("presentations"\)\s*\.update\(\{ public_token_hash: hash/);
  assert.doesNotMatch(actions, /idempotency_key: randomToken/);
});

test("production rate limit salt is mandatory and documented", async () => {
  const rateLimit = await readFile("src/lib/communications/rate-limit.ts", "utf8");
  const doc = await readFile("docs/ARO_COMMUNICATIONS_HARDENING.md", "utf8");

  assert.match(rateLimit, /NODE_ENV === "production"/);
  assert.match(rateLimit, /RATE_LIMIT_HASH_SALT is required in production/);
  assert.match(doc, /openssl rand -base64 32/);
});

test("real database validation script refuses production", async () => {
  const script = await readFile("scripts/validate-communications-real-db.ts", "utf8");

  assert.match(script, /ARO_TEST_DATABASE_URL/);
  assert.match(script, /ARO_TEST_DATABASE_CONFIRM/);
  assert.match(script, /ARO_TEST_DATABASE_ALLOWED_HOSTS/);
  assert.match(script, /DISPOSABLE/);
  assert.match(script, /vsevxuxinfqpwtpykhon/);
  assert.match(script, /auth\.users/);
  assert.match(script, /storage\.objects/);
  assert.match(script, /migrations\.length !== 26/);
  assert.match(script, /claim_outbound_emails/);
  assert.match(script, /Promise\.all/);
  assert.match(script, /model A accessed model B request/);
  assert.match(script, /set role authenticated; select \* from public\.model_update_submissions/);
  assert.match(script, /sixth OTP attempt was not blocked/);
  assert.match(script, /idempotency created duplicate outbound emails/);
  assert.match(script, /model update did not roll back/);
  assert.match(script, /presentation_share_links/);
  assert.match(script, /get_email_center_dashboard/);
  assert.match(script, /email center exposed a sensitive submission value/);
});

test("communication migration preserves upgrade compatibility and history", async () => {
  const sql = await readFile("supabase/migrations/025_email_presentations_model_portal.sql", "utf8");

  assert.match(sql, /alter table public\.model_update_requests\s+add column if not exists title/);
  assert.match(sql, /presentation_recipients_outbound_email_fk/);
  assert.match(sql, /outbound_emails_model_update_request_fk/);
  assert.match(sql, /on delete set null/);
  assert.match(sql, /model_update_audit_events/);
  assert.match(sql, /set_model_update_submissions_updated_at/);
  assert.match(sql, /model_update_reminders_status_remind_at_idx/);
});

test("Google refresh flow preserves refresh token and safe send mode", async () => {
  const callback = await readFile("src/app/api/integrations/google/callback/route.ts", "utf8");
  const googleServer = await readFile("src/lib/communications/google-server.ts", "utf8");
  const queue = await readFile("src/app/api/communications/process-email-queue/route.ts", "utf8");
  const delivery = await readFile("src/lib/communications/email-delivery-server.ts", "utf8");

  assert.match(callback, /existingConnection\?\.encrypted_refresh_token/);
  assert.match(callback, /revokeGoogleToken\(token\.access_token\)/);
  assert.match(googleServer, /shouldRefreshGoogleToken/);
  assert.match(googleServer, /invalid_grant/i);
  assert.match(googleServer, /EMAIL_EXTERNAL_SEND_ENABLED/);
  assert.match(queue, /COMMUNICATIONS_CRON_SECRET/);
  assert.match(delivery, /retry_pending/);
});

test("Google OAuth redirect carries state and PKCE cookies on its response", async () => {
  const connect = await readFile("src/app/api/integrations/google/connect/route.ts", "utf8");

  assert.match(connect, /const response = NextResponse\.redirect\(url\)/);
  assert.match(connect, /response\.cookies\.set\("aro_google_oauth_state"/);
  assert.match(connect, /response\.cookies\.set\("aro_google_pkce_verifier"/);
  assert.match(connect, /return response/);
  assert.doesNotMatch(connect, /cookieStore\.set/);
});

test("admin email test uses ARO dialog instead of window confirm", async () => {
  const dialog = await readFile("src/app/admin/settings/google-test-email-form.tsx", "utf8");

  assert.match(dialog, /role="dialog"/);
  assert.match(dialog, /Escape/);
  assert.doesNotMatch(dialog, /window\.confirm/);
});

test("Google documentation does not contain committed secrets", async () => {
  const doc = await readFile("docs/ARO_COMMUNICATIONS_GOOGLE_WORKSPACE.md", "utf8");

  assert.match(doc, /GOOGLE_CLIENT_SECRET=/);
  assert.doesNotMatch(doc, /AIza[0-9A-Za-z_-]+/);
  assert.doesNotMatch(doc, /ya29\./);
  assert.doesNotMatch(doc, /1\/\/[0-9A-Za-z_-]+/);
});
