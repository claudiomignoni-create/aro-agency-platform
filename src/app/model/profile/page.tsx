import { ModelPortalSection } from "@/app/model/portal-section";
import { getModelPortalData } from "@/lib/model-portal";

export default async function ModelProfilePage() {
  const data = await getModelPortalData();
  const model = data.model;

  return (
    <ModelPortalSection
      title="Perfil"
      description="Informações comerciais visíveis com privacidade separada dos dados internos da ARO."
      items={[
        { title: "Nome", meta: model?.stage_name || model?.display_name || "—" },
        { title: "E-mail", meta: model?.email || "—" },
        { title: "Base", meta: [model?.base_city, model?.base_country].filter(Boolean).join(", ") || "—" },
        { title: "Última atualização", meta: model?.updated_at ? new Date(model.updated_at).toLocaleString("pt-BR") : "—" }
      ]}
    />
  );
}
