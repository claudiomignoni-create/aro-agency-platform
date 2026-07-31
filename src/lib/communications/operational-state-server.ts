import "server-only";

import { getGoogleConnection } from "@/lib/communications/data";
import {
  classifyEmailDeliveryError,
  emailDeliveryErrorMessage
} from "@/lib/communications/email-delivery-errors";
import {
  resolveEmailOperationalState,
  type EmailOperationalState
} from "@/lib/communications/email-operations";
import {
  externalEmailSendEnabled
} from "@/lib/communications/google-server";
import {
  googleOAuthConfigured,
  hasGoogleMailboxScope
} from "@/lib/communications/google-workspace";

export function communicationsSchedulerConfigured() {
  return Boolean(process.env.COMMUNICATIONS_CRON_SECRET);
}

export function communicationsSchedulerEnabled() {
  return process.env.COMMUNICATIONS_QUEUE_SCHEDULER_ENABLED === "true";
}

export async function getEmailOperationalState(
  profileId: string
): Promise<EmailOperationalState> {
  const connection = await getGoogleConnection(profileId);
  const state = resolveEmailOperationalState({
    connectedEmail: connection?.connected_email,
    connectionLastError: connection?.last_error,
    connectionStatus: connection?.status,
    externalOperationsAllowed: true,
    externalSendEnabled: externalEmailSendEnabled(),
    gmailApiConfigured: googleOAuthConfigured(),
    mailboxAuthorized: hasGoogleMailboxScope(connection?.scopes),
    schedulerEnabled: communicationsSchedulerEnabled(),
    schedulerSecretConfigured: communicationsSchedulerConfigured()
  });

  if (!state.lastErrorMessage) return state;

  const classified = classifyEmailDeliveryError(state.lastErrorMessage);
  return {
    ...state,
    lastErrorCode: classified.code,
    lastErrorMessage: emailDeliveryErrorMessage(classified.code)
  };
}
