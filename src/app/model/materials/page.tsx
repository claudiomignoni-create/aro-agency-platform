import { ModelPortalSection } from "@/app/model/portal-section";
import { getModelPortalData } from "@/lib/model-portal";

export default async function ModelPortalMaterialsPage() {
  const data = await getModelPortalData();
  return (
    <ModelPortalSection
      title="Materiais"
      description="Portfolio, polaroids, vídeos e composites registrados para revisão da ARO."
      items={data.materials}
    />
  );
}
