"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { createOutboundEmailAction } from "@/app/admin/email/actions";
import {
  ArrowRight,
  FileText,
  Layers3,
  LayoutDashboard,
  Link2,
  List,
  Paperclip,
  PlaySquare,
  Send,
  UsersRound
} from "@/components/admin/admin-icons";
import {
  emailPresentationLayouts,
  filterEmailComposerRecipients,
  formatEmailComposerSelection,
  type EmailComposerRecipientTab,
  type EmailPresentationLayout,
  type EmailTextFormat
} from "@/lib/communications/email-compose";
import type { EmailRecipientOption } from "@/lib/communications/email-center";
import type { EmailTemplate, Presentation } from "@/lib/communications/data";
import {
  modeIsAvailable,
  type EmailOperationalState
} from "@/lib/communications/email-operations";

type ComposerProps = {
  idempotencyKey: string;
  initialName?: string;
  initialRecipient?: string;
  initialSubject?: string;
  initialTemplateId?: string;
  operationalState: EmailOperationalState;
  presentations: Presentation[];
  recipients: EmailRecipientOption[];
  sender: string;
  templates: EmailTemplate[];
};

const categoryLabels: Record<EmailRecipientOption["category"], string> = {
  agency: "Agência",
  agency_contact: "Contato de agência",
  client: "Cliente",
  client_contact: "Contato de cliente",
  manual: "Manual",
  model: "Modelo"
};

const layoutIcons = {
  book: FileText,
  grid: LayoutDashboard,
  list: List,
  polaroids: Layers3
} satisfies Record<EmailPresentationLayout, typeof LayoutDashboard>;

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "AR"
  );
}

