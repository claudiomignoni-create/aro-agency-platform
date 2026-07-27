import { ModelPortalSection } from "@/app/model/portal-section";
import { getModelPortalData } from "@/lib/model-portal";

export default async function ModelPortalTravelPage() {
  const data = await getModelPortalData();
  return (
    <ModelPortalSection
      title="Travel"
      description="Viagens, temporadas e deslocamentos vinculados ao seu perfil."
      items={data.travel}
    />
  );
}
