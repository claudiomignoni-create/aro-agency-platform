"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createOutboundEmailAction } from "@/app/admin/email/actions";
import type {
  EmailRecipientOption
} from "@/lib/communications/email-center";
import type {
  EmailTemplate,
  Presentation
} from "@/lib/communications/data";

type ComposerProps = {
  idempotencyKey: string;
  initialName?: string;
  initialRecipient?: string;
  initialSubject?: string;
  initialTemplateId?: string;
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

export function EmailComposer({
  idempotencyKey,
  initialName = "",
  initialRecipient = "",
  initialSubject = "",
  initialTemplateId = "",
  presentations,
  recipients,
  sender,
  templates
}: ComposerProps) {
  const initialTemplate = templates.find((template) => template.id === initialTemplateId);
  const [body, setBody] = useState(initialTemplate?.body_text ?? "");
  const [mode, setMode] = useState("system_draft");
  const [name, setName] = useState(initialName);
  const [presentationId, setPresentationId] = useState("");
  const [recipient, setRecipient] = useState(initialRecipient);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [subject, setSubject] = useState(initialTemplate?.subject ?? initialSubject);
  const [templateId, setTemplateId] = useState(initialTemplate?.id ?? "");

  const suggestions = useMemo(() => {
    const query = recipient.trim().toLocaleLowerCase("pt-BR");
    if (query.length < 2) return recipients.slice(0, 8);
    return recipients
      .filter((option) =>
        [option.name, option.email, option.organization]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase("pt-BR").includes(query))
      )
      .slice(0, 8);
  }, [recipient, recipients]);

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
    setShowSuggestions(false);
  }

  return (
    <div className="email-composer-shell">
      <section className="email-panel">
        <header>
          <div>
            <span className="email-section-index">01</span>
            <h2>Mensagem</h2>
          </div>
          <span>Envio individual</span>
        </header>
        <form action={createOutboundEmailAction} className="email-composer-form">
          <input name="idempotency_key" type="hidden" value={idempotencyKey} />
          <div className="admin-form-grid">
            <label className="admin-field">
              <span>De</span>
              <input readOnly value={sender} />
            </label>
            <label className="admin-field email-recipient-combobox">
              <span>Destinatário</span>
              <input
                autoComplete="off"
                name="recipient_email"
                onChange={(event) => {
                  setRecipient(event.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Busque por nome, empresa ou e-mail"
                required
                value={recipient}
              />
              {showSuggestions && suggestions.length ? (
                <div className="email-recipient-suggestions" role="listbox">
                  {suggestions.map((option) => (
                    <button
                      aria-selected={recipient === option.email}
                      key={option.id}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectRecipient(option)}
                      role="option"
                      type="button"
                    >
                      <span>
                        <strong>{option.name}</strong>
                        <small>{option.email}</small>
                      </span>
                      <em>{option.organization || categoryLabels[option.category]}</em>
                    </button>
                  ))}
                </div>
              ) : null}
            </label>
            <label className="admin-field">
              <span>Nome para personalização</span>
              <input
                name="recipient_name"
                onChange={(event) => setName(event.target.value)}
                placeholder="Nome do contato"
                value={name}
              />
            </label>
            <label className="admin-field">
              <span>Template</span>
              <select onChange={(event) => applyTemplate(event.target.value)} value={templateId}>
                <option value="">Mensagem em branco</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} · {template.language}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-field span-2">
              <span>Assunto</span>
              <input
                name="subject"
                onChange={(event) => setSubject(event.target.value)}
                placeholder="ARO — Assunto da comunicação"
                required
                value={subject}
              />
            </label>
            <label className="admin-field">
              <span>Modo</span>
              <select name="mode" onChange={(event) => setMode(event.target.value)} value={mode}>
                <option value="system_draft">Salvar no sistema</option>
                <option value="gmail_draft">Criar rascunho no Gmail</option>
                <option value="send_now">Enviar agora</option>
                <option value="scheduled">Agendar envio</option>
              </select>
            </label>
            <label className="admin-field">
              <span>Apresentação</span>
              <select
                onChange={(event) => setPresentationId(event.target.value)}
                value={presentationId}
              >
                <option value="">Sem apresentação</option>
                {presentations
                  .filter((presentation) => ["published", "sent"].includes(presentation.status))
                  .map((presentation) => (
                    <option key={presentation.id} value={presentation.id}>
                      {presentation.title}
                    </option>
                  ))}
              </select>
            </label>
            {mode === "scheduled" ? (
              <>
                <label className="admin-field">
                  <span>Data</span>
                  <input name="scheduled_date" required type="date" />
                </label>
                <label className="admin-field">
                  <span>Hora</span>
                  <input name="scheduled_time" required type="time" />
                </label>
                <input name="scheduled_timezone" type="hidden" value="America/Sao_Paulo" />
              </>
            ) : null}
            <label className="admin-field span-2">
              <span>Corpo</span>
              <textarea
                name="body_text"
                onChange={(event) => setBody(event.target.value)}
                placeholder="Escreva uma mensagem direta, clara e adequada ao destinatário."
                required
                rows={13}
                value={body}
              />
            </label>
          </div>

          {presentationId ? (
            <div className="email-schema-notice">
              <span>
                <strong>Apresentação selecionada</strong>
                O link individual e seguro deve ser criado no fluxo da apresentação.
              </span>
              <Link className="button secondary" href={`/admin/presentations/${presentationId}/email`}>
                Configurar envio seguro
              </Link>
            </div>
          ) : null}

          <div className="actions">
            <button className="button" type="submit">
              {mode === "system_draft" ? "Salvar rascunho" : mode === "gmail_draft" ? "Criar no Gmail" : mode === "scheduled" ? "Agendar" : "Enviar"}
            </button>
            <Link className="button secondary" href="/admin/email">Cancelar</Link>
          </div>
        </form>
      </section>

      <aside className="email-panel email-composer-preview">
        <header>
          <div>
            <span className="email-section-index">02</span>
            <h2>Preview</h2>
          </div>
          <span>{mode === "scheduled" ? "Agendado" : "Rascunho"}</span>
        </header>
        <div className="email-message-paper">
          <small>Para: {recipient || "destinatário"}</small>
          <strong>{subject || "Assunto da mensagem"}</strong>
          <p>{body || "A prévia da comunicação aparecerá aqui enquanto você escreve."}</p>
        </div>
        <div className="admin-kv-grid compact">
          <span>Privacidade</span><strong>Um destinatário por operação</strong>
          <span>Tracking</span><strong>Somente link seguro de apresentação</strong>
          <span>Anexos privados</span><strong>Não enviados por este composer</strong>
        </div>
      </aside>
    </div>
  );
}