export function EmailComposer({
  idempotencyKey,
  initialName = "",
  initialRecipient = "",
  initialSubject = "",
  initialTemplateId = "",
  operationalState,
  presentations,
  recipients,
  sender,
  templates
}: ComposerProps) {
  const initialTemplate = templates.find((template) => template.id === initialTemplateId);
  const [body, setBody] = useState(initialTemplate?.body_text ?? "");
  const [name, setName] = useState(initialName);
  const [presentationId, setPresentationId] = useState("");
  const [recipient, setRecipient] = useState(initialRecipient);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientTab, setRecipientTab] =
    useState<EmailComposerRecipientTab>("organizations");
  const [selectedLayout, setSelectedLayout] =
    useState<EmailPresentationLayout>("grid");
  const [showAllRecipients, setShowAllRecipients] = useState(false);
  const [subject, setSubject] = useState(initialTemplate?.subject ?? initialSubject);
  const [templateId, setTemplateId] = useState(initialTemplate?.id ?? "");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const recipientSearchRef = useRef<HTMLInputElement>(null);

  const filteredRecipients = useMemo(
    () => filterEmailComposerRecipients(recipients, recipientTab, recipientSearch),
    [recipientSearch, recipientTab, recipients]
  );
  const visibleRecipients = showAllRecipients
    ? filteredRecipients
    : filteredRecipients.slice(0, 5);
  const selectedRecipient = recipients.find((option) => option.email === recipient);
  const messageComplete = Boolean(recipient.trim() && subject.trim() && body.trim());
  const availablePresentations = presentations.filter((presentation) =>
    ["published", "sent"].includes(presentation.status)
  );
  const securePresentationHref = useMemo(() => {
    if (!presentationId) return "/admin/presentations";
    const params = new URLSearchParams();
    if (recipient) params.set("to", recipient.slice(0, 320));
    if (name) params.set("name", name.slice(0, 160));
    if (subject) params.set("subject", subject.slice(0, 240));
    const query = params.toString();
    return `/admin/presentations/${presentationId}/email${query ? `?${query}` : ""}`;
  }, [name, presentationId, recipient, subject]);

  function applyTemplate(value: string) {
    setTemplateId(value);
    const template = templates.find((item) => item.id === value);
    if (!template) return;
    setSubject(template.subject);
    setBody(template.body_text);
  }

  function selectRecipient(option: EmailRecipientOption) {
    setRecipient(option.email);
    setName(option.name);
  }

  function applyBodyFormat(format: EmailTextFormat) {
    const textarea = bodyRef.current;
    if (!textarea) return;
    const result = formatEmailComposerSelection(
      body,
      textarea.selectionStart,
      textarea.selectionEnd,
      format
    );
    setBody(result.value);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  }

  return (
    <form
      action={createOutboundEmailAction}
      className="email-composer-shell"
      onSubmit={(event) => {
        if (presentationId) event.preventDefault();
      }}
    >
      <input name="idempotency_key" type="hidden" value={idempotencyKey} />
      <input name="recipient_email" type="hidden" value={recipient} />
      <input name="recipient_name" type="hidden" value={name} />
      <input name="presentation_layout" type="hidden" value={selectedLayout} />

      <section className="email-compose-main-panel">
        <div className="email-compose-field">
          <label htmlFor="email-compose-recipient">Destinatários</label>
          <button
            aria-controls="email-compose-recipient-panel"
            className="email-compose-recipient-trigger"
            id="email-compose-recipient"
            onClick={() => recipientSearchRef.current?.focus()}
            type="button"
          >
            <span>
              {selectedRecipient?.name || name || recipient || "Selecione clientes, agências ou contatos..."}
              {recipient ? <small>{recipient}</small> : null}
            </span>
            <strong>Selecionar</strong>
            <ArrowRight aria-hidden="true" />
          </button>
        </div>

        <div className="email-compose-field">
          <label htmlFor="email-compose-subject">Assunto</label>
          <input
            id="email-compose-subject"
            name="subject"
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Digite o assunto do e-mail..."
            required
            value={subject}
          />
        </div>

        <div className="email-compose-field">
          <label htmlFor="email-compose-body">Mensagem</label>
          <div className="email-compose-editor">
            <div aria-label="Formatação da mensagem" className="email-compose-toolbar" role="toolbar">
              <button
                aria-label="Negrito"
                onClick={() => applyBodyFormat("bold")}
                title="Negrito"
                type="button"
              >
                <strong>B</strong>
              </button>
              <button
                aria-label="Itálico"
                onClick={() => applyBodyFormat("italic")}
                title="Itálico"
                type="button"
              >
                <em>I</em>
              </button>
              <button
                aria-label="Lista"
                onClick={() => applyBodyFormat("list")}
                title="Lista"
                type="button"
              >
                <List aria-hidden="true" />
              </button>
              <button
                aria-label="Adicionar link"
                onClick={() => applyBodyFormat("link")}
                title="Adicionar link"
                type="button"
              >
                <Link2 aria-hidden="true" />
              </button>
            </div>
            <textarea
              id="email-compose-body"
              name="body_text"
              onChange={(event) => setBody(event.target.value)}
              placeholder="Escreva sua mensagem..."
              ref={bodyRef}
              required
              rows={13}
              value={body}
            />
          </div>
        </div>

        <div className="email-compose-options">
          <label>
            <span>De</span>
            <input aria-label="Conta remetente" readOnly value={sender} />
          </label>
          <label>
            <span>Template</span>
            <select
              aria-label="Template de e-mail"
              onChange={(event) => applyTemplate(event.target.value)}
              value={templateId}
            >
              <option value="">Mensagem em branco</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} · {template.language}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="email-compose-attachments">
          <span>Anexos (opcional)</span>
          <div>
            <button disabled title="Upload de arquivos será ativado em uma próxima etapa" type="button">
              <Paperclip aria-hidden="true" />
              <span>
                <strong>Selecionar arquivos</strong>
                <small>Em breve</small>
              </span>
            </button>
            <button disabled title="Upload de vídeos será ativado em uma próxima etapa" type="button">
              <PlaySquare aria-hidden="true" />
              <span>
                <strong>Selecionar vídeos</strong>
                <small>Em breve</small>
              </span>
            </button>
          </div>
        </div>

        {!presentationId ? (
          <details className="email-compose-schedule">
            <summary>Agendar envio</summary>
            <div>
              <label>
                <span>Data</span>
                <input name="scheduled_date" type="date" />
              </label>
              <label>
                <span>Hora</span>
                <input name="scheduled_time" type="time" />
              </label>
              <input name="scheduled_timezone" type="hidden" value="America/Sao_Paulo" />
              <button
                className="email-compose-secondary-button"
                disabled={!modeIsAvailable("scheduled", operationalState)}
                name="mode"
                type="submit"
                value="scheduled"
              >
                Agendar
              </button>
            </div>
            {!operationalState.schedulingOperational ? (
              <small>O processador de agendamento ainda não está disponível.</small>
            ) : null}
          </details>
        ) : null}

        {presentationId ? (
          <div className="email-compose-secure-notice">
            <span>
              <strong>Apresentação selecionada</strong>
              O link individual deve ser criado no fluxo seguro da apresentação.
            </span>
            <Link href={securePresentationHref}>Configurar</Link>
          </div>
        ) : null}

        <footer className="email-compose-footer">
          {presentationId ? (
            <Link className="email-compose-primary-button" href={securePresentationHref}>
              <Send aria-hidden="true" />
              Continuar no envio seguro
            </Link>
          ) : (
            <>
              <button
                className="email-compose-primary-button"
                disabled={!messageComplete || !modeIsAvailable("send_now", operationalState)}
                name="mode"
                type="submit"
                value="send_now"
              >
                <Send aria-hidden="true" />
                Enviar e-mail
              </button>
              <button
                className="email-compose-secondary-button"
                disabled={!messageComplete || !modeIsAvailable("gmail_draft", operationalState)}
                name="mode"
                type="submit"
                value="gmail_draft"
              >
                Criar no Gmail
              </button>
              <button
                className="email-compose-draft-button"
                disabled={!messageComplete}
                name="mode"
                type="submit"
                value="system_draft"
              >
                <FileText aria-hidden="true" />
                Salvar rascunho
              </button>
            </>
          )}
        </footer>
      </section>

      <aside className="email-compose-side">
        <section
          aria-labelledby="email-compose-recipients-title"
          className="email-compose-side-card"
          id="email-compose-recipient-panel"
        >
          <header>
            <span>1.</span>
            <h2 id="email-compose-recipients-title">Selecionar destinatários</h2>
          </header>
          <div aria-label="Tipo de destinatário" className="email-compose-recipient-tabs" role="tablist">
            <button
              aria-controls="email-compose-recipient-list"
              aria-selected={recipientTab === "organizations"}
              onClick={() => {
                setRecipientTab("organizations");
                setShowAllRecipients(false);
              }}
              role="tab"
              type="button"
            >
              Clientes/Agências
            </button>
            <button
              aria-controls="email-compose-recipient-list"
              aria-selected={recipientTab === "contacts"}
              onClick={() => {
                setRecipientTab("contacts");
                setShowAllRecipients(false);
              }}
              role="tab"
              type="button"
            >
              Contatos
            </button>
          </div>
          <label className="email-compose-recipient-search">
            <span className="sr-only">Buscar destinatários</span>
            <input
              onChange={(event) => {
                setRecipientSearch(event.target.value);
                setShowAllRecipients(false);
              }}
              placeholder={
                recipientTab === "organizations"
                  ? "Buscar clientes ou agências..."
                  : "Buscar contatos..."
              }
              ref={recipientSearchRef}
              type="search"
              value={recipientSearch}
            />
          </label>
          <div
            aria-labelledby="email-compose-recipients-title"
            className="email-compose-recipient-list"
            id="email-compose-recipient-list"
            role="tabpanel"
          >
            {visibleRecipients.length ? (
              visibleRecipients.map((option) => (
                <label className="email-compose-recipient-row" key={option.id}>
                  <input
                    checked={recipient === option.email}
                    onChange={() => selectRecipient(option)}
                    type="checkbox"
                  />
                  <span className="email-compose-recipient-avatar">
                    {initials(option.organization || option.name)}
                  </span>
                  <span>
                    <strong>{option.name}</strong>
                    <small>
                      {option.organization || categoryLabels[option.category]} · {option.email}
                    </small>
                  </span>
                </label>
              ))
            ) : (
              <p className="email-compose-empty">Nenhum destinatário encontrado.</p>
            )}
          </div>
          {filteredRecipients.length > 5 ? (
            <button
              className="email-compose-see-all"
              onClick={() => setShowAllRecipients((current) => !current)}
              type="button"
            >
              {showAllRecipients ? "Mostrar menos" : `Ver todos (${filteredRecipients.length})`}
            </button>
          ) : null}
          <details className="email-compose-manual-recipient">
            <summary>Usar outro e-mail</summary>
            <div>
              <label>
                <span>E-mail</span>
                <input
                  onChange={(event) => setRecipient(event.target.value)}
                  placeholder="contato@empresa.com"
                  type="email"
                  value={recipient}
                />
              </label>
              <label>
                <span>Nome</span>
                <input
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Nome do contato"
                  value={name}
                />
              </label>
            </div>
          </details>
          <p className="email-compose-privacy-note">Um destinatário por envio protege a privacidade dos contatos.</p>
        </section>

        <section className="email-compose-side-card">
          <header>
            <span>2.</span>
            <h2>Selecionar modelos</h2>
          </header>
          <label className="email-compose-presentation-select">
            <UsersRound aria-hidden="true" />
            <span>
              <strong>Selecionar apresentação</strong>
              <small>Adicionar modelos à comunicação</small>
            </span>
            <select
              aria-label="Apresentação de modelos"
              onChange={(event) => setPresentationId(event.target.value)}
              value={presentationId}
            >
              <option value="">Sem apresentação</option>
              {availablePresentations.map((presentation) => (
                <option key={presentation.id} value={presentation.id}>
                  {presentation.title}
                </option>
              ))}
            </select>
          </label>
          <Link
            className="email-compose-card-link"
            href={
              presentationId
                ? `/admin/presentations/${presentationId}/edit`
                : "/admin/presentations/new"
            }
          >
            {presentationId ? "Editar seleção de modelos" : "Criar nova apresentação"}
            <ArrowRight aria-hidden="true" />
          </Link>
        </section>

        <section className="email-compose-side-card">
          <header>
            <span>3.</span>
            <h2>Selecionar layout</h2>
          </header>
          <div className="email-compose-layout-grid">
            {emailPresentationLayouts.map((layout) => {
              const LayoutIcon = layoutIcons[layout.id];
              return (
                <button
                  aria-pressed={selectedLayout === layout.id}
                  key={layout.id}
                  onClick={() => setSelectedLayout(layout.id)}
                  type="button"
                >
                  <LayoutIcon aria-hidden="true" />
                  <strong>{layout.label}</strong>
                  <small>{layout.description}</small>
                </button>
              );
            })}
          </div>
          <p className="email-compose-layout-note">
            O layout escolhido será aplicado na apresentação dos modelos. Nesta etapa, a escolha
            fica preparada no compositor.
          </p>
        </section>
      </aside>
    </form>
  );
}
