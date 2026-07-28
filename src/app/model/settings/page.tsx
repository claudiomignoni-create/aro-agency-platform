import { ModelPortalSection } from "@/app/model/portal-section";
import { getModelPortalData } from "@/lib/model-portal";

export default async function ModelPortalSettingsPage() {
  const data = await getModelPortalData();
  return (
    <ModelPortalSection
      title="Configurações"
      description="Preferências básicas do portal. Alterações sensíveis continuam sob revisão da ARO."
      items={[
        { title: "Perfil vinculado", meta: data.model?.stage_name || data.model?.display_name || "Não vinculado" },
        { title: "Privacidade", meta: "Dados sensíveis não são exibidos em apresentações públicas." }
      ]}
    />
  );
}
