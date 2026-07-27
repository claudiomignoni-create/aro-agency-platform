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

test("Google documentation does not contain committed secrets", async () => {
  const doc = await readFile("docs/ARO_COMMUNICATIONS_GOOGLE_WORKSPACE.md", "utf8");

  assert.match(doc, /GOOGLE_CLIENT_SECRET=/);
  assert.doesNotMatch(doc, /AIza[0-9A-Za-z_-]+/);
  assert.doesNotMatch(doc, /ya29\./);
  assert.doesNotMatch(doc, /1\/\/[0-9A-Za-z_-]+/);
});
