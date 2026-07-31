import "server-only";

import {
  aroGoogleEmail,
  base64Url,
  rfc2822Message,
  type GmailOutgoingMessage
} from "@/lib/communications/google-workspace";
import {
  getUsableGoogleMailboxAccessToken
} from "@/lib/communications/google-server";
import {
  decodeMimeHeader,
  gmailHeader,
  parseGmailAddresses,
  parseGmailMessage,
  parseGmailThread,
  sanitizeAttachmentFilename,
  sanitizeAttachmentMimeType,
  type GmailApiMessage,
  type GmailApiThread,
  type GmailParsedMessage
} from "@/lib/communications/gmail-message";

const gmailApiBase = "https://gmail.googleapis.com/gmail/v1/users/me";
const maxMailboxPageSize = 25;
const maxAttachmentBytes = 20 * 1024 * 1024;

export type GmailMailboxErrorCode =
  | "disconnected"
  | "insufficient_scope"
  | "token_revoked"
  | "refresh_failed"
  | "quota"
  | "unavailable"
  | "not_found"
  | "attachment_unavailable"
  | "sanitization_failed"
  | "network";

const mailboxErrorMessages: Record<GmailMailboxErrorCode, string> = {
  attachment_unavailable: "O anexo não está disponível no Gmail.",
  disconnected: "Conecte a conta Gmail da ARO para abrir o webmail.",
  insufficient_scope: "Reconecte o Gmail para habilitar Caixa de entrada e Enviados.",
  network: "Não foi possível acessar o Gmail agora. Tente atualizar em instantes.",
  not_found: "A conversa solicitada não foi encontrada.",
  quota: "O Gmail limitou temporariamente as consultas. Aguarde antes de atualizar.",
  refresh_failed: "A autorização do Gmail não pôde ser renovada. Reconecte a conta ARO.",
  sanitization_failed: "O conteúdo da mensagem não pôde ser exibido com segurança.",
  token_revoked: "O acesso ao Gmail foi revogado. Reconecte a conta ARO.",
  unavailable: "O Gmail está temporariamente indisponível."
};

export class GmailMailboxError extends Error {
  code: GmailMailboxErrorCode;

  constructor(code: GmailMailboxErrorCode) {
    super(mailboxErrorMessages[code]);
    this.code = code;
    this.name = "GmailMailboxError";
  }
}

export function gmailMailboxErrorMessage(code: GmailMailboxErrorCode) {
  return mailboxErrorMessages[code];
}

export type GmailMailboxFolder =
  | "inbox"
  | "sent"
  | "trash"
  | "starred"
  | "unread"
  | "label";

export type GmailLabel = {
  color: {
    backgroundColor?: string;
    textColor?: string;
  } | null;
  id: string;
  labelListVisibility: string | null;
  messageListVisibility: string | null;
  messagesTotal: number | null;
  messagesUnread: number | null;
  name: string;
  threadsTotal: number | null;
  threadsUnread: number | null;
  type: "system" | "user";
};

export type GmailThreadSummary = {
  date: string | null;
  from: {
    email: string;
    name: string;
  };
  hasAttachment: boolean;
  id: string;
  labelIds: string[];
  messageCount: number;
  snippet: string;
  starred: boolean;
  subject: string;
  to: Array<{
    email: string;
    name: string;
  }>;
  unread: boolean;
};

export type GmailThreadPage = {
  nextPageToken: string | null;
  resultSizeEstimate: number | null;
  threads: GmailThreadSummary[];
};

export type GmailDraftSummary = GmailThreadSummary & {
  draftId: string;
};

export type GmailDraftPage = {
  drafts: GmailDraftSummary[];
  nextPageToken: string | null;
  resultSizeEstimate: number | null;
};

type GmailListThreadResponse = {
  nextPageToken?: string;
  resultSizeEstimate?: number;
  threads?: Array<{ historyId?: string; id: string; snippet?: string }>;
};

