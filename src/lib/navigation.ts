import type { UserRole } from "@/types/database";

export function getDefaultRouteForRole(role: UserRole) {
  if (role === "admin") return "/admin";
  if (role === "model") return "/model";
  return "/client";
}
