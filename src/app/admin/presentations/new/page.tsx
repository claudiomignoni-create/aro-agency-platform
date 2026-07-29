import Link from "next/link";
import {
  AdminPage,
  AdminPageHeader,
  AdminSection,
  AdminSelectField,
  AdminTextField
} from "@/components/admin/admin-ui";
import { createPresentationAction } from "@/app/admin/presentations/actions";
import { requireRole } from "@/lib/auth";
import { isMissingSchemaError } from "@/lib/accounting-schema";
import { createClient } from "@/lib/supabase/server";
import styles from "./presentation-new.module.css";

function option(label: string, value: string) {
  return { label, value };
}

export default async function NewPresentationPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const [clientsResult, agenciesResult] = await Promise.all([
    supabase.from("clients").select("id, company_name").order("company_name", { ascending: true }).limit(100),
    supabase.from("partner_agencies").select("id, display_name").order("display_name", { ascending: true }).limit(100)
  ]);

  if (clientsResult.error) throw clientsResult.error;
  if (agenciesResult.error && !isMissingSchemaError(agenciesResult.error)) {
    throw agenciesResult.error;
  }

  const clientOptions = [
    option("Sem cliente", "none"),
    ...((clientsResult.data ?? []) as Array<{ company_name: string; id: string }>).map((client) =>
      option(client.company_name, client.id)
    )
  ];
  const agencyOptions = [
    option("Sem agência", "none"),
    ...((agenciesResult.data ?? []) as Array<{ display_name: string; id: string }>).map((agency) =>
      option(agency.display_name, agency.id)
    )
  ];

  return (
    <AdminPage>
      <AdminPageHeader
        actions={<Link className="button secondary" href="/admin/presentations">Cancelar</Link>}
        description="Comece pelas informações essenciais. Em seguida, você será levado diretamente para a galeria de modelos."
        eyebrow="Presentations"
        title="Nova apresentação"
      />

      <ol aria-label="Etapas da apresentação" className={styles.stepper}>
        <li className={styles.active}><b>1</b><span>Informações</span></li>
        <li><b>2</b><span>Selecionar modelos</span></li>
        <li><b>3</b><span>Organizar materiais</span></li>
        <li><b>4</b><span>Revisar e publicar</span></li>
      </ol>

      <AdminSection title="Informações da apresentação">
        <form action={createPresentationAction} className="admin-form-grid">
          <AdminTextField label="Título" name="title" placeholder="Seleção ARO" />
          <AdminTextField label="Finalidade" name="purpose" placeholder="Casting, direct booking, shortlist..." />
          <AdminSelectField
            defaultValue="pt-BR"
            label="Idioma"
            name="language"
            options={[
              { label: "Português", value: "pt-BR" },
              { label: "English", value: "en" }
            ]}
          />
          <AdminSelectField
            defaultValue="none"
            label="Cliente"
            name="client_id"
            options={clientOptions}
          />
          <AdminSelectField
            defaultValue="none"
            label="Agência"
            name="agency_id"
            options={agencyOptions}
          />
          <label className="admin-field">
            <span>Validade</span>
            <input name="expires_at" type="datetime-local" />
          </label>
          <label className="admin-field span-2">
            <span>Descrição</span>
            <textarea name="description" rows={5} />
          </label>
          <label className="admin-field">
            <span>Downloads</span>
            <span className="admin-inline-check">
              <input name="allow_downloads" type="checkbox" /> Permitir downloads autorizados
            </span>
          </label>
          <div className={styles.actions}>
            <Link className="button secondary" href="/admin/presentations">Cancelar</Link>
            <button className="button" type="submit">Continuar para modelos</button>
          </div>
        </form>
      </AdminSection>
    </AdminPage>
  );
}
