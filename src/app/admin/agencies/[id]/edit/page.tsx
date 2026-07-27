import { notFound } from "next/navigation";
import { AgencyForm } from "@/app/admin/agencies/agency-form";
import { updateAgencyAction } from "@/app/admin/agencies/actions";
import { getPartnerAgency } from "@/lib/agencies";

type EditAgencyPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditAgencyPage({ params }: EditAgencyPageProps) {
  const { id } = await params;
  const agency = await getPartnerAgency(id);

  if (!agency) notFound();

  const action = updateAgencyAction.bind(null, agency.id);

  return (
    <div className="stack">
      <section className="aro-glass-card" style={{ padding: 18 }}>
        <span className="eyebrow">Agencies</span>
        <h1>Editar agencia</h1>
      </section>
      <AgencyForm action={action} agency={agency} submitLabel="Salvar agencia" />
    </div>
  );
}
