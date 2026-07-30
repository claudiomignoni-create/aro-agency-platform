import type { EmailDeliveryErrorCode } from "@/lib/communications/email-delivery-errors";

export type EmailOperationalState = {
  accountConnected: boolean;
  connectedEmail: string | null;
  externalOperationsAllowed: boolean;
  externalSendEnabled: boolean;
  gmailApiConfigured: boolean;
  lastErrorCode: EmailDeliveryErrorCode | null;
  lastErrorMessage: string | null;
  schedulingOperational: boolean;
};

export type EmailOperationalInputs = {
  connectedEmail?: string | null;
  connectionLastError?: unknown;
  connectionStatus?: string | null;
  externalOperationsAllowed?: boolean;
  externalSendEnabled: boolean;
  gmailApiConfigured: boolean;
  schedulerEnabled: boolean;
  schedulerSecretConfigured: boolean;
};

export function resolveEmailOperationalState({
  connectedEmail = null,
  connectionLastError,
  connectionStatus,
  externalOperationsAllowed = true,
  externalSendEnabled,
  gmailApiConfigured,
  schedulerEnabled,
  schedulerSecretConfigured
}: EmailOperationalInputs): EmailOperationalState {
  const accountConnected = connectionStatus === "connected" && Boolean(connectedEmail);
  const schedulingOperational =
    gmailApiConfigured &&
    accountConnected &&
    schedulerEnabled &&
    schedulerSecretConfigured;

  return {
    accountConnected,
    connectedEmail,
    externalOperationsAllowed,
    externalSendEnabled,
    gmailApiConfigured,
    lastErrorCode: null,
    lastErrorMessage:
      typeof connectionLastError === "string" && connectionLastError.trim()
        ? connectionLastError.trim()
        : null,
    schedulingOperational
  };
}

export function modeIsAvailable(
  mode: string,
  state: EmailOperationalState
) {
  if (mode === "system_draft") return true;
  if (!state.externalOperationsAllowed) return false;
  if (!state.gmailApiConfigured || !state.accountConnected) return false;
  if (mode === "scheduled") return state.schedulingOperational;
  return mode === "gmail_draft" || mode === "send_now";
}
