"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Inbox,
  Mail,
  MoreHorizontal,
  Paperclip,
  Plus,
  RefreshCw,
  Reply,
  Search,
  Send,
  Star,
  Trash2,
  X
} from "@/components/admin/admin-icons";
import {
  createGmailLabelAction,
  gmailThreadAction,
  markOpenedThreadReadAction,
  saveGmailDraftAction,
  scheduleWebmailMessageAction,
  sendWebmailMessageAction,
  trashGmailDraftAction
} from "@/app/admin/email/mailbox-actions";
import type {
  GmailDraftSummary,
  GmailLabel,
  GmailMailboxErrorCode,
  GmailThreadSummary
} from "@/lib/communications/gmail-mailbox-server";
import type {
  GmailParsedMessage
} from "@/lib/communications/gmail-message";
import type {
  EmailRecipientOption
} from "@/lib/communications/email-center";
import type {
  EmailTemplate,
  OutboundEmail,
  Presentation
} from "@/lib/communications/data";
import type {
  EmailPresentationPreview
} from "@/lib/communications/presentation-preview-server";
import type {
  EmailOperationalState
} from "@/lib/communications/email-operations";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode
} from "react";

export type EmailWebmailFolder =
  | "inbox"
  | "sent"
  | "drafts"
  | "scheduled"
  | "trash"
  | "starred"
  | "label";

export type EmailWebmailThread = {
  historyId: string | null;
  id: string;
  messages: GmailParsedMessage[];
  snippet: string;
  subject: string;
};

export type EmailComposerInitial = {
  bcc?: string;
  bodyHtml?: string;
  bodyText?: string;
  cc?: string;
  draftId?: string;
  mode?: "compose" | "forward" | "reply" | "reply-all";
  recipient?: string;
  recipientName?: string;
  subject?: string;
  threadId?: string;
};

type EmailWebmailShellProps = {
  composer?: {
    idempotencyKey: string;
    initial: EmailComposerInitial;
    presentations: Presentation[];
    recipients: EmailRecipientOption[];
    templates: EmailTemplate[];
  } | null;
  connection: {
    code: GmailMailboxErrorCode | null;
    connectedEmail: string | null;
    lastSyncAt: string | null;
    message: string | null;
  };
  currentFolder: EmailWebmailFolder;
  currentLabelId?: string | null;
  drafts: GmailDraftSummary[];
  labels: GmailLabel[];
  nextPageToken: string | null;
  operationalState: EmailOperationalState;
  pageToken: string | null;
  query: string;
  resultSizeEstimate: number | null;
  scheduledEmails: OutboundEmail[];
  selectedDraftId?: string | null;
  selectedThread: EmailWebmailThread | null;
  selectedThreadId?: string | null;
  threads: GmailThreadSummary[];
};

const folderDefinitions: Array<{
  folder: EmailWebmailFolder;
  href: string;
  icon: typeof Inbox;
  label: string;
  systemLabel?: string;
}> = [
  { folder: "inbox", href: "/admin/email/inbox", icon: Inbox, label: "Caixa de entrada", systemLabel: "INBOX" },
  { folder: "sent", href: "/admin/email/sent", icon: Send, label: "Enviados", systemLabel: "SENT" },
  { folder: "drafts", href: "/admin/email/drafts", icon: FileText, label: "Rascunhos", systemLabel: "DRAFT" },
  { folder: "scheduled", href: "/admin/email/scheduled", icon: Clock3, label: "Agendados" },
  { folder: "trash", href: "/admin/email/trash", icon: Trash2, label: "Lixeira", systemLabel: "TRASH" },
  { folder: "starred", href: "/admin/email/starred", icon: Star, label: "Com estrela", systemLabel: "STARRED" }
];

function initials(value: string) {
  return (
    value
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "AR"
  );
}

function formatMailboxDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const now = new Date();
  const sameDay = date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) ===
    now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return new Intl.DateTimeFormat("pt-BR", {
    ...(sameDay
      ? { hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "short" }),
    timeZone: "America/Sao_Paulo"
  }).format(date);
}

function addressLine(addresses: GmailParsedMessage["to"]) {
  return addresses.map((address) => address.name || address.email).join(", ") || "—";
}

function countForLabel(labels: GmailLabel[], id: string | undefined) {
  if (!id) return null;
  const label = labels.find((item) => item.id === id);
  if (!label) return null;
  return label.threadsUnread ?? label.messagesUnread ?? label.threadsTotal ?? label.messagesTotal;
}

function countLabel(value: number | null) {
  return value === null ? "—" : value > 999 ? "999+" : String(value);
}

function folderTitle(folder: EmailWebmailFolder, labels: GmailLabel[], labelId?: string | null) {
  if (folder === "label") {
    return labels.find((label) => label.id === labelId)?.name ?? "Pasta";
  }
  return folderDefinitions.find((item) => item.folder === folder)?.label ?? "Email Center";
}