type GmailListDraftResponse = {
  drafts?: Array<{ id: string; message?: GmailApiMessage }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const metadataCache = new Map<string, CacheEntry<unknown>>();

function cached<T>(key: string) {
  const entry = metadataCache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    metadataCache.delete(key);
    return null;
  }
  return entry.value as T;
}

function storeCache<T>(key: string, value: T, ttlMs: number) {
  metadataCache.set(key, { expiresAt: Date.now() + ttlMs, value });
  return value;
}

function invalidateMailboxCache(profileId: string) {
  for (const key of metadataCache.keys()) {
    if (key.startsWith(`${profileId}:`)) metadataCache.delete(key);
  }
}

function safePageSize(value: number | undefined) {
  if (!Number.isFinite(value)) return 20;
  return Math.max(1, Math.min(maxMailboxPageSize, Math.floor(value ?? 20)));
}

function safeGmailId(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized || !/^[A-Za-z0-9_-]+$/.test(normalized)) {
    throw new Error(`Invalid Gmail ${field}`);
  }
  return normalized;
}

function safePageToken(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.trim();
  if (!/^[A-Za-z0-9._~+/=-]+$/.test(normalized) || normalized.length > 2048) {
    throw new Error("Invalid Gmail page token");
  }
  return normalized;
}

async function classifyGmailResponse(response: Response): Promise<never> {
  if (response.status === 401) throw new GmailMailboxError("token_revoked");
  if (response.status === 404) throw new GmailMailboxError("not_found");
  if (response.status === 429) throw new GmailMailboxError("quota");
  if (response.status >= 500) throw new GmailMailboxError("unavailable");

  if (response.status === 403) {
    let reason = "";
    try {
      const payload = (await response.json()) as {
        error?: { errors?: Array<{ reason?: string }>; status?: string };
      };
      reason = [
        payload.error?.status,
        ...(payload.error?.errors?.map((entry) => entry.reason) ?? [])
      ]
        .filter(Boolean)
        .join(" ");
    } catch {
      // The sanitized status is enough when Google does not return JSON.
    }

    if (/insufficient|permission|scope/i.test(reason)) {
      throw new GmailMailboxError("insufficient_scope");
    }
    if (/quota|rate|limit/i.test(reason)) throw new GmailMailboxError("quota");
  }

  throw new GmailMailboxError("unavailable");
}

async function gmailRequest<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${gmailApiBase}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers
      }
    });
  } catch {
    throw new GmailMailboxError("network");
  }

  if (!response.ok) await classifyGmailResponse(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function mailboxAccess(profileId: string) {
  try {
    return await getUsableGoogleMailboxAccessToken(profileId);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "google-not-connected" || code === "google-not-configured") {
      throw new GmailMailboxError("disconnected");
    }
    if (code === "google-scope-insufficient") {
      throw new GmailMailboxError("insufficient_scope");
    }
    if (code === "google-token-revoked") {
      throw new GmailMailboxError("token_revoked");
    }
    if (code === "google-refresh-unavailable") {
      throw new GmailMailboxError("refresh_failed");
    }
    throw error;
  }
}

const summaryMimeFields =
  "filename,mimeType,body/attachmentId,body/size,parts(filename,mimeType,body/attachmentId,body/size,parts(filename,mimeType,body/attachmentId,body/size))";

function threadSummaryParams() {
  return new URLSearchParams({
    fields: `id,historyId,snippet,messages(id,threadId,labelIds,internalDate,snippet,payload(headers,${summaryMimeFields}))`,
    format: "full"
  });
}

function draftSummaryParams() {
  return new URLSearchParams({
    fields: `id,message(id,threadId,labelIds,internalDate,snippet,payload(headers,${summaryMimeFields}))`,
    format: "full"
  });
}

function partHasAttachment(part: GmailApiMessage["payload"]): boolean {
  if (!part) return false;
  if (part.filename || part.body?.attachmentId) return true;
  return (part.parts ?? []).some(partHasAttachment);
}

function validInternalDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(Number(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function threadSummary(thread: GmailApiThread): GmailThreadSummary {
  const messages = thread.messages ?? [];
  const latest = messages.at(-1);
  const payload = latest?.payload;
  const labelIds = Array.from(new Set(messages.flatMap((message) => message.labelIds ?? [])));
  const from =
    parseGmailAddresses(gmailHeader(payload?.headers, "From"))[0] ?? {
      email: "",
      name: "Remetente desconhecido"
    };
  const to = parseGmailAddresses(gmailHeader(payload?.headers, "To"));

  return {
    date:
      validInternalDate(latest?.internalDate) ||
      gmailHeader(payload?.headers, "Date") ||
      null,
    from,
    hasAttachment: messages.some((message) =>
      partHasAttachment(message.payload)
    ),
    id: thread.id,
    labelIds,
    messageCount: messages.length,
    snippet: decodeMimeHeader(thread.snippet ?? latest?.snippet),
    starred: labelIds.includes("STARRED"),
    subject: decodeMimeHeader(gmailHeader(payload?.headers, "Subject")) || "(sem assunto)",
    to,
    unread: labelIds.includes("UNREAD")
  };
}

function folderLabels(folder: GmailMailboxFolder, labelId?: string) {
  if (folder === "label") return labelId ? [safeGmailId(labelId, "label ID")] : [];
  if (folder === "unread") return ["INBOX"];
  return [folder.toUpperCase()];
}

export async function listGmailLabels(profileId: string): Promise<GmailLabel[]> {
  const cacheKey = `${profileId}:labels`;
  const existing = cached<GmailLabel[]>(cacheKey);
  if (existing) return existing;

  const { accessToken } = await mailboxAccess(profileId);
  const payload = await gmailRequest<{
    labels?: Array<{
      color?: { backgroundColor?: string; textColor?: string };
      id: string;
      labelListVisibility?: string;
      messageListVisibility?: string;
      messagesTotal?: number;
      messagesUnread?: number;
      name: string;
      threadsTotal?: number;
      threadsUnread?: number;
      type?: "system" | "user";
    }>;
  }>(accessToken, "/labels");

  const labels = (payload.labels ?? []).map((label) => ({
    color: label.color ?? null,
    id: label.id,
    labelListVisibility: label.labelListVisibility ?? null,
    messageListVisibility: label.messageListVisibility ?? null,
    messagesTotal: label.messagesTotal ?? null,
    messagesUnread: label.messagesUnread ?? null,
    name: label.name,
    threadsTotal: label.threadsTotal ?? null,
    threadsUnread: label.threadsUnread ?? null,
    type: label.type ?? "system"
  }));

  return storeCache(cacheKey, labels, 60_000);
}

export async function createGmailLabel(profileId: string, name: string) {
  const normalized = name.replace(/[\r\n]+/g, " ").trim().slice(0, 120);
  if (!normalized) throw new Error("Invalid Gmail label name");
  const { accessToken } = await mailboxAccess(profileId);
  const label = await gmailRequest<{ id: string; name: string }>(
    accessToken,
    "/labels",
    {
      body: JSON.stringify({
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
        name: normalized
      }),
      method: "POST"
    }
  );
  invalidateMailboxCache(profileId);
  return label;
}

export async function listGmailThreads({
  folder = "inbox",
  labelId,
  maxResults,
  pageToken,
  profileId,
  query
}: {
  folder?: GmailMailboxFolder;
  labelId?: string;
  maxResults?: number;
  pageToken?: string | null;
  profileId: string;
  query?: string;
}): Promise<GmailThreadPage> {
  const normalizedQuery = query?.trim().slice(0, 512) ?? "";
  const normalizedToken = safePageToken(pageToken);
  const labels = folderLabels(folder, labelId);
  const cacheKey = `${profileId}:threads:${folder}:${labels.join(",")}:${normalizedQuery}:${normalizedToken ?? ""}`;
  const existing = cached<GmailThreadPage>(cacheKey);
  if (existing) return existing;

  const { accessToken } = await mailboxAccess(profileId);
  const params = new URLSearchParams({
    maxResults: String(safePageSize(maxResults))
  });
  for (const label of labels) params.append("labelIds", label);
  if (normalizedToken) params.set("pageToken", normalizedToken);
  const gmailQuery = [folder === "unread" ? "is:unread" : "", normalizedQuery]
    .filter(Boolean)
    .join(" ");
  if (gmailQuery) params.set("q", gmailQuery);

  const payload = await gmailRequest<GmailListThreadResponse>(
    accessToken,
    `/threads?${params}`
  );
  const detailQuery = threadSummaryParams();
  const settledDetails = await Promise.allSettled(
    (payload.threads ?? []).map((thread) =>
      gmailRequest<GmailApiThread>(
        accessToken,
        `/threads/${safeGmailId(thread.id, "thread ID")}?${detailQuery}`
      )
    )
  );
  const details = settledDetails.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : []
  );
  if (!details.length && (payload.threads?.length ?? 0) > 0) {
    const firstFailure = settledDetails.find(
      (result) => result.status === "rejected"
    );
    if (firstFailure?.status === "rejected") throw firstFailure.reason;
  }
  const page = {
    nextPageToken: payload.nextPageToken ?? null,
    resultSizeEstimate: payload.resultSizeEstimate ?? null,
    threads: details.map(threadSummary)
  };

  return storeCache(cacheKey, page, 15_000);
}

export function searchGmailThreads(
  profileId: string,
  query: string,
  pageToken?: string | null
) {
  return listGmailThreads({
    folder: "inbox",
    pageToken,
    profileId,
    query
  });
}

export async function getGmailThread(profileId: string, threadId: string) {
  const { accessToken } = await mailboxAccess(profileId);
  const thread = await gmailRequest<GmailApiThread>(
    accessToken,
    `/threads/${safeGmailId(threadId, "thread ID")}?format=full`
  );

  try {
    return parseGmailThread(thread);
  } catch {
    throw new GmailMailboxError("sanitization_failed");
  }
}

export async function listGmailDrafts({
  maxResults,
  pageToken,
  profileId,
  query
}: {
  maxResults?: number;
  pageToken?: string | null;
  profileId: string;
  query?: string;
}): Promise<GmailDraftPage> {
  const normalizedQuery = query?.trim().slice(0, 512) ?? "";
  const normalizedToken = safePageToken(pageToken);
  const cacheKey = `${profileId}:drafts:${normalizedQuery}:${normalizedToken ?? ""}`;
  const existing = cached<GmailDraftPage>(cacheKey);
  if (existing) return existing;

  const { accessToken } = await mailboxAccess(profileId);
  const params = new URLSearchParams({ maxResults: String(safePageSize(maxResults)) });
  if (normalizedToken) params.set("pageToken", normalizedToken);
  if (normalizedQuery) params.set("q", normalizedQuery);
  const payload = await gmailRequest<GmailListDraftResponse>(
    accessToken,
    `/drafts?${params}`
  );
  const detailQuery = draftSummaryParams();
  const settledDrafts = await Promise.allSettled(
    (payload.drafts ?? []).map(async (draft) => {
      const detail = await gmailRequest<{ id: string; message: GmailApiMessage }>(
        accessToken,
        `/drafts/${safeGmailId(draft.id, "draft ID")}?${detailQuery}`
      );
      const summary = threadSummary({
        id: detail.message.threadId,
        messages: [detail.message],
        snippet: detail.message.snippet
      });
      return { ...summary, draftId: detail.id };
    })
  );
  const drafts = settledDrafts.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : []
  );
  if (!drafts.length && (payload.drafts?.length ?? 0) > 0) {
    const firstFailure = settledDrafts.find(
      (result) => result.status === "rejected"
    );
    if (firstFailure?.status === "rejected") throw firstFailure.reason;
  }
  const page = {
    drafts,
    nextPageToken: payload.nextPageToken ?? null,
    resultSizeEstimate: payload.resultSizeEstimate ?? null
  };

  return storeCache(cacheKey, page, 15_000);
}

