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
