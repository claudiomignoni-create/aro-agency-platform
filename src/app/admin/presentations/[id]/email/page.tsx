import Link from "next/link";
import { AdminPage, AdminPageHeader, AdminSection } from "@/components/admin/admin-ui";

export default async function PresentationEmailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminPage>
      <AdminPageHeader
        actions={<Link className="button secondary" href={`/admin/presentations/${id}`}>Voltar</Link>}
        description="Envio individual por Email Center, sem CC em massa."
        eyebrow="Presentation"
        title="Enviar apresentação"
      />
      <AdminSection title="Envio por e-mail">
        <p className="muted">
          Use o Email Center para criar rascunho Gmail ou envio controlado. Anexos pesados e portfolios completos não são anexados.
        </p>
        <Link className="button" href="/admin/email/compose">Compor e-mail</Link>
      </AdminSection>
    </AdminPage>
  );
}
