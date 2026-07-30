import { EmailListPage } from "@/app/admin/email/email-list-page";
import { processEmailQueueNowAction } from "@/app/admin/email/actions";
import {
  EmailOperationalBanner,
  EmailOperationFeedback
} from "@/components/admin/email-center/email-operational-banner";
import { requireRole } from "@/lib/auth";
import { emailDeliveryErrorMessage } from "@/lib/communications/email-delivery-errors";
import { getEmailOperationalState } from "@/lib/communications/operational-state-server";

export default async function QueuePage({
  searchParams
}: {
  searchParams: Promise<{
    error?: string;
    failed?: string;
    notice?: string;
    page?: string;
    processed?: string;
    sent?: string;
    status?: string;
  }>;
}) {
  const query = await searchParams;
  const profile = await requireRole(["admin"]);
  const operationalState = await getEmailOperationalState(profile.id);
  const requested = query.status === "scheduled"
    ? ["scheduled"]
    : ["scheduled", "queued", "processing", "retry_pending", "failed"];
  const processed = Math.max(0, Number.parseInt(query.processed ?? "0", 10) || 0);
  const sent = Math.max(0, Number.parseInt(query.sent ?? "0", 10) || 0);
  const failed = Math.max(0, Number.parseInt(query.failed ?? "0", 10) || 0);
  const feedback = query.error ? (
    <EmailOperationFeedback
      message={emailDeliveryErrorMessage(query.error)}
      title="A fila não foi processada"
    />
  ) : query.notice === "processed" ? (
    <EmailOperationFeedback
      message={`${processed} registro(s) processado(s), ${sent} enviado(s) e ${failed} com falha ou nova tentativa.`}
      success
      title="Processamento manual concluído"
    />
  ) : null;

  return (
    <EmailListPage
      active="/admin/email/queue"
      description="Acompanhe agendamentos, processamento, tentativas futuras e falhas sanitizadas."
      feedback={
        <>
          <EmailOperationalBanner state={operationalState} />
          {feedback}
        </>
      }
      headerActions={
        <form action={processEmailQueueNowAction}>
          <button
            className="button secondary"
            disabled={
              process.env.VERCEL_ENV === "preview" ||
              !operationalState.gmailApiConfigured ||
              !operationalState.accountConnected
            }
            type="submit"
          >
            Processar fila agora
          </button>
        </form>
      }
      page={Number(query.page) || 1}
      statuses={requested}
      title={query.status === "scheduled" ? "Agendados" : "Fila e agendamentos"}
    />
  );
}
