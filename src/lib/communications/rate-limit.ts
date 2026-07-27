import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { sha256 } from "@/lib/communications/security";

export async function requestIpHash() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headerStore.get("x-real-ip")?.trim();
  const ip = forwardedFor || realIp || "unknown";
  return sha256(`${process.env.RATE_LIMIT_HASH_SALT ?? "aro-dev-salt"}:${ip}`);
}

export async function checkCommunicationRateLimit({
  ipHash,
  limit,
  operation,
  tokenHash,
  windowSeconds
}: {
  ipHash: string;
  limit: number;
  operation: string;
  tokenHash: string;
  windowSeconds: number;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_communication_rate_limit", {
    p_ip_hash: ipHash,
    p_limit: limit,
    p_operation: operation,
    p_token_hash: tokenHash,
    p_window_seconds: windowSeconds
  });

  if (error) throw error;
  return Boolean(data);
}