export async function getGmailDraft(profileId: string, draftId: string) {
  const { accessToken } = await mailboxAccess(profileId);
  const draft = await gmailRequest<{ id: string; message: GmailApiMessage }>(
    accessToken,
    `/drafts/${safeGmailId(draftId, "draft ID")}?format=full`
  );
  return {
    id: draft.id,
    message: parseGmailMessage(draft.message)
  };
}

async function modifyThreadLabels(
  profileId: string,
  threadId: string,
  changes: { addLabelIds?: string[]; removeLabelIds?: string[] }
) {
  const { accessToken } = await mailboxAccess(profileId);
  await gmailRequest<GmailApiThread>(
    accessToken,
    `/threads/${safeGmailId(threadId, "thread ID")}/modify`,
    {
      body: JSON.stringify(changes),
      method: "POST"
    }
  );
  invalidateMailboxCache(profileId);
}

export function markThreadRead(profileId: string, threadId: string) {
  return modifyThreadLabels(profileId, threadId, { removeLabelIds: ["UNREAD"] });
}

export function markThreadUnread(profileId: string, threadId: string) {
  return modifyThreadLabels(profileId, threadId, { addLabelIds: ["UNREAD"] });
}

export function starThread(profileId: string, threadId: string) {
  return modifyThreadLabels(profileId, threadId, { addLabelIds: ["STARRED"] });
}

