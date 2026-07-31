import Image from "next/image";
import Link from "next/link";
import { getAdminUserProfile, getProfilePreferencesStatus } from "@/lib/admin-profile";
import { isMissingSchemaError } from "@/lib/accounting-schema";
import { getBuildShortSha } from "@/lib/build-info";
import { getCommunicationSchemaState, getGoogleConnection } from "@/lib/communications/data";
import { emailDeliveryErrorMessage } from "@/lib/communications/email-delivery-errors";
import {
  aroGoogleEmail,
  googleOAuthConfigured,
  googleScopes,
  hasGoogleMailboxScope
} from "@/lib/communications/google-workspace";
import { getEmailOperationalState } from "@/lib/communications/operational-state-server";
import { createClient } from "@/lib/supabase/server";
import { GoogleTestEmailForm } from "@/app/admin/settings/google-test-email-form";
import {
  EmailOperationalBanner,
  EmailOperationFeedback
} from "@/components/admin/email-center/email-operational-banner";
import {
  updateAdminEmailAction,
  updateAdminProfileAction,
  updateAppearanceAction
} from "@/app/admin/settings/actions";

type SettingsPageProps = {
  searchParams?: Promise<{
    saved?: string;
    tab?: string;
    theme?: string;
    error?: string;
    google?: string;
  }>;
};

const tabs = [
  { id: "profile", label: "Perfil" },
  { id: "appearance", label: "Aparência" },
  { id: "account", label: "Conta" },
  { id: "integrations", label: "Integrações" },
  { id: "preferences", label: "Preferências" }
] as const;

