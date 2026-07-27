import { ModelPortalSection } from "@/app/model/portal-section";
import { getModelPortalData } from "@/lib/model-portal";

export default async function ModelPortalRequestsPage() {
  const data = await getModelPortalData();
  return (
    <ModelPortalSection
      title="Solicitações"
      description="Pedidos de atualização enviados pela ARO, com status e prazo."
      items={data.requests}
    />
  );
}
