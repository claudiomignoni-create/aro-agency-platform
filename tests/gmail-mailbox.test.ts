import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  decodeGmailBody,
  decodeMimeHeader,
  parseGmailAddresses,
  parseGmailMessage,
  parseGmailThread,
  sanitizeAttachmentFilename,
  sanitizeAttachmentMimeType,
  sanitizeGmailHtml,
  type GmailApiMessage
} from "../src/lib/communications/gmail-message";
import {
  rfc2822Message
} from "../src/lib/communications/google-workspace";
import {
  zonedDateTimeLocalToUtc
} from "../src/lib/communications/scheduling";

function gmailBody(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function messageFixture(overrides: Partial<GmailApiMessage> = {}): GmailApiMessage {
  return {
    id: "message_1",
    internalDate: "1785362400000",
    labelIds: ["INBOX", "UNREAD"],
    payload: {
      headers: [
        { name: "From", value: "=?UTF-8?B?Sm9zw6kgU2lsdmE=?= <jose@example.test>" },
        { name: "To", value: "ARO <claudio@arolab.co>" },
        { name: "Subject", value: "=?UTF-8?B?QXByZXNlbnRhw6fDo28gQVJP?=" },
        { name: "Message-ID", value: "<message-1@example.test>" }
      ],
      mimeType: "multipart/mixed",
      parts: [
        {
          mimeType: "multipart/alternative",
          parts: [
            {
              body: { data: gmailBody("Olá ARO") },
              mimeType: "text/plain",
              partId: "0.0"
            },
            {
              body: {
                data: gmailBody(
                  '<p onclick="steal()">Olá <strong>ARO</strong></p><script>alert(1)</script><img src="https://tracker.example/pixel">'
                )
              },
              mimeType: "text/html",
              partId: "0.1"
            }
          ]
        },
        {
          body: { attachmentId: "attachment_1", size: 4200 },
          filename: "portfolio.pdf",
          mimeType: "application/pdf",
          partId: "1"
        }
      ]
    },
    snippet: "Olá ARO",
    threadId: "thread_1",
    ...overrides
  };
}

test("Gmail base64url and MIME headers decode safely", () => {
  assert.equal(decodeGmailBody(gmailBody("Olá, ARO")), "Olá, ARO");
  assert.equal(
    decodeMimeHeader("=?UTF-8?B?QXByZXNlbnRhw6fDo28gQVJP?="),
    "Apresentação ARO"
  );
  assert.equal(
    decodeMimeHeader("=?UTF-8?Q?Claudio_Mignoni?="),
    "Claudio Mignoni"
  );
});

test("address parsing supports display names and comma-separated recipients", () => {
  assert.deepEqual(
    parseGmailAddresses(
      '"Claudio Mignoni" <claudio@arolab.co>, Agência <agency@example.test>'
    ),
    [
      { email: "claudio@arolab.co", name: "Claudio Mignoni" },
      { email: "agency@example.test", name: "Agência" }
    ]
  );
});

test("Gmail HTML sanitization removes executable and remote content", () => {
  const result = sanitizeGmailHtml(
    '<div onmouseover="bad()"><a href="javascript:bad()">x</a><a href="https://example.test">ok</a><iframe src="https://bad.test"></iframe><img src="https://tracker.test/pixel"><script>bad()</script></div>'
  );

  assert.equal(result.hasRemoteContent, true);
  assert.doesNotMatch(result.html, /script|iframe|onmouseover|javascript:|<img/i);
  assert.match(result.html, /https:\/\/example\.test/);
  assert.match(result.html, /noopener noreferrer nofollow/);
});

test("nested Gmail MIME messages preserve safe text, metadata and attachments", () => {
  const parsed = parseGmailMessage(messageFixture());

  assert.equal(parsed.subject, "Apresentação ARO");
  assert.equal(parsed.from.name, "José Silva");
  assert.equal(parsed.from.email, "jose@example.test");
  assert.equal(parsed.to[0]?.email, "claudio@arolab.co");
  assert.equal(parsed.text, "Olá ARO");
  assert.match(parsed.html, /<strong>ARO<\/strong>/);
  assert.doesNotMatch(parsed.html, /onclick|script|img/i);
  assert.equal(parsed.hasRemoteContent, true);
  assert.deepEqual(parsed.attachments, [
    {
      attachmentId: "attachment_1",
      filename: "portfolio.pdf",
      messageId: "message_1",
      mimeType: "application/pdf",
      partId: "1",
      size: 4200
    }
  ]);
});

test("Gmail thread parsing orders messages by internal date", () => {
  const latest = messageFixture({ id: "message_2", internalDate: "1785362500000" });
  const first = messageFixture({ id: "message_1", internalDate: "1785362400000" });
  const thread = parseGmailThread({
    id: "thread_1",
    messages: [latest, first]
  });

  assert.deepEqual(thread.messages.map((message) => message.id), [
    "message_1",
    "message_2"
  ]);
  assert.equal(thread.subject, "Apresentação ARO");
});

test("outgoing MIME supports CC, BCC and Gmail thread headers", () => {
  const raw = rfc2822Message({
    bcc: "private@example.test",
    bodyHtml: "<p>Olá</p>",
    bodyText: "Olá",
    cc: "copy@example.test",
    from: "claudio@arolab.co",
    inReplyTo: "<message-1@example.test>",
    references: "<older@example.test> <message-1@example.test>",
    subject: "Resposta ARO",
    to: "agency@example.test"
  });

  assert.match(raw, /Cc: copy@example\.test/);
  assert.match(raw, /Bcc: private@example\.test/);
  assert.match(raw, /In-Reply-To: <message-1@example\.test>/);
  assert.match(raw, /References: <older@example\.test> <message-1@example\.test>/);
  assert.match(raw, /Content-Transfer-Encoding: 8bit/);
});

test("attachment filenames cannot escape download headers", () => {
  assert.equal(
    sanitizeAttachmentFilename("../../private\\document?.pdf"),
    "_.._private_document_.pdf"
  );
  assert.equal(sanitizeAttachmentMimeType("application/pdf"), "application/pdf");
  assert.equal(
    sanitizeAttachmentMimeType("text/html\r\nX-Unsafe: yes"),
    "application/octet-stream"
  );
});

test("webmail schedules local Sao Paulo time as deterministic UTC", () => {
  assert.equal(
    zonedDateTimeLocalToUtc(
      "2026-08-01T09:30",
      "America/Sao_Paulo"
    )?.toISOString(),
    "2026-08-01T12:30:00.000Z"
  );
  assert.equal(
    zonedDateTimeLocalToUtc("invalid", "America/Sao_Paulo"),
    null
  );
});

test("mailbox service exposes the complete allowlisted Gmail surface without permanent delete", async () => {
  const source = await readFile(
    "src/lib/communications/gmail-mailbox-server.ts",
    "utf8"
  );
  const expectedFunctions = [
    "listGmailLabels",
    "listGmailThreads",
    "getGmailThread",
    "listGmailDrafts",
    "getGmailDraft",
    "searchGmailThreads",
    "markThreadRead",
    "markThreadUnread",
    "starThread",
    "unstarThread",
    "archiveThread",
    "trashThread",
    "untrashThread",
    "createGmailDraft",
    "updateGmailDraft",
    "sendGmailDraft",
    "trashGmailDraft",
    "replyToGmailThread",
    "forwardGmailMessage",
    "getGmailAttachment"
  ];

  for (const name of expectedFunctions) {
    assert.match(source, new RegExp(`export (?:async )?function ${name}\\b`), name);
  }
  assert.match(source, /maxMailboxPageSize = 25/);
  assert.match(source, /nextPageToken/);
  assert.match(source, /cache: "no-store"/);
  assert.doesNotMatch(source, /\/messages\/[^`"]*\/delete|\/threads\/[^`"]*\/delete/);
  assert.doesNotMatch(source, /https:\/\/mail\.google\.com/);
});

test("webmail mutations stay admin-only and destructive actions stop at trash", async () => {
  const actions = await readFile(
    "src/app/admin/email/mailbox-actions.ts",
    "utf8"
  );
  const attachmentRoute = await readFile(
    "src/app/api/admin/email/attachments/[messageId]/[attachmentId]/route.ts",
    "utf8"
  );

  assert.match(actions, /requireRole\(\["admin"\]\)/);
  assert.match(actions, /safeReturnPath/);
  assert.match(actions, /idempotencyKey/);
  assert.match(actions, /trashThread/);
  assert.match(actions, /untrashThread/);
  assert.doesNotMatch(actions, /deleteGmail|permanent/i);
  assert.match(attachmentRoute, /requireRole\(\["admin"\]\)/);
  assert.match(attachmentRoute, /Cache-Control": "private, no-store"/);
  assert.match(attachmentRoute, /X-Content-Type-Options": "nosniff"/);
});

test("webmail UI is route-driven, responsive and contains no reference fixtures", async () => {
  const shell = await readFile(
    "src/components/admin/email-center/email-webmail-shell.tsx",
    "utf8"
  );
  const css = await readFile("src/app/admin/email/email-center.css", "utf8");
  const combined = `${shell}\n${css}`;

  for (const route of [
    "/admin/email/inbox",
    "/admin/email/sent",
    "/admin/email/drafts",
    "/admin/email/scheduled",
    "/admin/email/trash",
    "/admin/email/starred",
    "/admin/email/compose"
  ]) {
    assert.match(shell, new RegExp(route.replace(/\//g, "\\/")));
  }
  assert.match(shell, /window\.setTimeout/);
  assert.match(shell, /360/);
  assert.match(shell, /controller\.abort\(\)/);
  assert.match(css, /@media \(max-width: 1220px\)/);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(max-width: 410px\)/);
  assert.doesNotMatch(combined, /Williams & Co\.|James Hendricks|Isabella Rossi|Mariana Costa|Valentina Lima|1\.248/);
});