function mailboxHref({
  folder,
  labelId,
  query,
  threadId
}: {
  folder: EmailWebmailFolder;
  labelId?: string | null;
  query?: string;
  threadId?: string;
}) {
  const base = threadId
    ? `/admin/email/thread/${encodeURIComponent(threadId)}`
    : folder === "label" && labelId
      ? `/admin/email/label/${encodeURIComponent(labelId)}`
      : `/admin/email/${folder}`;
  const params = new URLSearchParams();
  if (threadId) {
    params.set("folder", folder);
    if (labelId) params.set("label", labelId);
  }
  if (query) params.set("q", query);
  const serialized = params.toString();
  return `${base}${serialized ? `?${serialized}` : ""}`;
}

function EmailMailboxNav({
  connection,
  currentFolder,
  currentLabelId,
  labels,
  scheduledCount
}: Pick<
  EmailWebmailShellProps,
  "connection" | "currentFolder" | "currentLabelId" | "labels"
> & { scheduledCount: number }) {
  const customLabels = labels
    .filter((label) => label.type === "user" && label.labelListVisibility !== "labelHide")
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));

  return (
    <aside className="email-mailbox-nav" aria-label="Pastas do Email Center">
      <div className="email-mailbox-heading">
        <div>
          <span>Webmail ARO</span>
          <strong>Email Center</strong>
        </div>
        <Link aria-label="Criar novo e-mail" href="/admin/email/compose">
          <Plus />
        </Link>
      </div>
      <Link className="email-new-message" href="/admin/email/compose">
        <Plus />
        <span>Novo e-mail</span>
        <ChevronDownMark />
      </Link>
      <nav className="email-folder-links">
        {folderDefinitions.map((item) => {
          const Icon = item.icon;
          const count =
            item.folder === "scheduled"
              ? scheduledCount
              : countForLabel(labels, item.systemLabel);
          return (
            <Link
              aria-current={currentFolder === item.folder ? "page" : undefined}
              className={currentFolder === item.folder ? "active" : ""}
              href={item.href}
              key={item.folder}
            >
              <Icon />
              <span>{item.label}</span>
              <em>{countLabel(count)}</em>
            </Link>
          );
        })}
      </nav>
      <div className="email-custom-folders">
        <header>
          <span>Pastas</span>
          <details>
            <summary aria-label="Criar pasta"><Plus /></summary>
            <form action={createGmailLabelAction}>
              <label>
                Nome da pasta
                <input maxLength={120} name="label_name" required />
              </label>
              <button type="submit">Criar</button>
            </form>
          </details>
        </header>
        <nav>
          {customLabels.length ? (
            customLabels.map((label) => (
              <Link
                aria-current={
                  currentFolder === "label" && currentLabelId === label.id
                    ? "page"
                    : undefined
                }
                className={
                  currentFolder === "label" && currentLabelId === label.id
                    ? "active"
                    : ""
                }
                href={`/admin/email/label/${encodeURIComponent(label.id)}`}
                key={label.id}
              >
                <FolderMark />
                <span>{label.name}</span>
                <em>{countLabel(label.threadsUnread ?? label.messagesUnread)}</em>
              </Link>
            ))
          ) : (
            <p>Nenhuma label personalizada.</p>
          )}
        </nav>
      </div>
      <div className="email-storage-status">
        <span>Sincronização</span>
        <strong>{connection.code ? "Ação necessária" : "Gmail conectado"}</strong>
        <small>
          {connection.lastSyncAt
            ? `Atualizado ${formatMailboxDate(connection.lastSyncAt)}`
            : "Atualização sob demanda"}
        </small>
        <div aria-hidden="true"><span /></div>
        <small>Armazenamento gerenciado pelo Google</small>
      </div>
    </aside>
  );
}

function ChevronDownMark() {
  return <span aria-hidden="true" className="email-chevron-down">⌄</span>;
}

function FolderMark() {
  return <span aria-hidden="true" className="email-folder-mark" />;
}

function ThreadRow({
  currentFolder,
  currentLabelId,
  draft,
  query,
  selected,
  thread
}: {
  currentFolder: EmailWebmailFolder;
  currentLabelId?: string | null;
  draft?: GmailDraftSummary;
  query: string;
  selected: boolean;
  thread: GmailThreadSummary;
}) {
  const sent = currentFolder === "sent";
  const display = sent
    ? thread.to[0]?.name || thread.to[0]?.email || "Destinatário"
    : thread.from.name || thread.from.email;
  const href = draft
    ? `/admin/email/draft/${encodeURIComponent(draft.draftId)}`
    : currentFolder === "scheduled"
      ? `/admin/email/${encodeURIComponent(thread.id)}`
    : mailboxHref({
        folder: currentFolder,
        labelId: currentLabelId,
        query,
        threadId: thread.id
      });

  return (
    <Link
      className={[
        "email-thread-row",
        selected ? "selected" : "",
        thread.unread ? "unread" : ""
      ].filter(Boolean).join(" ")}
      href={href}
    >
      <span className="email-thread-avatar">{initials(display)}</span>
      <span className="email-thread-copy">
        <span>
          <strong>{display}</strong>
          <time>{formatMailboxDate(thread.date)}</time>
        </span>
        <b>{thread.subject}</b>
        <small>{thread.snippet || "Sem prévia de texto."}</small>
      </span>
      <span className="email-thread-signals">
        {thread.hasAttachment ? <Paperclip aria-label="Possui anexo" /> : null}
        {/apresenta(?:ção|cao)|casting|portfolio/i.test(thread.subject) ? (
          <FileText aria-label="Comunicação de apresentação" />
        ) : null}
        {thread.starred ? <Star aria-label="Com estrela" /> : null}
        {thread.unread ? <i aria-label="Não lida" /> : null}
      </span>
    </Link>
  );
}

