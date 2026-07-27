import { randomUUID } from "node:crypto";
import Link from "next/link";
import {
  AdminPage,
  AdminPageHeader,
  AdminSection,
  AdminSelectField,
  AdminTextField
} from "@/components/admin/admin-ui";
import { createOutboundEmailAction } from "@/app/admin/email/actions";
import { aroGoogleEmail } from "@/lib/communications/google-workspace";

export default function ComposeEmailPage() {
  return (
    <AdminPage>
      <AdminPageHeader
        actions={<Link className="button secondary" href="/admin/email">Voltar</Link>}
        description="Crie mensagens individuais. Durante a implantação, envio real é permitido somente para claudio@arolab.co."
        eyebrow="Email Center"
        title="Compor e-mail"
      />

      <AdminSection title="Mensagem">
        <form action={createOutboundEmailAction} className="admin-form-grid">
          <input name="idempotency_key" type="hidden" value={randomUUID()} />
          <label className="admin-field">
            <span>De</span>
            <input readOnly value={`Claudio Mignoni <${aroGoogleEmail}>`} />
          </label>
          <AdminTextField label="Para" name="recipient_email" placeholder="nome@empresa.com" />
          <AdminTextField label="Nome do destinatário" name="recipient_name" placeholder="Nome para personalização" />
          <AdminTextField label="Assunto" name="subject" placeholder="ARO — Apresentação" />
          <AdminSelectField
            defaultValue="system_draft"
            label="Modo"
            name="mode"
            options={[
              { label: "Salvar no sistema", value: "system_draft" },
              { label: "Criar rascunho no Gmail", value: "gmail_draft" },
              { label: "Enviar agora (somente claudio@arolab.co)", value: "send_now" },
              { label: "Agendar envio", value: "scheduled" }
            ]}
          />
          <label className="admin-field">
            <span>Data do agendamento</span>
            <input name="scheduled_date" type="date" />
          </label>
          <label className="admin-field">
            <span>Hora do agendamento</span>
            <input name="scheduled_time" type="time" />
          </label>
          <AdminTextField label="Timezone" name="scheduled_timezone" placeholder="America/Sao_Paulo" />
          <label className="admin-field span-2">
            <span>Mensagem</span>
            <textarea
              name="body_text"
              placeholder={"Claudio Mignoni\nDirector / Model Manager\nARO\n\nclaudio@arolab.co\nwww.arolab.co"}
              required
              rows={10}
            />
          </label>
          <button className="button" type="submit">Salvar comunicação</button>
        </form>
      </AdminSection>
    </AdminPage>
  );
}
