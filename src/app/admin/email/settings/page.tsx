import Link from "next/link";
import { AdminPage, AdminPageHeader, AdminSection, AdminStatusPill } from "@/components/admin/admin-ui";
import { requireRole } from "@/lib/auth";
import { getGoogleConnection } from "@/lib/communications/data";
import { aroGoogleEmail, googleOAuthConfigured } from "@/lib/communications/google-workspace";

export default async function EmailSettingsPage() {
  const profile = await requireRole(["admin"]);
  const connection = await getGoogleConnection(profile.id);

  return (
    <AdminPage>
      <AdminPageHeader
        actions={<Link className="button secondary" href="/admin/email">Email Center</Link>}
        description="Configuração do remetente, assinatura e proteção de envio."
        eyebrow="Email Center"
        title="Configurações de e-mail"
      />
      <AdminSection title="Remetente oficial">
        <div className="admin-kv-grid">
          <span>Remetente</span><strong>Claudio Mignoni &lt;{aroGoogleEmail}&gt;</strong>
          <span>Reply-To</span><strong>{aroGoogleEmail}</strong>
          <span>OAuth</span><AdminStatusPill tone={googleOAuthConfigured() ? "success" : "warning"}>
            {googleOAuthConfigured() ? "Configurado" : "Variáveis pendentes"}
          </AdminStatusPill>
          <span>Conexão</span><AdminStatusPill tone={connection?.status === "connected" ? "success" : "warning"}>
            {connection?.status ?? "desconectado"}
          </AdminStatusPill>
        </div>
      </AdminSection>
    </AdminPage>
  );
}
