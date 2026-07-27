import Link from "next/link";
import { AdminPage, AdminPageHeader, AdminSection, AdminSelectField, AdminTextField } from "@/components/admin/admin-ui";
import { createPresentationAction } from "@/app/admin/presentations/actions";

export default function NewPresentationPage() {
  return (
    <AdminPage>
      <AdminPageHeader
        actions={<Link className="button secondary" href="/admin/presentations">Voltar</Link>}
        description="Crie um draft. Apresentações publicadas usam snapshot e não mudam silenciosamente."
        eyebrow="Presentations"
        title="Nova apresentação"
      />
      <AdminSection title="Dados da apresentação">
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
          <label className="admin-field span-2">
            <span>Descrição</span>
            <textarea name="description" rows={5} />
          </label>
          <label className="admin-field">
            <span>Downloads</span>
            <span className="admin-inline-check"><input name="allow_downloads" type="checkbox" /> Permitir downloads autorizados</span>
          </label>
          <button className="button" type="submit">Criar draft</button>
        </form>
      </AdminSection>
    </AdminPage>
  );
}
