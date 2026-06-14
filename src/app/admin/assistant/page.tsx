import { AIAssistantPanel } from "@/components/ai/ai-assistant-panel";
import { requireRole } from "@/lib/auth";

export default async function AdminAssistantPage() {
  const profile = await requireRole(["admin"]);

  return <AIAssistantPanel role={profile.role} />;
}