function EmailThreadList({
  currentFolder,
  currentLabelId,
  drafts,
  nextPageToken,
  pageToken,
  query,
  resultSizeEstimate,
  labels,
  selectedDraftId,
  selectedThreadId,
  threads
}: Pick<
  EmailWebmailShellProps,
  | "currentFolder"
  | "currentLabelId"
  | "drafts"
  | "nextPageToken"
  | "pageToken"
  | "query"
  | "resultSizeEstimate"
  | "labels"
  | "selectedDraftId"
  | "selectedThreadId"
  | "threads"
>) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(query);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSearch(query);
  }, [query]);

  useEffect(() => {
    if (search === query) return;
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (search.trim()) params.set("q", search.trim());
      else params.delete("q");
      params.delete("pageToken");
      startTransition(() => {
        router.replace(`${pathname}${params.size ? `?${params}` : ""}`);
      });
    }, 360);
    return () => window.clearTimeout(timeout);
  }, [pathname, query, router, search, searchParams]);

  const rows = currentFolder === "drafts" ? drafts : threads;
  const title = folderTitle(currentFolder, labels, currentLabelId);

  function pageHref(token: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("pageToken", token);
    return `${pathname}?${params}`;
  }

  return (
    <section className="email-thread-list" aria-label={`Conversas de ${title}`}>
      <header className="email-list-tabs">
        <div>
          <strong>{title}</strong>
          <span>{resultSizeEstimate === null ? "—" : resultSizeEstimate} conversa(s)</span>
        </div>
        <div role="tablist" aria-label="Filtro de leitura">
          <Link
            aria-selected={!query.includes("is:unread")}
            href={mailboxHref({ folder: currentFolder, labelId: currentLabelId })}
            role="tab"
          >
            Todas
          </Link>
          <Link
            aria-selected={query.includes("is:unread")}
            href={mailboxHref({
              folder: currentFolder,
              labelId: currentLabelId,
              query: "is:unread"
            })}
            role="tab"
          >
            Não lidas
          </Link>
        </div>
      </header>
      <label className={`email-thread-search ${isPending ? "loading" : ""}`}>
        <Search />
        <input
          aria-label="Buscar e-mails com a sintaxe do Gmail"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar e-mails"
          value={search}
        />
        {search ? (
          <button aria-label="Limpar busca" onClick={() => setSearch("")} type="button">
            <X />
          </button>
        ) : null}
      </label>
      <div className="email-thread-scroll">
        {rows.length ? (
          currentFolder === "drafts"
            ? drafts.map((draft) => (
                <ThreadRow
                  currentFolder={currentFolder}
                  draft={draft}
                  key={draft.draftId}
                  query={query}
                  selected={selectedDraftId === draft.draftId}
                  thread={draft}
                />
              ))
            : threads.map((thread) => (
                <ThreadRow
                  currentFolder={currentFolder}
                  currentLabelId={currentLabelId}
                  key={thread.id}
                  query={query}
                  selected={selectedThreadId === thread.id}
                  thread={thread}
                />
              ))
        ) : (
          <div className="email-empty-list">
            <Mail />
            <strong>Nenhuma conversa nesta visualização</strong>
            <span>Os dados são carregados diretamente da conta Gmail conectada.</span>
          </div>
        )}
      </div>
      <footer className="email-list-pagination">
        <span>{rows.length} nesta página</span>
        <div>
          <button
            aria-label="Voltar à página anterior"
            disabled={!pageToken}
            onClick={() => router.back()}
            type="button"
          >
            <ChevronLeft />
          </button>
          {nextPageToken ? (
            <Link aria-label="Abrir próxima página" href={pageHref(nextPageToken)}>
              <ChevronRight />
            </Link>
          ) : (
            <button aria-label="Não há próxima página" disabled type="button">
              <ChevronRight />
            </button>
          )}
        </div>
      </footer>
    </section>
  );
}

