import sanitizeHtml from "sanitize-html";

export type GmailHeader = {
  name: string;
  value: string;
};

export type GmailMessagePart = {
  body?: {
    attachmentId?: string;
    data?: string;
    size?: number;
  };
  filename?: string;
  headers?: GmailHeader[];
  mimeType?: string;
  partId?: string;
  parts?: GmailMessagePart[];
};

export type GmailApiMessage = {
  historyId?: string;
  id: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: GmailMessagePart;
  sizeEstimate?: number;
  snippet?: string;
  threadId: string;
};

export type GmailApiThread = {
  historyId?: string;
  id: string;
  messages?: GmailApiMessage[];
  snippet?: string;
};

export type GmailAttachment = {
  attachmentId: string | null;
  filename: string;
  mimeType: string;
  messageId: string;
  partId: string | null;
  size: number;
};

export type GmailParsedAddress = {
  email: string;
  name: string;
};

export type GmailParsedMessage = {
  attachments: GmailAttachment[];
  bcc: GmailParsedAddress[];
  cc: GmailParsedAddress[];
  date: string | null;
  from: GmailParsedAddress;
  hasRemoteContent: boolean;
  html: string;
  id: string;
  inReplyTo: string | null;
  internalDate: string | null;
  labelIds: string[];
  messageId: string | null;
  references: string | null;
  snippet: string;
  subject: string;
  text: string;
  threadId: string;
  to: GmailParsedAddress[];
};

const allowedEmailTags = [
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "hr",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul"
];

function decodeQuotedPrintableWord(value: string) {
  const bytes: number[] = [];
  const normalized = value.replace(/_/g, " ");

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    const hex = normalized.slice(index + 1, index + 3);
    if (character === "=" && /^[0-9a-f]{2}$/i.test(hex)) {
      bytes.push(Number.parseInt(hex, 16));
      index += 2;
    } else {
      bytes.push(...Buffer.from(character, "utf8"));
    }
  }

  return Buffer.from(bytes).toString("utf8");
}

export function decodeMimeHeader(value: string | null | undefined) {
  if (!value) return "";

  return value
    .replace(
      /=\?([^?]+)\?([bq])\?([^?]*)\?=/gi,
      (_match, _charset: string, encoding: string, encoded: string) => {
        try {
          return encoding.toLowerCase() === "b"
            ? Buffer.from(encoded, "base64").toString("utf8")
            : decodeQuotedPrintableWord(encoded);
        } catch {
          return "";
        }
      }
    )
    .replace(/\r?\n[ \t]+/g, " ")
    .trim();
}

export function decodeGmailBody(data: string | null | undefined) {
  if (!data) return "";
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  const padded = padding ? normalized.padEnd(normalized.length + (4 - padding), "=") : normalized;
  return Buffer.from(padded, "base64").toString("utf8");
}

export function gmailHeader(headers: GmailHeader[] | undefined, name: string) {
  return (
    headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value ?? ""
  );
}

