import { randomUUID } from "node:crypto";
import { requireRole } from "@/lib/auth";
import {
  EmailWebmailShell,
  type EmailComposerInitial,
  type EmailWebmailFolder,
  type EmailWebmailThread
} from "@/components/admin/email-center/email-webmail-shell";
import {
  listEmailRecipientOptions
} from "@/lib/communications/email-center";
import {
  getGoogleConnection,
  listEmailTemplates,
  listOutboundEmails,
  listPresentations,
  type OutboundEmail
} from "@/lib/communications/data";
import {
  getGmailDraft,
  getGmailThread,
  GmailMailboxError,
  gmailMailboxErrorMessage,
  listGmailDrafts,
  listGmailLabels,
  listGmailThreads,
  type GmailDraftSummary,
  type GmailLabel,
  type GmailMailboxErrorCode,
  type GmailThreadSummary
} from "@/lib/communications/gmail-mailbox-server";
import {
  hasGoogleMailboxScope
} from "@/lib/communications/google-workspace";
import { getEmailOperationalState } from "@/lib/communications/operational-state-server";

export type EmailWebmailSearchParams = {
  bcc?: string;
  cc?: string;
  error?: string;
  folder?: string;
  label?: string;
  message?: string;
  mode?: string;
  notice?: string;
  pageToken?: string;
  q?: string;
  subject?: string;
  thread?: string;
  to?: string;
};

type EmailWebmailPageProps = {
  currentFolder?: EmailWebmailFolder;
  currentLabelId?: string | null;
  draftId?: string | null;
  mode?: "compose" | "folder" | "thread";
  searchParams?: EmailWebmailSearchParams;
  threadId?: string | null;
};

function connectionProblem(
  status: string | null | undefined,
  scopes: string[] | null | undefined
): GmailMailboxErrorCode | null {
  if (!status) return "disconnected";
  if (status === "revoked") return "token_revoked";
  if (status !== "connected") return "refresh_failed";
  if (!hasGoogleMailboxScope(scopes)) return "insufficient_scope";
  return null;
}

function asMailboxError(error: unknown): GmailMailboxErrorCode {
  if (error instanceof GmailMailboxError) return error.code;
  return "unavailable";
}

function safeFolder(value: string | null | undefined): EmailWebmailFolder {
  if (
    value &&
    ["inbox", "sent", "drafts", "scheduled", "trash", "starred", "label"].includes(value)
  ) {
    return value as EmailWebmailFolder;
  }
  return "inbox";
}

function composerFromQuery(query: EmailWebmailSearchParams): EmailComposerInitial {
  const mode =
    query.mode === "reply" || query.mode === "reply-all" || query.mode === "forward"
      ? query.mode
      : "compose";
  const rawSubject = query.subject?.slice(0, 240) ?? "";
  const subject =
    mode === "reply" || mode === "reply-all"
      ? /^re:/i.test(rawSubject)
        ? rawSubject
        : `Re: ${rawSubject}`
      : mode === "forward"
        ? /^fwd:/i.test(rawSubject)
          ? rawSubject
          : `Fwd: ${rawSubject}`
        : rawSubject;

  return {
    bcc: query.bcc?.slice(0, 600),
    cc: query.cc?.slice(0, 600),
    mode,
    recipient: query.to?.slice(0, 320),
    subject,
    threadId: query.thread?.slice(0, 200)
  };
}