function ThreadAction({
  children,
  confirmMessage,
  label,
  operation,
  returnTo,
  threadId
}: {
  children: ReactNode;
  confirmMessage?: string;
  label: string;
  operation: string;
  returnTo: string;
  threadId: string;
}) {
  return (
    <form
      action={gmailThreadAction}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      <input name="operation" type="hidden" value={operation} />
      <input name="return_to" type="hidden" value={returnTo} />
      <input name="thread_id" type="hidden" value={threadId} />
      <button aria-label={label} title={label} type="submit">{children}</button>
    </form>
  );
}

function EmailThreadViewer({
  currentFolder,
  selectedThread
}: {
  currentFolder: EmailWebmailFolder;
  selectedThread: EmailWebmailThread;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openedReadRef = useRef<string | null>(null);
  const [, startReadTransition] = useTransition();
  const returnTo = `${pathname}${searchParams.size ? `?${searchParams}` : ""}`;
  const latest = selectedThread.messages.at(-1);
  const starred = selectedThread.messages.some((message) =>
    message.labelIds.includes("STARRED")
  );
  const unread = selectedThread.messages.some((message) =>
    message.labelIds.includes("UNREAD")
  );

  useEffect(() => {
    if (!unread || openedReadRef.current === selectedThread.id) return;
    openedReadRef.current = selectedThread.id;
    startReadTransition(async () => {
      try {
        await markOpenedThreadReadAction(selectedThread.id);
        router.refresh();
      } catch {
        openedReadRef.current = null;
      }
    });
  }, [router, selectedThread.id, unread]);
  const replyParams = new URLSearchParams({
    mode: "reply",
    subject: latest?.subject ?? selectedThread.subject,
    thread: selectedThread.id,
    to: latest?.from.email ?? ""
  });
  const replyAllCc = Array.from(
    new Set(
      [...(latest?.to ?? []), ...(latest?.cc ?? [])]
        .map((address) => address.email)
        .filter(
          (email) =>
            email &&
            email.toLowerCase() !== "claudio@arolab.co" &&
            email.toLowerCase() !== latest?.from.email.toLowerCase()
        )
    )
  ).join(", ");
  const replyAllParams = new URLSearchParams({
    cc: replyAllCc,
    mode: "reply-all",
    subject: latest?.subject ?? selectedThread.subject,
    thread: selectedThread.id,
    to: latest?.from.email ?? ""
  });
  const forwardParams = new URLSearchParams({
    message: latest?.id ?? "",
    mode: "forward",
    subject: latest?.subject ?? selectedThread.subject,
    thread: selectedThread.id
  });

  return (
    <article className="email-thread-viewer">
      <header className="email-content-toolbar">
        <div>
          <Link aria-label="Voltar para a pasta" href={`/admin/email/${currentFolder}`}>
            <ChevronLeft />
          </Link>
          <strong>{selectedThread.subject}</strong>
          <span>{selectedThread.messages.length} mensagem(ns)</span>
        </div>
        <div>
          <ThreadAction
            label={starred ? "Remover estrela" : "Adicionar estrela"}
            operation={starred ? "unstar" : "star"}
            returnTo={returnTo}
            threadId={selectedThread.id}
          >
            <Star />
          </ThreadAction>
          <ThreadAction
            label="Arquivar"
            operation="archive"
            returnTo="/admin/email/inbox"
            threadId={selectedThread.id}
          >
            <Archive />
          </ThreadAction>
          <ThreadAction
            label={unread ? "Marcar como lida" : "Marcar como não lida"}
            operation={unread ? "read" : "unread"}
            returnTo={returnTo}
            threadId={selectedThread.id}
          >
            <Mail />
          </ThreadAction>
          {currentFolder === "trash" ? (
            <ThreadAction
              label="Restaurar da lixeira"
              operation="untrash"
              returnTo="/admin/email/inbox"
              threadId={selectedThread.id}
            >
              <RefreshCw />
            </ThreadAction>
          ) : (
            <ThreadAction
              confirmMessage="Mover esta conversa para a lixeira?"
              label="Mover para a lixeira"
              operation="trash"
              returnTo="/admin/email/trash"
              threadId={selectedThread.id}
            >
              <Trash2 />
            </ThreadAction>
          )}
          <button aria-label="Mais opções" disabled title="Mais opções" type="button">
            <MoreHorizontal />
          </button>
        </div>
      </header>
      <div className="email-message-stack">
        {selectedThread.messages.map((message, index) => (
          <details className="email-message" key={message.id} open={index === selectedThread.messages.length - 1}>
            <summary>
              <span className="email-message-avatar">{initials(message.from.name || message.from.email)}</span>
              <span>
                <strong>{message.from.name || message.from.email}</strong>
                <small>para {addressLine(message.to)}</small>
              </span>
              <time>{formatMailboxDate(message.internalDate || message.date)}</time>
              <ChevronDownMark />
            </summary>
            <div className="email-message-meta">
              <span>De</span><strong>{message.from.email}</strong>
              <span>Para</span><strong>{addressLine(message.to)}</strong>
              {message.cc.length ? <><span>CC</span><strong>{addressLine(message.cc)}</strong></> : null}
            </div>
            {message.hasRemoteContent ? (
              <div className="email-remote-content-notice">
                Imagens remotas e rastreadores foram bloqueados para sua segurança.
              </div>
            ) : null}
            {message.html ? (
              <div
                className="email-message-body"
                dangerouslySetInnerHTML={{ __html: message.html }}
              />
            ) : (
              <pre className="email-message-text">{message.text}</pre>
            )}
            {message.attachments.length ? (
              <div className="email-attachments">
                {message.attachments.map((attachment) =>
                  attachment.attachmentId ? (
                    <a
                      href={`/api/admin/email/attachments/${encodeURIComponent(message.id)}/${encodeURIComponent(attachment.attachmentId)}`}
                      key={`${message.id}:${attachment.partId}:${attachment.filename}`}
                    >
                      <Paperclip />
                      <span>
                        <strong>{attachment.filename}</strong>
                        <small>{attachment.mimeType}</small>
                      </span>
                    </a>
                  ) : (
                    <span key={`${message.id}:${attachment.partId}:${attachment.filename}`}>
                      <Paperclip />
                      <span>
                        <strong>{attachment.filename}</strong>
                        <small>Conteúdo incorporado</small>
                      </span>
                    </span>
                  )
                )}
              </div>
            ) : null}
          </details>
        ))}
      </div>
      <footer className="email-reply-actions">
        <Link href={`/admin/email/compose?${replyParams}`}>
          <Reply /> Responder
        </Link>
        <Link href={`/admin/email/compose?${replyAllParams}`}>
          <Reply /> Responder a todos
        </Link>
        <Link href={`/admin/email/compose?${forwardParams}`}>
          <Send /> Encaminhar
        </Link>
      </footer>
    </article>
  );
}

function editorTextToHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function EmailComposer({
  composer,
  connection,
  operationalState,
  onPresentationChange,
  presentationId,
  preview
}: {
  composer: NonNullable<EmailWebmailShellProps["composer"]>;
  connection: EmailWebmailShellProps["connection"];
  operationalState: EmailOperationalState;
  onPresentationChange: (id: string) => void;
  presentationId: string;
  preview: EmailPresentationPreview | null;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [bccVisible, setBccVisible] = useState(Boolean(composer.initial.bcc));
  const [ccVisible, setCcVisible] = useState(Boolean(composer.initial.cc));
  const [bodyHtml, setBodyHtml] = useState(
    composer.initial.bodyHtml || editorTextToHtml(composer.initial.bodyText || "")
  );
  const [bodyText, setBodyText] = useState(composer.initial.bodyText || "");
  const [recipient, setRecipient] = useState(composer.initial.recipient || "");
  const [subject, setSubject] = useState(composer.initial.subject || "");
  const [templateId, setTemplateId] = useState("");
  const securePresentationHref = useMemo(() => {
    if (!presentationId) return "/admin/presentations";
    const params = new URLSearchParams();
    if (recipient) params.set("to", recipient.slice(0, 320));
    if (subject) params.set("subject", subject.slice(0, 240));
    return `/admin/presentations/${presentationId}/email?${params}`;
  }, [presentationId, recipient, subject]);

  function syncEditor() {
    const editor = editorRef.current;
    if (!editor) return;
    setBodyHtml(editor.innerHTML);
    setBodyText(editor.innerText);
  }

  function format(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncEditor();
  }

  function applyTemplate(id: string) {
    setTemplateId(id);
    const template = composer.templates.find((item) => item.id === id);
    if (!template) return;
    setSubject(template.subject);
    setBodyText(template.body_text);
    const html = editorTextToHtml(template.body_text);
    setBodyHtml(html);
    if (editorRef.current) editorRef.current.innerHTML = html;
  }

  const sendDisabled =
    Boolean(connection.code) ||
    !operationalState.externalSendEnabled ||
    !recipient ||
    !subject ||
    !bodyText;

  return (
    <section className="email-composer-v2">
      <header className="email-content-toolbar">
        <div>
          <Link aria-label="Voltar à caixa de entrada" href="/admin/email/inbox">
            <ChevronLeft />
          </Link>
          <strong>
            {composer.initial.mode === "reply"
              ? "Responder"
              : composer.initial.mode === "reply-all"
                ? "Responder a todos"
              : composer.initial.mode === "forward"
                ? "Encaminhar"
                : composer.initial.draftId
                  ? "Editar rascunho"
                  : "Novo e-mail"}
          </strong>
        </div>
        <div>
          <button aria-label="Minimizar composição" disabled type="button">−</button>
          <button aria-label="Fechar composição" onClick={() => history.back()} type="button">
            <X />
          </button>
        </div>
      </header>
      <form action={saveGmailDraftAction} className="email-compose-form">
        <input name="body_html" type="hidden" value={bodyHtml} />
        <input name="body_text" type="hidden" value={bodyText} />
        <input name="composer_mode" type="hidden" value={composer.initial.mode ?? "compose"} />
        <input name="draft_id" type="hidden" value={composer.initial.draftId ?? ""} />
        <input name="idempotency_key" type="hidden" value={composer.idempotencyKey} />
        <input name="recipient_name" type="hidden" value={composer.initial.recipientName ?? ""} />
        <input name="return_to" type="hidden" value="/admin/email/compose" />
        <input name="thread_id" type="hidden" value={composer.initial.threadId ?? ""} />
        <div className="email-compose-line">
          <label>De</label>
          <strong>{connection.connectedEmail || "claudio@arolab.co"}</strong>
        </div>
        <div className="email-compose-line">
          <label htmlFor="webmail-to">Para / Cliente</label>
          <input
            id="webmail-to"
            list="email-recipient-options"
            name="recipient_email"
            onChange={(event) => setRecipient(event.target.value)}
            placeholder="Nome, empresa ou e-mail"
            required
            type="email"
            value={recipient}
          />
          {!presentationId ? (
            <span className="email-cc-actions">
              <button onClick={() => setCcVisible((value) => !value)} type="button">CC</button>
              <button onClick={() => setBccVisible((value) => !value)} type="button">CCO</button>
            </span>
          ) : null}
          <datalist id="email-recipient-options">
            {composer.recipients.map((option) => (
              <option key={option.id} value={option.email}>
                {option.name}{option.organization ? ` · ${option.organization}` : ""}
              </option>
            ))}
          </datalist>
        </div>
        {!presentationId && ccVisible ? (
          <div className="email-compose-line">
            <label htmlFor="webmail-cc">CC</label>
            <input
              defaultValue={composer.initial.cc}
              id="webmail-cc"
              name="cc"
              placeholder="enderecos separados por vírgula"
            />
          </div>
        ) : null}
        {!presentationId && bccVisible ? (
          <div className="email-compose-line">
            <label htmlFor="webmail-bcc">CCO</label>
            <input
              defaultValue={composer.initial.bcc}
              id="webmail-bcc"
              name="bcc"
              placeholder="enderecos separados por vírgula"
            />
          </div>
        ) : null}
        <div className="email-compose-line">
          <label htmlFor="webmail-subject">Assunto</label>
          <input
            id="webmail-subject"
            name="subject"
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Assunto da mensagem"
            required
            value={subject}
          />
        </div>
        <div className="email-compose-line">
          <label htmlFor="webmail-template">Template</label>
          <select
            id="webmail-template"
            onChange={(event) => applyTemplate(event.target.value)}
            value={templateId}
          >
            <option value="">Mensagem em branco</option>
            {composer.templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>
        <section className="email-presentation-picker">
          <header>
            <strong>Apresentação de modelos</strong>
            {presentationId ? (
              <button onClick={() => onPresentationChange("")} type="button">
                Limpar seleção
              </button>
            ) : null}
          </header>
          <select
            aria-label="Selecionar apresentação"
            onChange={(event) => onPresentationChange(event.target.value)}
            value={presentationId}
          >
            <option value="">E-mail comum, sem apresentação</option>
            {composer.presentations
              .filter((presentation) => ["published", "sent"].includes(presentation.status))
              .map((presentation) => (
                <option key={presentation.id} value={presentation.id}>
                  {presentation.title}
                </option>
              ))}
          </select>
          {presentationId ? (
            <div className="email-selected-presentation">
              <div>
                {(preview?.models ?? []).slice(0, 4).map((model) => (
                  <span key={`${preview?.id}:${model.displayName}`}>
                    {model.imageUrl ? (
                      // Signed private URLs intentionally bypass the public image optimizer.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" height={42} src={model.imageUrl} width={34} />
                    ) : (
                      initials(model.displayName)
                    )}
                  </span>
                ))}
              </div>
              <span>
                <strong>{preview?.title || "Carregando apresentação..."}</strong>
                <small>
                  {preview
                    ? `${preview.models.length} modelo(s) e materiais definidos no snapshot`
                    : "A pré-visualização segura será carregada."}
                </small>
              </span>
              <Link href={`/admin/presentations/${presentationId}/edit`}>Editar</Link>
            </div>
          ) : null}
        </section>
        <section className="email-editor">
          <div className="email-editor-toolbar" role="toolbar" aria-label="Formatação do e-mail">
            <button aria-label="Negrito" onClick={() => format("bold")} type="button"><b>B</b></button>
            <button aria-label="Itálico" onClick={() => format("italic")} type="button"><i>I</i></button>
            <button aria-label="Sublinhado" onClick={() => format("underline")} type="button"><u>U</u></button>
            <button aria-label="Lista com marcadores" onClick={() => format("insertUnorderedList")} type="button">•≡</button>
            <button
              aria-label="Inserir link"
              onClick={() => {
                const url = window.prompt("URL segura (https://)");
                if (url?.startsWith("https://")) format("createLink", url);
              }}
              type="button"
            >
              ↗
            </button>
          </div>
          <div
            aria-label="Corpo do e-mail"
            className="email-editor-body"
            contentEditable
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
            onInput={syncEditor}
            ref={editorRef}
            role="textbox"
            suppressContentEditableWarning
          />
        </section>
        <div className="email-compose-schedule">
          <label>
            Agendar
            <input aria-label="Data e hora do agendamento" name="scheduled_at" type="datetime-local" />
          </label>
          <small>Timezone: America/Sao_Paulo</small>
        </div>
        <footer className="email-compose-footer">
          <span>
            {composer.initial.draftId ? (
              <button
                aria-label="Mover rascunho para a lixeira"
                className="email-icon-command"
                formAction={trashGmailDraftAction}
                onClick={(event) => {
                  if (!window.confirm("Mover este rascunho para a lixeira?")) {
                    event.preventDefault();
                  }
                }}
                title="Mover rascunho para a lixeira"
                type="submit"
              >
                <Trash2 />
              </button>
            ) : null}
            <button className="email-icon-command" disabled type="button" title="Anexos comuns entram em uma etapa futura">
              <Paperclip />
            </button>
          </span>
          <div>
            <button className="email-secondary-command" type="submit">
              Salvar rascunho
            </button>
            {!presentationId ? (
              <>
                <button
                  className="email-secondary-command"
                  disabled={!operationalState.schedulingOperational}
                  formAction={scheduleWebmailMessageAction}
                  type="submit"
                >
                  Agendar envio
                </button>
                <button
                  className="email-primary-command"
                  disabled={sendDisabled}
                  formAction={sendWebmailMessageAction}
                  title={
                    operationalState.externalSendEnabled
                      ? "Enviar e-mail"
                      : "Envios externos estão desativados neste ambiente"
                  }
                  type="submit"
                >
                  <Send /> Enviar
                </button>
              </>
            ) : (
              <Link className="email-primary-command" href={securePresentationHref}>
                <Send /> Enviar apresentação
              </Link>
            )}
          </div>
        </footer>
      </form>
    </section>
  );
}

function PresentationPreview({
  device,
  loading,
  preview,
  setDevice
}: {
  device: "desktop" | "mobile" | "tablet";
  loading: boolean;
  preview: EmailPresentationPreview | null;
  setDevice: (device: "desktop" | "mobile" | "tablet") => void;
}) {
  return (
    <aside className="email-preview-rail">
      <header>
        <strong>Pré-visualização</strong>
        <div role="group" aria-label="Tamanho da pré-visualização">
          {(["desktop", "tablet", "mobile"] as const).map((item) => (
            <button
              aria-label={`Visualização ${item}`}
              aria-pressed={device === item}
              key={item}
              onClick={() => setDevice(item)}
              type="button"
            >
              {item === "desktop" ? "▭" : item === "tablet" ? "▯" : "▯"}
            </button>
          ))}
        </div>
      </header>
      <div className={`email-presentation-preview ${device}`}>
        <div className="email-preview-brand">
          <Image alt="ARO" height={34} src="/brand/aro-mark.png" width={34} />
          <strong>ARO</strong>
        </div>
        {loading ? (
          <div className="email-preview-empty">
            <RefreshCw />
            <strong>Carregando preview seguro</strong>
          </div>
        ) : preview ? (
          <>
            <div className="email-preview-title">
              <strong>{preview.title}</strong>
              <span>{preview.description || "Seleção de modelos ARO"}</span>
            </div>
            <div className="email-preview-model-grid">
              {preview.models.slice(0, 4).map((model) => (
                <article key={`${preview.id}:${model.displayName}`}>
                  <div>
                    {model.imageUrl ? (
                      // Signed private URLs intentionally bypass the public image optimizer.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt={model.displayName} src={model.imageUrl} />
                    ) : (
                      <span>{initials(model.displayName)}</span>
                    )}
                  </div>
                  <strong>{model.displayName}</strong>
                  <small>
                    {[model.measurements.height, model.measurements.bust, model.measurements.waist]
                      .filter(Boolean)
                      .join(" · ") || "Medidas não informadas"}
                  </small>
                  <small>
                    {[model.city, model.country].filter(Boolean).join(", ") || model.board || "ARO"}
                  </small>
                </article>
              ))}
            </div>
            <button className="email-preview-portfolio-button" disabled type="button">
              Ver portfólios completos
            </button>
            <footer>
              <span>Atenciosamente,</span>
              <strong>{preview.contact.name}</strong>
              <small>{preview.contact.email}</small>
              <small>{preview.contact.website}</small>
            </footer>
          </>
        ) : (
          <div className="email-preview-empty">
            <FileText />
            <strong>Selecione uma apresentação</strong>
            <span>A prévia usará o snapshot publicado e URLs privadas temporárias.</span>
          </div>
        )}
      </div>
    </aside>
  );
}

function ThreadContextRail({ thread }: { thread: EmailWebmailThread }) {
  const latest = thread.messages.at(-1);
  return (
    <aside className="email-preview-rail email-thread-context">
      <header><strong>Contexto</strong></header>
      <div>
        <span>Conversa</span>
        <strong>{thread.subject}</strong>
      </div>
      <dl>
        <dt>Mensagens</dt><dd>{thread.messages.length}</dd>
        <dt>Último remetente</dt><dd>{latest?.from.name || latest?.from.email || "—"}</dd>
        <dt>Anexos</dt><dd>{thread.messages.reduce((total, message) => total + message.attachments.length, 0)}</dd>
        <dt>Gmail thread ID</dt><dd title={thread.id}>{thread.id.slice(0, 12)}…</dd>
      </dl>
      <p>O corpo completo permanece no Gmail e não é persistido no Supabase.</p>
    </aside>
  );
}

function EmptyContent() {
  return (
    <section className="email-content-empty">
      <Mail />
      <strong>Selecione uma conversa</strong>
      <span>Abra um thread para ler, responder, encaminhar ou organizar a mensagem.</span>
      <Link href="/admin/email/compose"><Plus /> Novo e-mail</Link>
    </section>
  );
}

function ConnectionState({
  connection
}: {
  connection: EmailWebmailShellProps["connection"];
}) {
  return (
    <section className="email-connection-state">
      <Mail />
      <span>Integração Gmail</span>
      <strong>{connection.message || "A conta Gmail precisa ser reconectada."}</strong>
      <p>
        A autorização é feita diretamente no Google. Nenhuma senha ou token é exibido no sistema.
      </p>
      <Link href="/admin/settings?tab=integrations">Reconectar Gmail</Link>
    </section>
  );
}

export function EmailWebmailShell(props: EmailWebmailShellProps) {
  const router = useRouter();
  const [device, setDevice] = useState<"desktop" | "mobile" | "tablet">("desktop");
  const [presentationId, setPresentationId] = useState("");
  const [preview, setPreview] = useState<EmailPresentationPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!presentationId) {
      setPreview(null);
      setPreviewLoading(false);
      return;
    }
    const controller = new AbortController();
    setPreviewLoading(true);
    fetch(`/api/admin/presentations/${encodeURIComponent(presentationId)}/email-preview`, {
      cache: "no-store",
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) return { preview: null };
        return (await response.json()) as { preview: EmailPresentationPreview | null };
      })
      .then((payload) => setPreview(payload.preview))
      .catch((error) => {
        if ((error as Error).name !== "AbortError") setPreview(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPreviewLoading(false);
      });
    return () => controller.abort();
  }, [presentationId]);

  const scheduledCount =
    props.scheduledEmails.length >= 80 ? 80 : props.scheduledEmails.length;
  const showPreview = Boolean(props.composer);

  return (
    <div className={`email-webmail ${showPreview ? "has-preview" : "thread-mode"}`}>
      <button
        className="email-mobile-folders"
        onClick={() => document.documentElement.classList.toggle("email-folders-open")}
        type="button"
      >
        <Inbox /> Pastas
      </button>
      <button
        aria-label="Atualizar caixa postal"
        className="email-mobile-refresh"
        onClick={() => router.refresh()}
        type="button"
      >
        <RefreshCw />
      </button>
      <EmailMailboxNav
        connection={props.connection}
        currentFolder={props.currentFolder}
        currentLabelId={props.currentLabelId}
        labels={props.labels}
        scheduledCount={scheduledCount}
      />
      <EmailThreadList
        currentFolder={props.currentFolder}
        currentLabelId={props.currentLabelId}
        drafts={props.drafts}
        labels={props.labels}
        nextPageToken={props.nextPageToken}
        pageToken={props.pageToken}
        query={props.query}
        resultSizeEstimate={props.resultSizeEstimate}
        selectedDraftId={props.selectedDraftId}
        selectedThreadId={props.selectedThreadId}
        threads={props.threads}
      />
      <main className="email-content-pane">
        {props.connection.code ? (
          <ConnectionState connection={props.connection} />
        ) : props.composer ? (
          <EmailComposer
            composer={props.composer}
            connection={props.connection}
            onPresentationChange={setPresentationId}
            operationalState={props.operationalState}
            presentationId={presentationId}
            preview={preview}
          />
        ) : props.selectedThread ? (
          <EmailThreadViewer
            currentFolder={props.currentFolder}
            selectedThread={props.selectedThread}
          />
        ) : (
          <EmptyContent />
        )}
      </main>
      {showPreview ? (
        <PresentationPreview
          device={device}
          loading={previewLoading}
          preview={preview}
          setDevice={setDevice}
        />
      ) : props.selectedThread ? (
        <ThreadContextRail thread={props.selectedThread} />
      ) : (
        <aside className="email-preview-rail email-context-empty">
          <header><strong>Contexto</strong></header>
          <Mail />
          <span>Selecione uma conversa para ver o contexto operacional.</span>
        </aside>
      )}
    </div>
  );
}
