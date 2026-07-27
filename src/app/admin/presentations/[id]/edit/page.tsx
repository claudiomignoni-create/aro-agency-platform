import Link from "next/link";
import { AdminPage, AdminPageHeader, AdminSection } from "@/components/admin/admin-ui";

export default async function EditPresentationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AdminPage>
      <AdminPageHeader
        actions={<Link className="button secondary" href={`/admin/presentations/${id}`}>Voltar</Link>}
        description="Edição segura de drafts. Versões publicadas devem gerar nova versão em vez de mudar silenciosamente."
        eyebrow="Presentation"
        title="Editar apresentação"
      />
      <AdminSection title="Editor">
        <p className="muted">
          A estrutura de dados para modelos, materiais, versões e snapshots está criada na migration 025.
        </p>
      </AdminSection>
    </AdminPage>
  );
}