export function unstarThread(profileId: string, threadId: string) {
  return modifyThreadLabels(profileId, threadId, { removeLabelIds: ["STARRED"] });
}

export function archiveThread(profileId: string, threadId: string) {
  return modifyThreadLabels(profileId, threadId, { removeLabelIds: ["INBOX"] });
}

export async function trashThread(profileId: string, threadId: string) {
  const { accessToken } = await mailboxAccess(profileId);
  await gmailRequest<GmailApiThread>(
    accessToken,
    `/threads/${safeGmailId(threadId, "thread ID")}/trash`,
    { method: "POST" }
  );
  invalidateMailboxCache(profileId);
}

export async function untrashThread(profileId: string, threadId: string) {
  const { accessToken } = await mailboxAccess(profileId);
  await gmailRequest<GmailApiThread>(
    accessToken,
    `/threads/${safeGmailId(threadId, "thread ID")}/untrash`,
    { method: "POST" }
  );
  invalidateMailboxCache(profileId);
}

function rawOutgoingMessage(message: GmailOutgoingMessage) {
  return base64Url(
    rfc2822Message({
      ...message,
      from: aroGoogleEmail
    })
  );
}

export async function createGmailDraft(
  profileId: string,
  message: GmailOutgoingMessage
) {
  const { accessToken } = await mailboxAccess(profileId);
  const draft = await gmailRequest<{ id: string; message?: GmailApiMessage }>(
    accessToken,
    "/drafts",
    {
      body: JSON.stringify({
        message: {
          raw: rawOutgoingMessage(message),
          ...(message.threadId ? { threadId: message.threadId } : {})
        }
      }),
      method: "POST"
    }
  );
  invalidateMailboxCache(profileId);
  return draft;
}

export async function updateGmailDraft(
  profileId: string,
  draftId: string,
  message: GmailOutgoingMessage
) {
  const { accessToken } = await mailboxAccess(profileId);
  const draft = await gmailRequest<{ id: string; message?: GmailApiMessage }>(
    accessToken,
    `/drafts/${safeGmailId(draftId, "draft ID")}`,
    {
      body: JSON.stringify({
        id: draftId,
        message: {
          raw: rawOutgoingMessage(message),
          ...(message.threadId ? { threadId: message.threadId } : {})
        }
      }),
      method: "PUT"
    }
  );
  invalidateMailboxCache(profileId);
  return draft;
}

