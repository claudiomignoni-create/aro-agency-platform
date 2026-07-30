import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  emailHtmlFromComposerText,
  emailPlainTextFromComposerText,
  emailPresentationLayouts,
  filterEmailComposerRecipients,
  formatEmailComposerSelection
} from "../src/lib/communications/email-compose";
import type { EmailRecipientOption } from "../src/lib/communications/email-center";
import {
  modeIsAvailable,
  resolveEmailOperationalState
} from "../src/lib/communications/email-operations";

const recipients: EmailRecipientOption[] = [
  {
    category: "agency",
    email: "booking@agency.test",
    id: "agency-1",
    name: "ARO Partner",
    organization: "ARO Partner"
  },
  {
    category: "client",
    email: "jobs@client.test",
    id: "client-1",
    name: "Editorial Client",
    organization: "Editorial Client"
  },
  {
    category: "agency_contact",
    email: "ana@agency.test",
    id: "agency-contact-1",
    name: "Ana Booking",
    organization: "ARO Partner"
  },
  {
    category: "client_contact",
    email: "bruno@client.test",
    id: "client-contact-1",
    name: "Bruno Casting",
    organization: "Editorial Client"
  }
];

test("composer recipient tabs keep organizations and contacts separate", () => {
  assert.deepEqual(
    filterEmailComposerRecipients(recipients, "organizations", "").map((item) => item.id),
    ["agency-1", "client-1"]
  );
  assert.deepEqual(
    filterEmailComposerRecipients(recipients, "contacts", "").map((item) => item.id),
    ["agency-contact-1", "client-contact-1"]
  );
  assert.deepEqual(
    filterEmailComposerRecipients(recipients, "contacts", "bruno").map((item) => item.id),
    ["client-contact-1"]
  );
});

test("composer toolbar updates the selected text predictably", () => {
  assert.deepEqual(formatEmailComposerSelection("Olá equipe", 4, 10, "bold"), {
    selectionEnd: 12,
    selectionStart: 6,
    value: "Olá **equipe**"
  });
  assert.equal(
    formatEmailComposerSelection("Primeiro\nSegundo", 0, 16, "list").value,
    "- Primeiro\n- Segundo"
  );
  assert.equal(
    formatEmailComposerSelection("ARO", 0, 3, "link").value,
    "[ARO](https://)"
  );
});

test("composer message conversion keeps formatting and escapes unsafe HTML", () => {
  const source = "**Olá**\n\n- Item\n- <script>alert(1)</script>\n\n[ARO](https://aro.test)";
  const html = emailHtmlFromComposerText(source);
  const plain = emailPlainTextFromComposerText(source);

  assert.match(html, /<strong>Olá<\/strong>/);
  assert.match(html, /<ul><li>Item<\/li>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /href="https:\/\/aro\.test"/);
  assert.match(plain, /• Item/);
  assert.match(plain, /ARO: https:\/\/aro\.test/);
});

test("composer exposes the four requested presentation layouts", () => {
  assert.deepEqual(
    emailPresentationLayouts.map((layout) => layout.id),
    ["grid", "list", "book", "polaroids"]
  );
});

test("composer render preserves real delivery modes and secure presentations", async () => {
  const [component, page] = await Promise.all([
    readFile("src/components/admin/email-center/email-composer.tsx", "utf8"),
    readFile("src/app/admin/email/compose/page.tsx", "utf8")
  ]);

  assert.match(page, /email-compose-v2/);
  assert.match(page, /Voltar ao Email Center/);
  assert.match(page, /EmailOperationalBanner compact/);
  assert.match(component, /setRecipient\(option\.email\)/);
  assert.match(component, /name="recipient_email" type="hidden"/);
  assert.match(component, /aria-selected=/);
  assert.match(component, /aria-pressed=/);
  assert.match(component, /onChange=\{\(event\) => setSubject\(event\.target\.value\)\}/);
  assert.match(component, /onChange=\{\(event\) => setBody\(event\.target\.value\)\}/);
  assert.match(component, /name="mode"[\s\S]*value="send_now"/);
  assert.match(component, /name="mode"[\s\S]*value="gmail_draft"/);
  assert.match(component, /name="mode"[\s\S]*value="system_draft"/);
  assert.match(component, /if \(presentationId\) event\.preventDefault\(\)/);
  assert.match(component, /Continuar no envio seguro/);
});

test("composer visibly protects connected and disconnected Gmail states", () => {
  const disconnected = resolveEmailOperationalState({
    externalSendEnabled: false,
    gmailApiConfigured: false,
    schedulerEnabled: false,
    schedulerSecretConfigured: false
  });
  const connected = resolveEmailOperationalState({
    connectedEmail: "admin@example.test",
    connectionStatus: "connected",
    externalSendEnabled: true,
    gmailApiConfigured: true,
    schedulerEnabled: true,
    schedulerSecretConfigured: true
  });

  assert.equal(modeIsAvailable("system_draft", disconnected), true);
  assert.equal(modeIsAvailable("send_now", disconnected), false);
  assert.equal(modeIsAvailable("gmail_draft", disconnected), false);
  assert.equal(modeIsAvailable("send_now", connected), true);
  assert.equal(modeIsAvailable("gmail_draft", connected), true);
  assert.equal(modeIsAvailable("scheduled", connected), true);
});

test("composer styles prevent page overflow across desktop, tablet and mobile", async () => {
  const css = await readFile("src/app/admin/email/email-center.css", "utf8");

  assert.match(css, /\.admin-v2:has\(\.email-compose-v2\) \.admin-v2-workspace[\s\S]*overflow-x: hidden/);
  assert.match(css, /\.email-composer-shell[\s\S]*min-width: 0/);
  assert.match(css, /@media \(max-width: 960px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(max-width: 430px\)/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /\.email-compose-side[\s\S]*grid-template-columns: 1fr/);
});
