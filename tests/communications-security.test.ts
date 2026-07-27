import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createPkcePair,
  randomToken,
  sha256,
  signOAuthState,
  verifyOAuthState
} from "../src/lib/communications/security";
import { aroGoogleEmail, googleScopes } from "../src/lib/communications/google-workspace";

test("secure public tokens are random and stored by hash", () => {
  const first = randomToken();
  const second = randomToken();

  assert.notEqual(first, second);
  assert.equal(sha256(first).length, 64);
  assert.notEqual(sha256(first), first);
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

test("Google Workspace integration is restricted to compose scope and ARO account", () => {
  assert.equal(aroGoogleEmail, "claudio@arolab.co");
  assert.ok(googleScopes.includes("https://www.googleapis.com/auth/gmail.compose"));
  assert.equal(googleScopes.includes("https://mail.google.com/" as never), false);
});

test("communication migration creates token hashes, queue states and RLS", async () => {
  const sql = await readFile("supabase/migrations/025_email_presentations_model_portal.sql", "utf8");

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
});

test("public presentation snapshots strip private media paths", async () => {
  const sql = await readFile("supabase/migrations/025_email_presentations_model_portal.sql", "utf8");
  const publicPage = await readFile("src/app/p/[token]/page.tsx", "utf8");
  const data = await readFile("src/lib/communications/data.ts", "utf8");
  const publicFunction = sql.slice(sql.indexOf("create or replace function public.get_public_presentation_by_token"));

  assert.match(publicFunction, /jsonb_build_object\(\s*'media_type'/);
  assert.doesNotMatch(publicFunction, /'storage_bucket'/);
  assert.doesNotMatch(publicFunction, /'storage_path'/);
  assert.doesNotMatch(publicFunction, /'thumbnail_path'/);
  assert.match(data, /getPresentationPrivateMediaRefsByToken/);
  assert.match(publicPage, /signPresentationMedia\(presentation, privateRefs\)/);
});

test("public presentation access uses restricted security definer RPCs", async () => {
  const sql = await readFile("supabase/migrations/025_email_presentations_model_portal.sql", "utf8");
  const publicPage = await readFile("src/app/p/[token]/page.tsx", "utf8");
  const data = await readFile("src/lib/communications/data.ts", "utf8");

  assert.match(sql, /security definer/);
  assert.match(sql, /set search_path = public/);
  assert.match(sql, /get_public_presentation_by_token/);
  assert.match(sql, /status in \('published', 'sent'\)/);
  assert.match(sql, /expires_at is null or p\.expires_at > now\(\)/);
  assert.match(sql, /grant execute on function public\.get_public_presentation_by_token\(text\) to anon, authenticated/);
  assert.doesNotMatch(publicPage, /\.from\("presentations"\)/);
  assert.match(data, /\.rpc\("get_public_presentation_by_token"/);
});

test("public model update access avoids direct table reads and supports draft submit RPCs", async () => {
  const sql = await readFile("supabase/migrations/025_email_presentations_model_portal.sql", "utf8");
  const updatePage = await readFile("src/app/update/[token]/page.tsx", "utf8");
  const data = await readFile("src/lib/communications/data.ts", "utf8");

  assert.match(sql, /get_public_model_update_request_by_token/);
  assert.match(sql, /save_model_update_request_draft/);
  assert.match(sql, /submit_model_update_request/);
  assert.match(sql, /r\.status not in \('expired', 'canceled', 'applied'\)/);
  assert.match(sql, /r\.expires_at > now\(\)/);
  assert.doesNotMatch(updatePage, /\.from\("model_update_requests"\)/);
  assert.match(data, /\.rpc\("save_model_update_request_draft"/);
  assert.match(data, /\.rpc\("submit_model_update_request"/);
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
  assert.match(sql, /field_not_requested/);
  assert.match(sql, /sensitive_field_requires_verification/);
  assert.match(sql, /sensitive_verified boolean/);
  assert.match(sql, /consumed_at = now\(\)/);
  assert.match(sql, /communication_rate_limits/);
  assert.match(sql, /check_communication_rate_limit/);
  assert.match(data, /operation: "update_start"/);
  assert.match(upload, /createSignedUploadUrl/);
  assert.match(upload, /extensions:/);
  assert.match(form, /uploadToSignedUrl/);
  assert.match(upload, /model_update_verification_codes/);
  assert.match(otp, /crypto\.randomInt\(100000, 1000000\)/);
  assert.match(otp, /code_hash: sha256\(code\)/);
  assert.doesNotMatch(otp, /return NextResponse\.json\([^)]*code/);
  assert.match(form, /fileSha256/);
  assert.match(form, /verification-code/);
});

test("email queue claims atomically and retries with backoff", async () => {
  const sql = await readFile("supabase/migrations/025_email_presentations_model_portal.sql", "utf8");
  const queue = await readFile("src/app/api/communications/process-email-queue/route.ts", "utf8");
  const reminders = await readFile("src/app/api/communications/process-model-update-reminders/route.ts", "utf8");

  assert.match(sql, /claim_outbound_emails/);
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /status = 'processing'/);
  assert.match(queue, /\.rpc\("claim_outbound_emails"/);
  assert.match(queue, /retry_pending/);
  assert.match(queue, /delayMinutes/);
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

  assert.match(callback, /existingConnection\?\.encrypted_refresh_token/);
  assert.match(callback, /revokeGoogleToken\(token\.access_token\)/);
  assert.match(googleServer, /shouldRefreshGoogleToken/);
  assert.match(googleServer, /invalid_grant/i);
  assert.match(googleServer, /EMAIL_EXTERNAL_SEND_ENABLED/);
  assert.match(queue, /COMMUNICATIONS_CRON_SECRET/);
  assert.match(queue, /retry_pending/);
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
