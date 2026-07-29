import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  classifyEmailDeliveryError,
  emailDeliveryErrorMessage
} from "../src/lib/communications/email-delivery-errors";
import {
  modeIsAvailable,
  resolveEmailOperationalState
} from "../src/lib/communications/email-operations";
import { googleOAuthRedirectConfigured } from "../src/lib/communications/google-workspace";

test("email delivery errors are stable and do not expose provider responses", () => {
  assert.equal(
    classifyEmailDeliveryError(new Error("Google Workspace não conectado.")).code,
    "google-not-connected"
  );
  assert.equal(
    classifyEmailDeliveryError(new Error("invalid_grant: token revoked")).code,
    "google-token-revoked"
  );
  assert.equal(
    classifyEmailDeliveryError(new Error("Gmail send failed: 403")).code,
    "gmail-send-failed"
  );
  assert.equal(
    classifyEmailDeliveryError(new Error("invalid_recipient_email")).code,
    "invalid-recipient"
  );
  assert.doesNotMatch(
    emailDeliveryErrorMessage("gmail-send-failed"),
    /403|token|response body/i
  );
});

test("operational state blocks Gmail modes until configuration and connection exist", () => {
  const disconnected = resolveEmailOperationalState({
    connectedEmail: null,
    connectionStatus: null,
    externalSendEnabled: false,
    gmailApiConfigured: false,
    schedulerEnabled: false,
    schedulerSecretConfigured: false
  });

  assert.equal(modeIsAvailable("system_draft", disconnected), true);
  assert.equal(modeIsAvailable("gmail_draft", disconnected), false);
  assert.equal(modeIsAvailable("send_now", disconnected), false);
  assert.equal(modeIsAvailable("scheduled", disconnected), false);

  const connected = resolveEmailOperationalState({
    connectedEmail: "admin@example.test",
    connectionStatus: "connected",
    externalSendEnabled: false,
    gmailApiConfigured: true,
    schedulerEnabled: false,
    schedulerSecretConfigured: true
  });

  assert.equal(modeIsAvailable("gmail_draft", connected), true);
  assert.equal(modeIsAvailable("send_now", connected), true);
  assert.equal(modeIsAvailable("scheduled", connected), false);

  const preview = {
    ...connected,
    externalOperationsAllowed: true
  };
  assert.equal(modeIsAvailable("gmail_draft", preview), true);
  assert.equal(modeIsAvailable("send_now", preview), true);
  assert.equal(modeIsAvailable("scheduled", preview), false);
});

test("scheduler is operational only with connection, secret and explicit enablement", () => {
  const ready = resolveEmailOperationalState({
    connectedEmail: "admin@example.test",
    connectionStatus: "connected",
    externalSendEnabled: false,
    gmailApiConfigured: true,
    schedulerEnabled: true,
    schedulerSecretConfigured: true
  });

  assert.equal(ready.schedulingOperational, true);
  assert.equal(modeIsAvailable("scheduled", ready), true);
});

test("Google OAuth redirect must exactly match the configured production callback", () => {
  const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const previousRedirect = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  process.env.NEXT_PUBLIC_APP_URL = "https://aro.example.test";
  process.env.GOOGLE_OAUTH_REDIRECT_URI =
    "https://aro.example.test/api/integrations/google/callback";
  assert.equal(googleOAuthRedirectConfigured(), true);

  process.env.GOOGLE_OAUTH_REDIRECT_URI =
    "https://preview.example.test/api/integrations/google/callback";
  assert.equal(googleOAuthRedirectConfigured(), false);
  if (previousAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
  if (previousRedirect === undefined) delete process.env.GOOGLE_OAUTH_REDIRECT_URI;
  else process.env.GOOGLE_OAUTH_REDIRECT_URI = previousRedirect;
});

test("composer never ignores a selected presentation", async () => {
  const composer = await readFile(
    "src/components/admin/email-center/email-composer.tsx",
    "utf8"
  );

  assert.match(composer, /if \(presentationId\) event\.preventDefault\(\)/);
  assert.match(composer, /Continuar no envio seguro/);
  assert.match(composer, /\/admin\/presentations\/\$\{presentationId\}\/email/);
  assert.doesNotMatch(composer, /name="presentation_id"/);
});

test("generic and presentation immediate delivery use the shared executor", async () => {
  const [genericActions, presentationActions, delivery] = await Promise.all([
    readFile("src/app/admin/email/actions.ts", "utf8"),
    readFile("src/app/admin/presentations/actions.ts", "utf8"),
    readFile("src/lib/communications/email-delivery-server.ts", "utf8")
  ]);

  assert.match(genericActions, /submitOutboundEmail/);
  assert.match(presentationActions, /deliverOutboundEmailNow/);
  assert.match(delivery, /if \(email\.status === "sent"\)/);
  assert.match(delivery, /\.eq\("attempt_count", email\.attempt_count\)/);
  assert.match(delivery, /gmail_message_id/);
  assert.match(delivery, /gmail_thread_id/);
  assert.doesNotMatch(genericActions, /sendGmailMessage/);
});

test("Preview permits only the controlled ARO recipient for Gmail operations", async () => {
  const [delivery, operationalState, testRoute, testForm] = await Promise.all([
    readFile("src/lib/communications/email-delivery-server.ts", "utf8"),
    readFile("src/lib/communications/operational-state-server.ts", "utf8"),
    readFile("src/app/api/integrations/google/test-email/route.ts", "utf8"),
    readFile("src/app/admin/settings/google-test-email-form.tsx", "utf8")
  ]);

  assert.doesNotMatch(delivery, /VERCEL_ENV === "preview"/);
  assert.match(delivery, /assertSafeRecipientForRealSend\(recipientEmail\)/);
  assert.match(operationalState, /externalOperationsAllowed: true/);
  assert.match(testRoute, /controlled-gmail-test/);
  assert.match(testRoute, /ARO Email Center — Teste de envio/);
  assert.match(testRoute, /validação controlada do envio de e-mails da ARO/);
  assert.match(testForm, /window\.crypto\.randomUUID\(\)/);
  assert.match(testForm, /name="request_nonce"/);
});

test("manual and scheduled queue processing stay server-side and secret-protected", async () => {
  const [route, actions, workflow] = await Promise.all([
    readFile("src/app/api/communications/process-email-queue/route.ts", "utf8"),
    readFile("src/app/admin/email/actions.ts", "utf8"),
    readFile(".github/workflows/arolab-communications-queue.yml", "utf8")
  ]);

  assert.match(route, /COMMUNICATIONS_CRON_SECRET/);
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
  assert.match(route, /VERCEL_ENV === "preview"/);
  assert.match(actions, /processEmailQueueNowAction/);
  assert.match(actions, /requireRole\(\["admin"\]\)/);
  assert.match(actions, /VERCEL_ENV === "preview"/);
  assert.match(workflow, /COMMUNICATIONS_QUEUE_SCHEDULER_ENABLED/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /--output \/dev\/null/);
  assert.doesNotMatch(workflow, /set -x/);
  assert.doesNotMatch(workflow, /echo.*\$\{COMMUNICATIONS_CRON_SECRET/);
});

test("operational banner is present on all required email entry points", async () => {
  const pages = await Promise.all(
    [
      "src/app/admin/email/page.tsx",
      "src/app/admin/email/compose/page.tsx",
      "src/app/admin/presentations/[id]/email/page.tsx"
    ].map((path) => readFile(path, "utf8"))
  );

  for (const page of pages) {
    assert.match(page, /EmailOperationalBanner/);
  }
});