export async function sendGmailDraft(profileId: string, draftId: string) {
  const { accessToken } = await mailboxAccess(profileId);
  const sent = await gmailRequest<GmailApiMessage>(accessToken, "/drafts/send", {
    body: JSON.stringify({ id: safeGmailId(draftId, "draft ID") }),
    method: "POST"
  });
  invalidateMailboxCache(profileId);
  return sent;
}

export async function trashGmailDraft(profileId: string, draftId: string) {
  const draft = await getGmailDraft(profileId, draftId);
  const { accessToken } = await mailboxAccess(profileId);
  await gmailRequest<GmailApiMessage>(
    accessToken,
    `/messages/${safeGmailId(draft.message.id, "message ID")}/trash`,
    { method: "POST" }
  );
  invalidateMailboxCache(profileId);
}

function replyHeaders(message: GmailParsedMessage) {
  const references = [message.references, message.messageId].filter(Boolean).join(" ");
  return {
    inReplyTo: message.messageId ?? undefined,
    references: references || undefined
  };
}

export async function replyToGmailThread(
  profileId: string,
  threadId: string,
  message: Omit<GmailOutgoingMessage, "threadId"> & { replyAll?: boolean }
) {
  const thread = await getGmailThread(profileId, threadId);
  const latest = thread.messages.at(-1);
  if (!latest) throw new GmailMailboxError("not_found");
  const to = message.to || latest.from.email;
  const cc = message.replyAll
    ? Array.from(
        new Set(
          [...latest.to, ...latest.cc]
            .map((address) => address.email)
            .filter((email) => email && email !== "claudio@arolab.co" && email !== to)
        )
      ).join(", ")
    : message.cc;

  return createGmailDraft(profileId, {
    ...message,
    ...replyHeaders(latest),
    cc,
    subject: /^re:/i.test(message.subject) ? message.subject : `Re: ${message.subject}`,
    threadId,
    to
  });
}

export async function forwardGmailMessage(
  profileId: string,
  messageId: string,
  message: GmailOutgoingMessage
) {
  const { accessToken } = await mailboxAccess(profileId);
  await gmailRequest<GmailApiMessage>(
    accessToken,
    `/messages/${safeGmailId(messageId, "message ID")}?format=metadata`
  );

  return createGmailDraft(profileId, {
    ...message,
    subject: /^fwd:/i.test(message.subject) ? message.subject : `Fwd: ${message.subject}`
  });
}

export async function getGmailAttachment(
  profileId: string,
  messageId: string,
  attachmentId: string
) {
  const { accessToken } = await mailboxAccess(profileId);
  const message = await gmailRequest<GmailApiMessage>(
    accessToken,
    `/messages/${safeGmailId(messageId, "message ID")}?format=full`
  );
  const parsed = parseGmailMessage(message);
  const metadata = parsed.attachments.find(
    (attachment) => attachment.attachmentId === attachmentId
  );
  if (!metadata || metadata.size > maxAttachmentBytes) {
    throw new GmailMailboxError("attachment_unavailable");
  }
  const payload = await gmailRequest<{ data?: string; size?: number }>(
    accessToken,
    `/messages/${safeGmailId(messageId, "message ID")}/attachments/${safeGmailId(attachmentId, "attachment ID")}`
  );
  const raw = payload.data?.replace(/-/g, "+").replace(/_/g, "/") ?? "";
  const binary = Buffer.from(raw, "base64");
  if (binary.byteLength > maxAttachmentBytes) {
    throw new GmailMailboxError("attachment_unavailable");
  }

  return {
    buffer: binary,
    filename: sanitizeAttachmentFilename(metadata.filename),
    mimeType: sanitizeAttachmentMimeType(metadata.mimeType),
    size: binary.byteLength
  };
}
