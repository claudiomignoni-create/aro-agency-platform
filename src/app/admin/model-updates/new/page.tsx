import Link from "next/link";
import { AdminPage, AdminPageHeader, AdminSection, AdminSelectField, AdminTextField } from "@/components/admin/admin-ui";
import { createModelUpdateRequestAction } from "@/app/admin/model-updates/actions";
import { listModels } from "@/lib/models";

const requestFields = [
  ["measurements", "Medidas"],
  ["contact", "Contato"],
  ["location", "Localização"],
  ["portfolio", "Portfolio"],
  ["polaroids", "Polaroids"],
  ["videos", "Vídeos"],
  ["documents", "Documentos"],
  ["passport", "Passaporte"],
  ["visa", "Visto"],
  ["banking", "Dados bancários"],
  ["health", "Saúde"]
];

export default async function NewModelUpdateRequestPage() {
  const models = await listModels();

  return (
    <AdminPage>
      <AdminPageHeader
        actions={<Link className="button secondary" href="/admin/model-updates">Voltar</Link>}
        description="Gere um link seguro, revogável e expirável. Campos sensíveis sempre exigem revisão."
        eyebrow="Model Portal"
        title="Solicitar atualização"
      />
      <AdminSection title="Pedido">
        <form action={createModelUpdateRequestAction} className="admin-form-grid">
          <AdminSelectField
            label="Modelo"
            name="model_id"
            options={[
              { label: "Selecione", value: "" },
              ...models.map((model) => ({
                label: model.stage_name || model.display_name || model.legal_name || "Modelo",
                value: model.id
              }))
            ]}
          />
          <AdminSelectField
            defaultValue="pt-BR"
            label="Idioma"
            name="language"
            options={[
              { label: "Português", value: "pt-BR" },
              { label: "English", value: "en" }
            ]}
          />
          <AdminTextField label="Título" name="title" placeholder="Atualização do perfil ARO" />
          <label className="admin-field span-2">
            <span>Mensagem</span>
            <textarea name="message" rows={5} />
          </label>
          <fieldset className="admin-field span-2">
            <legend>Campos solicitados</legend>
            <div className="admin-checkbox-grid">
              {requestFields.map(([value, label]) => (
                <label key={value}>
                  <input name="fields" type="checkbox" value={value} /> {label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="admin-field">
            <span>Autoaplicação segura</span>
            <span className="admin-inline-check">
              <input defaultChecked name="auto_apply_safe_fields" type="checkbox" /> Aplicar campos não sensíveis
            </span>
          </label>
          <button className="button" type="submit">Gerar link seguro</button>
        </form>
      </AdminSection>
    </AdminPage>
  );
}
