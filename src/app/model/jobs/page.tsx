import { ModelPortalSection } from "@/app/model/portal-section";
import { getModelPortalData } from "@/lib/model-portal";

export default async function ModelPortalJobsPage() {
  const data = await getModelPortalData();
  return (
    <ModelPortalSection
      title="Trabalhos"
      description="Jobs, castings e opções vinculados ao seu perfil."
      items={data.jobs}
    />
  );
}
