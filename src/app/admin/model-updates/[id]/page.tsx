import Link from "next/link";
import { AdminPage, AdminPageHeader, AdminSection } from "@/components/admin/admin-ui";

type ModelUpdateDetailProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ token?: string }>;
};

export default async function ModelUpdateDetailPage({ params, searchParams }: ModelUpdateDetailProps) {
  const { id } = await params;
  const query = (await searchParams) ?? {};

  return (
    <AdminPage>
      <AdminPageHeader
        actions={<Link className="button secondary" href="/admin/model-updates">Voltar</Link>}
        description="Acompanhe abertura, início, envio, revisão e aplicação."
        eyebrow="Model Portal"
        title="Solicitação de atualização"
      />
      {query.token ? (
        <AdminSection title="Link seguro criado">
          <p className="muted">Copie agora. O banco guarda apenas o hash do token.</p>
          <code>{`${process.env.NEXT_PUBLIC_APP_URL ?? "https://aro-agency-platform.vercel.app"}/update/${query.token}`}</code>
        </AdminSection>
      ) : null}
      <AdminSection title="Histórico e revisão">
        <p className="muted">
          A migration 025 cria snapshots, auditoria e revisão obrigatória para dados sensíveis.
        </p>
        <Link className="button secondary" href={`/admin/models?updateRequest=${id}`}>Ver modelo</Link>
      </AdminSection>
    </AdminPage>
  );
}
