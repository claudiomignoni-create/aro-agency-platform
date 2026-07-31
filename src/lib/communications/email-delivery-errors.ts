export const emailDeliveryErrorCodes = [
  "google-not-configured",
  "google-not-connected",
  "google-scope-insufficient",
  "google-token-revoked",
  "google-refresh-unavailable",
  "external-send-disabled",
  "invalid-recipient",
  "gmail-draft-failed",
  "gmail-send-failed",
  "queue-not-configured",
  "presentation-not-published",
  "delivery-in-progress",
  "email-delivery-failed"
] as const;

export type EmailDeliveryErrorCode = (typeof emailDeliveryErrorCodes)[number];

const messages: Record<EmailDeliveryErrorCode, string> = {
  "delivery-in-progress": "Este envio já está sendo processado. Atualize a fila antes de tentar novamente.",
  "email-delivery-failed": "O e-mail não foi enviado. Consulte o registro operacional para tentar novamente.",
  "external-send-disabled": "O envio para destinatários externos está desativado nesta etapa de segurança.",
  "gmail-draft-failed": "O Gmail não conseguiu criar o rascunho. Reconecte a conta e tente novamente.",
  "gmail-send-failed": "O Gmail não confirmou o envio. A mensagem foi marcada como falha e não será reenviada automaticamente.",
  "google-not-configured": "A Gmail API ainda não está configurada no ambiente.",
  "google-not-connected": "Nenhuma conta Gmail está conectada. Conecte a conta ARO antes de continuar.",
  "google-scope-insufficient": "Reconecte o Gmail para habilitar Caixa de entrada e Enviados.",
  "google-refresh-unavailable": "A autorização do Gmail não pode ser renovada. Reconecte a conta ARO.",
  "google-token-revoked": "O acesso do Gmail foi revogado. Reconecte a conta ARO.",
  "invalid-recipient": "Informe um endereço de e-mail válido.",
  "presentation-not-published": "Publique a apresentação antes de criar um envio seguro.",
  "queue-not-configured": "O processador de agendamentos ainda não está configurado. Use rascunho ou envio imediato."
};

export class EmailDeliveryError extends Error {
  code: EmailDeliveryErrorCode;

  constructor(code: EmailDeliveryErrorCode) {
    super(messages[code]);
    this.code = code;
    this.name = "EmailDeliveryError";
  }
}

export function emailDeliveryErrorMessage(code: string | null | undefined) {
  return code && code in messages
    ? messages[code as EmailDeliveryErrorCode]
    : messages["email-delivery-failed"];
}

export function classifyEmailDeliveryError(
  error: unknown,
  fallback: EmailDeliveryErrorCode = "email-delivery-failed"
) {
  if (error instanceof EmailDeliveryError) return error;

  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  if (/presentation.*not.*published|not-published|presentation_not_published/.test(normalized)) {
    return new EmailDeliveryError("presentation-not-published");
  }
  if (/invalid.*recipient|invalid_recipient|recipient.*email/.test(normalized)) {
    return new EmailDeliveryError("invalid-recipient");
  }
  if (/external.*send|envio.*extern|só é permitido|so e permitido/.test(normalized)) {
    return new EmailDeliveryError("external-send-disabled");
  }
  if (/invalid_grant|revoked|revogado/.test(normalized)) {
    return new EmailDeliveryError("google-token-revoked");
  }
  if (/refresh token|refresh.*unavailable|renovad/.test(normalized)) {
    return new EmailDeliveryError("google-refresh-unavailable");
  }
  if (/google.*not.*configured|gmail api.*configur|missing google_client|variáveis.*google/.test(normalized)) {
    return new EmailDeliveryError("google-not-configured");
  }
  if (/google workspace.*não conectado|google.*not.*connected|conexão google indisponível|conta gmail.*conectada/.test(normalized)) {
    return new EmailDeliveryError("google-not-connected");
  }
  if (/insufficient.*scope|gmail\.modify|scope.*insufficient|escopo.*insuficiente/.test(normalized)) {
    return new EmailDeliveryError("google-scope-insufficient");
  }
  if (/queue.*not.*configured|cron.*not.*configured|processador.*agendamento/.test(normalized)) {
    return new EmailDeliveryError("queue-not-configured");
  }
  if (/already.*processing|delivery.*in.*progress|já está sendo processado/.test(normalized)) {
    return new EmailDeliveryError("delivery-in-progress");
  }
  if (/gmail draft|draft creation/.test(normalized)) {
    return new EmailDeliveryError("gmail-draft-failed");
  }
  if (/gmail send|messages\/send/.test(normalized)) {
    return new EmailDeliveryError("gmail-send-failed");
  }

  return new EmailDeliveryError(fallback);
}
