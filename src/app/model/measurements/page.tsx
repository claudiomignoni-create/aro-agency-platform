import { ModelPortalSection } from "@/app/model/portal-section";
import { getModelPortalData } from "@/lib/model-portal";

export default async function ModelPortalMeasurementsPage() {
  const data = await getModelPortalData();
  return (
    <ModelPortalSection
      title="Medidas"
      description="Medidas atuais usadas pela ARO em castings e apresentações autorizadas."
      items={data.measurements}
    />
  );
}
