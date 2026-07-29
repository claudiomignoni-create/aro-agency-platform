import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { sha256 } from "@/lib/communications/security";

export async function requestIpHash() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headerStore.get("x-real-ip")?.trim();
  const ip = forwardedFor || realIp || "unknown";
  const salt = process.env.RATE_LIMIT_HASH_SALT;
  if (!salt && process.env.NODE_ENV === "production") {
    throw new Error("RATE_LIMIT_HASH_SALT is required in production.");
  }
  return sha256(`${salt ?? "aro-dev-salt"}:${ip}`);
}

export async function checkCommunicationRateLimit({
  ipHash,
  operation,
  tokenHash
}: {
  ipHash: string;
  operation: string;
  tokenHash: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("check_communication_rate_limit", {
    p_ip_hash: ipHash,
    p_operation: operation,
    p_token_hash: tokenHash
  });

  if (error) throw error;
  return Boolean(data);
}

export async function checkPresentationRateLimitWithLegacyFallback({
  ipHash,
  operation,
  tokenHash
}: {
  ipHash: string;
  operation:
    | "presentation_download"
    | "presentation_event"
    | "presentation_selection_change"
    | "presentation_selection_submit";
  tokenHash: string;
}) {
  try {
    return await checkCommunicationRateLimit({ ipHash, operation, tokenHash });
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error ? String(error.message) : "";
    if (!/unsupported_rate_limit_operation/i.test(message)) throw error;

    return checkCommunicationRateLimit({
      ipHash,
      operation: "presentation_open",
      tokenHash
    });
  }
}