async function getStoredTheme(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_preferences")
    .select("theme")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && isMissingSchemaError(error)) return "system";
  if (error) throw error;

  return data?.theme ?? "system";
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = (await searchParams) ?? {};
  const profile = await getAdminUserProfile();

  if (!profile) {
    return null;
  }

  const [
    profileSchema,
    storedTheme,
    communicationSchema,
    googleConnection,
    emailOperationalState
  ] = await Promise.all([
    getProfilePreferencesStatus(),
    getStoredTheme(profile.id),
    getCommunicationSchemaState(),
    getGoogleConnection(profile.id),
    getEmailOperationalState(profile.id)
  ]);
  const activeTab = tabs.some((tab) => tab.id === params.tab) ? params.tab : "profile";
  const buildShortSha = getBuildShortSha();

  return (
    <div className="settings-page">
      <section className="aro-glass-card settings-hero">
        <div>
          <span className="eyebrow">Settings</span>
          <h1>Settings</h1>
          <p>Perfil, conta, aparência e preferências administrativas da ARO.</p>
        </div>
        {params.saved ? <span className="status">Alterações salvas</span> : null}
      </section>

      {!profileSchema.ready ? (
        <section className="aro-glass-card settings-notice">
          Os campos de cargo, foto, telefone e idioma serão ativados após a migration 017.
        </section>
      ) : null}

      <nav className="settings-tabs" aria-label="Configurações">
        {tabs.map((tab) => (
          <Link
            className={activeTab === tab.id ? "active" : ""}
            href={`/admin/settings?tab=${tab.id}`}
            key={tab.id}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {activeTab === "profile" ? (
        <section className="aro-glass-card settings-panel">
          <div className="settings-profile-preview">
            {profile.avatar_url ? (
              <img alt={profile.full_name || "Perfil"} src={profile.avatar_url} />
            ) : (
              <Image alt="ARO" height={76} src="/brand/aro-mark.png" width={76} />
            )}
            <div>
              <strong>{profile.full_name || profile.email || "Administrador"}</strong>
              <span>{profile.title || "Administrador"}</span>
            </div>
          </div>
          <form action={updateAdminProfileAction} className="settings-form">
            <label>
              Nome
              <input defaultValue={profile.full_name ?? ""} name="full_name" />
            </label>
            <label>
              Cargo
              <input defaultValue={profile.title ?? ""} disabled={!profileSchema.ready} name="title" />
            </label>
            <label>
              Foto
              <input
                defaultValue={profile.avatar_url ?? ""}
                disabled={!profileSchema.ready}
                name="avatar_url"
                placeholder="URL segura da foto"
                type="url"
              />
            </label>
            <label>
              Telefone
              <input defaultValue={profile.phone ?? ""} disabled={!profileSchema.ready} name="phone" />
            </label>
            <label>
              Idioma preferido
              <select
                defaultValue={profile.preferred_language ?? "pt-BR"}
                disabled={!profileSchema.ready}
                name="preferred_language"
              >
                <option value="pt-BR">Português</option>
                <option value="en">English</option>
              </select>
            </label>
            <button className="button" type="submit">
              Salvar perfil
            </button>
          </form>
        </section>
      ) : null}

      {activeTab === "appearance" ? (
        <section className="aro-glass-card settings-panel">
          <form action={updateAppearanceAction} className="settings-form">
            <label>
              Tema
              <select defaultValue={params.theme ?? storedTheme} name="theme">
                <option value="system">Sistema</option>
                <option value="light">Claro</option>
                <option value="dark">Escuro</option>
              </select>
            </label>
            <p className="muted">
              O shell administrativo também aplica o tema imediatamente pelo seletor da sidebar.
            </p>
            <button className="button" type="submit">
              Salvar aparência
            </button>
          </form>
        </section>
      ) : null}

      {activeTab === "account" ? (
        <section className="aro-glass-card settings-panel">
          <form action={updateAdminEmailAction} className="settings-form">
            <label>
              E-mail
              <input defaultValue={profile.email ?? ""} name="email" required type="email" />
            </label>
            <p className="muted">
              A troca de e-mail usa o fluxo oficial do Supabase Auth e pode exigir confirmação.
            </p>
            <button className="button" type="submit">
              Solicitar troca de e-mail
            </button>
          </form>
        </section>
      ) : null}

      {activeTab === "integrations" ? (
        <section className="aro-glass-card settings-panel">
          <EmailOperationalBanner state={emailOperationalState} />
          {params.google === "connected" ? (
            <EmailOperationFeedback
              message="A conta ARO foi conectada. Faça o teste controlado antes de liberar destinatários externos."
              success
              title="Google Workspace conectado"
            />
          ) : params.google === "test-sent" ? (
            <EmailOperationFeedback
              message={`O Gmail confirmou o envio controlado para ${aroGoogleEmail}.`}
              success
              title="Teste enviado"
            />
          ) : params.google ? (
            <EmailOperationFeedback
              message={
                params.error
                  ? emailDeliveryErrorMessage(params.error)
                  : params.google === "wrong-account"
                    ? `Conecte somente a conta ${aroGoogleEmail}.`
                    : params.google === "missing-env"
                      ? "As variáveis da Gmail API ainda não estão configuradas."
                      : params.google === "no-connection"
                        ? "Conecte a conta Gmail antes de executar o teste."
                        : "A operação com o Google não foi concluída. Revise o estado abaixo."
              }
              title="Integração requer atenção"
            />
          ) : null}
          <div className="settings-integration-card">
            <div>
              <span className="eyebrow">Google Workspace</span>
              <h2>Gmail API</h2>
              <p className="muted">
                Webmail, rascunhos e envios usam somente a conta Claudio Mignoni &lt;{aroGoogleEmail}&gt;.
              </p>
            </div>
            <div className="settings-integration-status">
              <span>Schema</span>
              <strong>{communicationSchema.ready ? "Ativo" : "Migration 025 pendente"}</strong>
              <span>OAuth</span>
              <strong>{emailOperationalState.gmailApiConfigured ? "Configurado" : "Variáveis pendentes"}</strong>
              <span>Conta</span>
              <strong>{googleConnection?.connected_email ?? "Desconectado"}</strong>
              <span>Status</span>
              <strong>{googleConnection?.status ?? "desconectado"}</strong>
              <span>Envio externo</span>
              <strong>{emailOperationalState.externalSendEnabled ? "Ativado" : "Desativado"}</strong>
              <span>Agendamento</span>
              <strong>{emailOperationalState.schedulingOperational ? "Operacional" : "Não configurado"}</strong>
              <span>Escopos</span>
              <strong>{(googleConnection?.scopes?.length ? googleConnection.scopes : [...googleScopes]).join(", ")}</strong>
              <span>Caixa postal</span>
              <strong>{hasGoogleMailboxScope(googleConnection?.scopes) ? "Autorizada" : "Reconexão necessária"}</strong>
              <span>Token expira</span>
              <strong>{googleConnection?.token_expires_at ? new Date(googleConnection.token_expires_at).toLocaleString("pt-BR") : "—"}</strong>
              <span>Último uso</span>
              <strong>{googleConnection?.last_used_at ? new Date(googleConnection.last_used_at).toLocaleString("pt-BR") : "—"}</strong>
              <span>Último erro</span>
              <strong>{emailOperationalState.lastErrorMessage ?? "—"}</strong>
            </div>
            <div className="settings-integration-actions">
              {googleOAuthConfigured() ? (
                <Link className="button" href="/api/integrations/google/connect">
                  {googleConnection?.status === "connected" ? "Reconectar" : "Conectar"}
                </Link>
              ) : (
                <button className="button" disabled type="button">
                  Conectar
                </button>
              )}
              <GoogleTestEmailForm
                enabled={
                  emailOperationalState.gmailApiConfigured &&
                  emailOperationalState.accountConnected
                }
              />
              {googleConnection ? (
                <form action="/api/integrations/google/disconnect" method="post">
                  <button className="button secondary" type="submit">Desconectar</button>
                </form>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "preferences" ? (
        <section className="aro-glass-card settings-panel">
          <h2>Preferências</h2>
          <p className="muted">
            Preferências operacionais avançadas serão conectadas a `user_preferences`
            após a atualização do banco. Nenhum dado fictício foi criado.
          </p>
        </section>
      ) : null}

      <p className="settings-build muted">Build {buildShortSha}</p>

      <style>{`
        .settings-page {
          display: grid;
          gap: 14px;
        }

        .settings-hero,
        .settings-panel,
        .settings-notice {
          padding: 18px;
        }

        .settings-hero {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 16px;
        }

        .settings-hero h1 {
          margin: 0 0 8px;
          font-size: clamp(28px, 4vw, 44px);
        }

        .settings-hero p,
        .settings-notice {
          margin: 0;
          color: var(--admin-muted);
        }

        .settings-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .settings-tabs a {
          border: 1px solid var(--admin-border);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.055);
          color: var(--admin-muted);
          font-size: 13px;
          font-weight: 800;
          padding: 10px 14px;
        }

        .settings-tabs a.active {
          border-color: var(--admin-border-strong);
          background: rgba(45, 133, 255, 0.26);
          color: var(--admin-text);
        }

        .settings-profile-preview {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 18px;
        }

        .settings-profile-preview img {
          width: 76px;
          height: 76px;
          border-radius: 999px;
          object-fit: cover;
        }

        .settings-profile-preview strong,
        .settings-profile-preview span {
          display: block;
        }

        .settings-profile-preview span {
          color: var(--admin-muted);
        }

        .settings-form {
          display: grid;
          max-width: 760px;
          gap: 12px;
        }

        .settings-form label {
          display: grid;
          gap: 7px;
          color: var(--admin-muted);
          font-size: 12px;
          font-weight: 800;
        }

        .settings-form input,
        .settings-form select {
          min-height: 44px;
          border: 1px solid var(--admin-border);
          border-radius: 10px;
          background: rgba(2, 18, 50, 0.34);
          color: var(--admin-text);
          padding: 0 12px;
        }

        .settings-form input:disabled,
        .settings-form select:disabled {
          cursor: not-allowed;
          opacity: 0.62;
        }

        .settings-integration-card {
          display: grid;
          gap: 14px;
        }

        .settings-integration-status {
          display: grid;
          grid-template-columns: minmax(120px, 0.3fr) minmax(0, 1fr);
          gap: 8px 12px;
          color: var(--admin-muted);
          font-size: var(--admin-font-body);
        }

        .settings-integration-status strong {
          color: var(--admin-text);
          overflow-wrap: anywhere;
        }

        .settings-integration-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .settings-build {
          margin: 0;
          font-size: var(--admin-font-label);
          font-weight: 800;
          text-align: right;
        }
      `}</style>
    </div>
  );
}
