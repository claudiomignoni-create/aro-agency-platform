import type { ReactNode } from "react";
import type { EmailActivityStatus } from "@/lib/communications/email-center";

const statusLabels: Record<EmailActivityStatus, string> = {
  completed: "Concluído",
  draft: "Rascunho",
  failed: "Falhou",
  opened: "Aberto",
  pending: "Pendente",
  replied: "Respondido",
  scheduled: "Agendado",
  sent: "Enviado",
  viewed: "Visualizado"
};

const outboundStatusMap: Record<string, EmailActivityStatus> = {
  canceled: "failed",
  draft: "draft",
  failed: "failed",
  processing: "pending",
  queued: "pending",
  retry_pending: "pending",
  scheduled: "scheduled",
  sent: "sent"
};

export function normalizeEmailStatus(status: string): EmailActivityStatus {
  return outboundStatusMap[status] ?? "pending";
}

export function EmailStatusBadge({
  children,
  status
}: {
  children?: ReactNode;
  status: EmailActivityStatus | string;
}) {
  const normalized =
    status in statusLabels
      ? (status as EmailActivityStatus)
      : normalizeEmailStatus(status);

  return (
    <span className={`email-status-badge is-${normalized}`}>
      <span aria-hidden="true" />
      {children ?? statusLabels[normalized]}
    </span>
  );
}
