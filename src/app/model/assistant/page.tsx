import { AIAssistantPanel } from "@/components/ai/ai-assistant-panel";
import { requireRole } from "@/lib/auth";

export default async function ModelAssistantPage() {
  const profile = await requireRole(["model", "admin"]);

  return <AIAssistantPanel role={profile.role} />;
}
