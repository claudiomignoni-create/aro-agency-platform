import Link from "next/link";
import { AdminPage, AdminPageHeader, AdminSection } from "@/components/admin/admin-ui";

export default async function PresentationAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminPage>
      <AdminPageHeader
        actions={<Link className="button secondary" href={`/admin/presentations/${id}`}>Voltar</Link>}
        description="Eventos de acesso e recipients são registrados na migration 025."
        eyebrow="Presentation"
        title="Analytics"
      />
      <AdminSection title="Eventos">
        <p className="muted">A instrumentação pública registra acessos sem dados privados e sem identificação sensível.</p>
      </AdminSection>
    </AdminPage>
  );
}
