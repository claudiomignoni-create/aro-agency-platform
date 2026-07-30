import Link from "next/link";
import { EmailStatusBadge } from "@/components/admin/email-center/email-status-badge";
import { EmailSubnav } from "@/components/admin/email-center/email-subnav";
import { EmailOperationalBanner } from "@/components/admin/email-center/email-operational-banner";
import {
  AdminPage,
  AdminPageHeader,
  AdminSection
} from "@/components/admin/admin-ui";
import { requireRole } from "@/lib/auth";
import { getGoogleConnection } from "@/lib/communications/data";
import {
  aroGoogleEmail,
  googleOAuthConfigured,
  googleScopes
} from "@/lib/communications/google-workspace";
import { getEmailOperationalState } from "@/lib/communications/operational-state-server";

function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
}

export default async function EmailSettingsPage() {
  const profile = await requireRole(["admin"]);
  const [connection, operationalState] = await Promise.all([
    getGoogleConnection(profile.id),
    getEmailOperationalState(profile.id)
  ]);
  const connected = connection?.status === "connected";

  return (
    <AdminPage className="email-center-subpage">
      <AdminPageHeader
        actions={<Link className="button secondary" href="/admin/settings?tab=integrations">Configurações gerais</Link>}
        description="Remetente, conexão, permissões e limites de privacidade do módulo."
        eyebrow="Email Center"
        title="Configurações"
      />
      <EmailSubnav active="/admin/email/settings" />
      <EmailOperationalBanner state={operationalState} />
      <div className="email-detail-grid">
        <AdminSection
          title="Remetente oficial"
          meta={<EmailStatusBadge status={connected ? "completed" : "pending"}>{connected ? "Conectado" : "Pendente"}</EmailStatusBadge>}
        >
          <div className="admin-kv-grid">
            <span>Conta ARO</span><strong>{aroGoogleEmail}</strong>
            <span>Reply-To</span><strong>{aroGoogleEmail}</strong>
            <span>OAuth configurado</span><strong>{googleOAuthConfigured() ? "Sim" : "Não"}</strong>
            <span>Conta conectada</span><strong>{connection?.connected_email ?? "—"}</strong>
            <span>Envio externo</span><strong>{operationalState.externalSendEnabled ? "Ativado" : "Desativado"}</strong>
            <span>Agendamento</span><strong>{operationalState.schedulingOperational ? "Operacional" : "Não configurado"}</strong>
            <span>Token expira</span><strong>{dateTime(connection?.token_expires_at)}</strong>
            <span>Último uso</span><strong>{dateTime(connection?.last_used_at)}</strong>
            <span>Último erro</span><strong>{operationalState.lastErrorMessage ?? "—"}</strong>
          </div>
        </AdminSection>

        <AdminSection title="Permissões Google">
          <div className="admin-kv-grid">
            <span>Escopo ativo</span>
            <strong>{(connection?.scopes?.length ? connection.scopes : [...googleScopes]).join(", ")}</strong>
            <span>Criar rascunhos</span><strong>Permitido pelo escopo compose</strong>
            <span>Enviar mensagens</span><strong>Permitido pelo escopo compose</strong>
            <span>Ler caixa de entrada</span><strong>Não autorizado</strong>
            <span>Sincronizar respostas</span><strong>Não ativado</strong>
          </div>
        </AdminSection>
      </div>

      <div className="email-detail-grid">
        <AdminSection title="Medição de engajamento">
          <div className="admin-kv-grid">
            <span>Apresentação aberta</span>
            <strong>Acesso ao link seguro da apresentação</strong>
            <span>Abertura do e-mail</span><strong>Não declarada</strong>
            <span>Tracking pixel</span><strong>Não utilizado</strong>
            <span>IP bruto</span><strong>Não armazenado</strong>
            <span>Resposta recebida</span><strong>Indisponível sem novo consentimento</strong>
          </div>
        </AdminSection>

        <AdminSection title="Proteções">
          <div className="admin-kv-grid">
            <span>Destinatários</span><strong>Uma operação por destinatário</strong>
            <span>OTP no painel</span><strong>Nunca exibido</strong>
            <span>Tokens e hashes</span><strong>Nunca exibidos</strong>
            <span>Erros do Gmail</span><strong>Somente versão sanitizada</strong>
            <span>Reenvio automático de sent</span><strong>Bloqueado</strong>
          </div>
        </AdminSection>
      </div>
    </AdminPage>
  );
}
