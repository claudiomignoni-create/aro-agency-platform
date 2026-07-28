import { ModelPortalSection } from "@/app/model/portal-section";
import { getModelPortalData } from "@/lib/model-portal";

export default async function ModelPortalPaymentsPage() {
  const data = await getModelPortalData();
  return (
    <ModelPortalSection
      title="Pagamentos"
      description="Resumo financeiro vinculado ao seu perfil. Moedas nunca são convertidas automaticamente."
      items={data.payments}
    />
  );
}
