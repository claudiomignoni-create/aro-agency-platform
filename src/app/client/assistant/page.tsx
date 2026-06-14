import { AIAssistantPanel } from "@/components/ai/ai-assistant-panel";
import { requireRole } from "@/lib/auth";

export default async function ClientAssistantPage() {
  const profile = await requireRole(["client", "admin"]);

  return <AIAssistantPanel role={profile.role} />;
}
