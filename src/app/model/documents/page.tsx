import { ModelPortalSection } from "@/app/model/portal-section";
import { getModelPortalData } from "@/lib/model-portal";

export default async function ModelPortalDocumentsPage() {
  const data = await getModelPortalData();
  return (
    <ModelPortalSection
      title="Documentos"
      description="Documentos privados permanecem visíveis somente para você e para a ARO."
      items={data.documents}
    />
  );
}
