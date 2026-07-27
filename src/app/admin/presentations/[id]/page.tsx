import Link from "next/link";
import { AdminPage, AdminPageHeader, AdminSection } from "@/components/admin/admin-ui";

type PresentationDetailProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ token?: string }>;
};

export default async function PresentationDetailPage({ params, searchParams }: PresentationDetailProps) {
  const { id } = await params;
  const query = (await searchParams) ?? {};

  return (
    <AdminPage>
      <AdminPageHeader
        actions={
          <>
            <Link className="button secondary" href={`/admin/presentations/${id}/preview`}>Preview</Link>
            <Link className="button secondary" href={`/admin/presentations/${id}/email`}>Enviar</Link>
            <Link className="button secondary" href={`/admin/presentations/${id}/analytics`}>Analytics</Link>
          </>
        }
        description="Gerencie versão, link público, envio e snapshot. Dados publicados não mudam silenciosamente."
        eyebrow="Presentation"
        title="Detalhe da apresentação"
      />
      {query.token ? (
        <AdminSection title="Link público criado">
          <p className="muted">Copie agora. Por segurança, o token completo não fica armazenado em texto puro.</p>
          <code>{`${process.env.NEXT_PUBLIC_APP_URL ?? "https://aro-agency-platform.vercel.app"}/p/${query.token}`}</code>
        </AdminSection>
      ) : null}
      <AdminSection title="Próxima etapa">
        <p className="muted">
          Selecione modelos e materiais no editor da próxima iteração. O schema já preserva snapshots, versões e eventos de acesso.
        </p>
      </AdminSection>
    </AdminPage>
  );
}
