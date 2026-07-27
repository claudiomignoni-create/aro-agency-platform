import Link from "next/link";
import { AdminPage, AdminPageHeader, AdminSection } from "@/components/admin/admin-ui";

export default async function PresentationPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminPage>
      <AdminPageHeader
        actions={<Link className="button secondary" href={`/admin/presentations/${id}`}>Voltar</Link>}
        description="Prévia administrativa da apresentação com dados de snapshot."
        eyebrow="Presentation"
        title="Preview"
      />
      <AdminSection title="Preview seguro">
        <p className="muted">A página pública usa `/p/[token]` e nunca expõe dados privados do Cadastro360.</p>
      </AdminSection>
    </AdminPage>
  );
}
