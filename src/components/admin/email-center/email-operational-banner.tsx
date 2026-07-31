import Link from "next/link";
import { AlertTriangle, CheckCircle } from "@/components/admin/admin-icons";
import type { EmailOperationalState } from "@/lib/communications/email-operations";
import styles from "./email-operational-banner.module.css";

function answer(value: boolean) {
  return value ? "Sim" : "Não";
}

export function EmailOperationalBanner({
  state
}: {
  state: EmailOperationalState;
}) {
  const ready =
    state.gmailApiConfigured && state.accountConnected && state.mailboxAuthorized;

  return (
    <section
      aria-label="Estado operacional do Email Center"
      className={`${styles.banner}${ready ? "" : ` ${styles.needsAttention}`}`}
      role={ready ? "status" : "alert"}
    >
      <div className={styles.heading}>
        {ready ? <CheckCircle aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
        <span>
          <strong>{ready ? "Webmail Gmail conectado" : "Webmail Gmail indisponível"}</strong>
          {!ready
            ? "Salvar no sistema continua disponível. Conecte o Gmail antes de preparar ou enviar mensagens externas."
            : "O estado abaixo é verificado no servidor antes de cada operação."}
        </span>
      </div>
      <dl className={styles.grid}>
        <div>
          <dt>Gmail API configurada</dt>
          <dd>{answer(state.gmailApiConfigured)}</dd>
        </div>
        <div>
          <dt>Conta conectada</dt>
          <dd>{answer(state.accountConnected)}</dd>
        </div>
        <div>
          <dt>Conta</dt>
          <dd>{state.connectedEmail ?? "—"}</dd>
        </div>
        <div>
          <dt>Caixa postal</dt>
          <dd>{state.mailboxAuthorized ? "Autorizada" : "Reconexão necessária"}</dd>
        </div>
        <div>
          <dt>Envio externo</dt>
          <dd>
            {!state.externalOperationsAllowed
              ? "Bloqueado no Preview"
              : state.externalSendEnabled
                ? "Ativado"
                : "Desativado"}
          </dd>
        </div>
        <div>
          <dt>Agendamento</dt>
          <dd>{state.schedulingOperational ? "Operacional" : "Não configurado"}</dd>
        </div>
        <div>
          <dt>Último erro</dt>
          <dd>{state.lastErrorMessage ?? "—"}</dd>
        </div>
      </dl>
      {!ready ? (
        <Link className="button secondary" href="/admin/settings?tab=integrations">
          Conectar Gmail
        </Link>
      ) : null}
    </section>
  );
}

export function EmailOperationFeedback({
  message,
  success = false,
  title
}: {
  message: string;
  success?: boolean;
  title: string;
}) {
  return (
    <div
      className={`${styles.feedback}${success ? ` ${styles.success}` : ""}`}
      role={success ? "status" : "alert"}
    >
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}