function splitAddressList(value: string) {
  const items: string[] = [];
  let current = "";
  let quoted = false;
  let angleDepth = 0;

  for (const character of value) {
    if (character === '"') quoted = !quoted;
    if (!quoted && character === "<") angleDepth += 1;
    if (!quoted && character === ">") angleDepth = Math.max(0, angleDepth - 1);
    if (!quoted && angleDepth === 0 && character === ",") {
      if (current.trim()) items.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }

  if (current.trim()) items.push(current.trim());
  return items;
}

export function parseGmailAddresses(value: string | null | undefined) {
  if (!value) return [];

  return splitAddressList(decodeMimeHeader(value))
    .map((entry) => {
      const match = entry.match(/^(.*?)<([^<>]+)>$/);
      const email = (match?.[2] ?? entry).trim().replace(/^mailto:/i, "");
      const name = (match?.[1] ?? email.split("@")[0] ?? "")
        .trim()
        .replace(/^["']|["']$/g, "");
      return { email, name: name || email } satisfies GmailParsedAddress;
    })
    .filter((address) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address.email));
}

export function sanitizeGmailHtml(value: string) {
  const hasRemoteContent = /<img\b|background\s*=|url\s*\(/i.test(value);
  const html = sanitizeHtml(value, {
    allowedAttributes: {
      a: ["href", "rel", "target", "title"],
      blockquote: ["type"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"]
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesAppliedToAttributes: ["href"],
    allowedTags: allowedEmailTags,
    disallowedTagsMode: "discard",
    enforceHtmlBoundary: true,
    exclusiveFilter(frame) {
      if (frame.tag === "a") {
        const href = frame.attribs.href ?? "";
        return /^(?:javascript|data|file|vbscript):/i.test(href.trim());
      }
      return false;
    },
    transformTags: {
      a: (_tagName, attribs) => ({
        attribs: {
          ...attribs,
          rel: "noopener noreferrer nofollow",
          target: "_blank"
        },
        tagName: "a"
      })
    }
  });

  return { hasRemoteContent, html };
}

function plainTextFromHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {}
  })
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type ParsedParts = {
  attachments: GmailAttachment[];
  htmlParts: string[];
  textParts: string[];
};

function collectParts(
  part: GmailMessagePart | undefined,
  messageId: string,
  result: ParsedParts
) {
  if (!part) return;

  const mimeType = (part.mimeType ?? "").toLowerCase();
  const filename = decodeMimeHeader(part.filename);
  const attachmentId = part.body?.attachmentId ?? null;

  if (filename || attachmentId) {
    result.attachments.push({
      attachmentId,
      filename: filename || "anexo",
      messageId,
      mimeType: mimeType || "application/octet-stream",
      partId: part.partId ?? null,
      size: part.body?.size ?? 0
    });
  } else if (part.body?.data) {
    const decoded = decodeGmailBody(part.body.data);
    if (mimeType === "text/html") result.htmlParts.push(decoded);
    if (mimeType === "text/plain") result.textParts.push(decoded);
  }

  for (const child of part.parts ?? []) {
    collectParts(child, messageId, result);
  }
}

export function parseGmailMessage(message: GmailApiMessage): GmailParsedMessage {
  const headers = message.payload?.headers;
  const parts: ParsedParts = { attachments: [], htmlParts: [], textParts: [] };
  collectParts(message.payload, message.id, parts);

  const rawHtml = parts.htmlParts.join("\n");
  const sanitized = sanitizeGmailHtml(rawHtml);
  const text =
    parts.textParts.join("\n").trim() ||
    plainTextFromHtml(sanitized.html) ||
    decodeMimeHeader(message.snippet);
  const from =
    parseGmailAddresses(gmailHeader(headers, "From"))[0] ??
    ({ email: "", name: "Remetente desconhecido" } satisfies GmailParsedAddress);

  return {
    attachments: parts.attachments,
    bcc: parseGmailAddresses(gmailHeader(headers, "Bcc")),
    cc: parseGmailAddresses(gmailHeader(headers, "Cc")),
    date: gmailHeader(headers, "Date") || null,
    from,
    hasRemoteContent: sanitized.hasRemoteContent,
    html: sanitized.html,
    id: message.id,
    inReplyTo: gmailHeader(headers, "In-Reply-To") || null,
    internalDate: message.internalDate ?? null,
    labelIds: message.labelIds ?? [],
    messageId: gmailHeader(headers, "Message-ID") || null,
    references: gmailHeader(headers, "References") || null,
    snippet: decodeMimeHeader(message.snippet),
    subject: decodeMimeHeader(gmailHeader(headers, "Subject")) || "(sem assunto)",
    text,
    threadId: message.threadId,
    to: parseGmailAddresses(gmailHeader(headers, "To"))
  };
}

export function parseGmailThread(thread: GmailApiThread) {
  const messages = (thread.messages ?? [])
    .map(parseGmailMessage)
    .sort((left, right) => Number(left.internalDate ?? 0) - Number(right.internalDate ?? 0));
  const latest = messages.at(-1) ?? null;

  return {
    historyId: thread.historyId ?? null,
    id: thread.id,
    messages,
    snippet: decodeMimeHeader(thread.snippet ?? latest?.snippet),
    subject: latest?.subject ?? "(sem assunto)"
  };
}

export function sanitizeAttachmentFilename(value: string | null | undefined) {
  const normalized = decodeMimeHeader(value)
    .replace(/[\\/<>:"|?*\u0000-\u001f]/g, "_")
    .replace(/^\.+/, "")
    .trim();
  return (normalized || "anexo").slice(0, 180);
}

export function sanitizeAttachmentMimeType(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(normalized)
    ? normalized
    : "application/octet-stream";
}