export async function EmailWebmailPage({
  currentFolder: requestedFolder = "inbox",
  currentLabelId = null,
  draftId = null,
  mode = "folder",
  searchParams = {},
  threadId = null
}: EmailWebmailPageProps) {
  const profile = await requireRole(["admin"]);
  const query = searchParams.q?.trim().slice(0, 512) ?? "";
  const pageToken = searchParams.pageToken?.slice(0, 2048) ?? null;
  const currentFolder =
    mode === "thread" ? safeFolder(searchParams.folder) : requestedFolder;
  const activeLabelId =
    currentFolder === "label"
      ? currentLabelId || searchParams.label?.slice(0, 200) || null
      : null;
  const [connectionResult, operationalResult, scheduledResult] =
    await Promise.allSettled([
      getGoogleConnection(profile.id),
      getEmailOperationalState(profile.id),
      listOutboundEmails("scheduled")
    ]);
  const connection =
    connectionResult.status === "fulfilled" ? connectionResult.value : null;
  const operationalState =
    operationalResult.status === "fulfilled"
      ? operationalResult.value
      : {
          accountConnected: false,
          connectedEmail: null,
          externalOperationsAllowed: false,
          externalSendEnabled: false,
          gmailApiConfigured: false,
          lastErrorCode: null,
          lastErrorMessage: null,
          mailboxAuthorized: false,
          schedulingOperational: false
        };
  const scheduledEmails: OutboundEmail[] =
    scheduledResult.status === "fulfilled" ? scheduledResult.value : [];
  let connectionCode = connectionProblem(connection?.status, connection?.scopes);
  let labels: GmailLabel[] = [];
  let threads: GmailThreadSummary[] = [];
  let drafts: GmailDraftSummary[] = [];
  let nextPageToken: string | null = null;
  let resultSizeEstimate: number | null = null;
  let selectedThread: EmailWebmailThread | null = null;
  let selectedDraftId: string | null = draftId;

  if (!connectionCode) {
    const mailboxPromises: Array<Promise<unknown>> = [
      listGmailLabels(profile.id)
    ];
    if (currentFolder === "drafts") {
      mailboxPromises.push(
        listGmailDrafts({
          pageToken,
          profileId: profile.id,
          query
        })
      );
    } else if (currentFolder !== "scheduled") {
      mailboxPromises.push(
        listGmailThreads({
          folder: currentFolder === "label" ? "label" : currentFolder,
          labelId: activeLabelId ?? undefined,
          pageToken,
          profileId: profile.id,
          query
        })
      );
    }
    if (threadId) mailboxPromises.push(getGmailThread(profile.id, threadId));

    const settled = await Promise.allSettled(mailboxPromises);
    const labelsResult = settled[0];
    if (labelsResult.status === "fulfilled") {
      labels = labelsResult.value as GmailLabel[];
    } else {
      connectionCode = asMailboxError(labelsResult.reason);
    }

    const listResult = settled[1];
    if (listResult?.status === "fulfilled") {
      if (currentFolder === "drafts") {
        const page = listResult.value as Awaited<ReturnType<typeof listGmailDrafts>>;
        drafts = page.drafts;
        nextPageToken = page.nextPageToken;
        resultSizeEstimate = page.resultSizeEstimate;
      } else if (currentFolder !== "scheduled") {
        const page = listResult.value as Awaited<ReturnType<typeof listGmailThreads>>;
        threads = page.threads;
        nextPageToken = page.nextPageToken;
        resultSizeEstimate = page.resultSizeEstimate;
      }
    } else if (listResult?.status === "rejected") {
      connectionCode = asMailboxError(listResult.reason);
    }

    const threadResult = threadId ? settled.at(-1) : null;
    if (threadId && threadResult?.status === "fulfilled") {
      selectedThread = threadResult.value as EmailWebmailThread;
    } else if (threadId && threadResult?.status === "rejected") {
      connectionCode = asMailboxError(threadResult.reason);
    }
  }

  if (currentFolder === "scheduled") {
    threads = scheduledEmails.map((email) => ({
      date: email.created_at,
      from: { email: "claudio@arolab.co", name: "ARO" },
      hasAttachment: false,
      id: email.id,
      labelIds: [],
      messageCount: 1,
      snippet: "Envio agendado pelo sistema ARO.",
      starred: false,
      subject: email.subject,
      to: [{ email: email.recipient_email, name: email.recipient_name || email.recipient_email }],
      unread: false
    }));
    resultSizeEstimate = scheduledEmails.length;
  }

  let composer: {
    idempotencyKey: string;
    initial: EmailComposerInitial;
    presentations: Awaited<ReturnType<typeof listPresentations>>;
    recipients: Awaited<ReturnType<typeof listEmailRecipientOptions>>;
    templates: Awaited<ReturnType<typeof listEmailTemplates>>;
  } | null = null;

  if (mode === "compose" || draftId) {
    const initial = composerFromQuery(searchParams);
    const [
      recipientsResult,
      templatesResult,
      presentationsResult,
      draftResult,
      relatedThreadResult
    ] =
      await Promise.allSettled([
        listEmailRecipientOptions(),
        listEmailTemplates(),
        listPresentations(),
        draftId && !connectionCode
          ? getGmailDraft(profile.id, draftId)
          : Promise.resolve(null),
        initial.threadId && initial.mode === "forward" && !connectionCode
          ? getGmailThread(profile.id, initial.threadId)
          : Promise.resolve(null)
      ]);

    if (draftResult.status === "fulfilled" && draftResult.value) {
      const draft = draftResult.value;
      initial.bcc = draft.message.bcc.map((address) => address.email).join(", ");
      initial.bodyHtml = draft.message.html;
      initial.bodyText = draft.message.text;
      initial.cc = draft.message.cc.map((address) => address.email).join(", ");
      initial.draftId = draft.id;
      initial.mode = draft.message.inReplyTo ? "reply" : "compose";
      initial.recipient = draft.message.to[0]?.email ?? "";
      initial.subject = draft.message.subject;
      initial.threadId = draft.message.threadId;
      selectedDraftId = draft.id;
    } else if (draftResult.status === "rejected") {
      connectionCode = asMailboxError(draftResult.reason);
    } else if (
      relatedThreadResult.status === "fulfilled" &&
      relatedThreadResult.value &&
      initial.mode === "forward"
    ) {
      const source =
        relatedThreadResult.value.messages.find(
          (message) => message.id === searchParams.message
        ) ?? relatedThreadResult.value.messages.at(-1);
      if (source) {
        initial.bodyText = [
          "",
          "",
          "---------- Mensagem encaminhada ----------",
          `De: ${source.from.name || source.from.email} <${source.from.email}>`,
          `Data: ${source.date || source.internalDate || "—"}`,
          `Assunto: ${source.subject}`,
          `Para: ${source.to.map((address) => address.email).join(", ") || "—"}`,
          "",
          source.text
        ].join("\n");
      }
    }

    composer = {
      idempotencyKey: randomUUID(),
      initial,
      presentations:
        presentationsResult.status === "fulfilled" ? presentationsResult.value : [],
      recipients:
        recipientsResult.status === "fulfilled" ? recipientsResult.value : [],
      templates:
        templatesResult.status === "fulfilled" ? templatesResult.value : []
    };
  }

  const message = connectionCode
    ? gmailMailboxErrorMessage(connectionCode)
    : searchParams.error
      ? "A operação não foi concluída. Revise os dados e tente novamente."
      : null;

  return (
    <EmailWebmailShell
      composer={composer}
      connection={{
        code: connectionCode,
        connectedEmail: connection?.connected_email ?? null,
        lastSyncAt: connection?.last_used_at ?? null,
        message
      }}
      currentFolder={currentFolder}
      currentLabelId={activeLabelId}
      drafts={drafts}
      labels={labels}
      nextPageToken={nextPageToken}
      operationalState={operationalState}
      pageToken={pageToken}
      query={query}
      resultSizeEstimate={resultSizeEstimate}
      scheduledEmails={scheduledEmails}
      selectedDraftId={selectedDraftId}
      selectedThread={selectedThread}
      selectedThreadId={threadId}
      threads={threads}
    />
  );
}
