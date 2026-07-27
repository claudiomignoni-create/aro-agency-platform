import { AgencyForm } from "@/app/admin/agencies/agency-form";
import { createAgencyAction } from "@/app/admin/agencies/actions";

export default function NewAgencyPage() {
  return (
    <div className="stack">
      <section className="aro-glass-card" style={{ padding: 18 }}>
        <span className="eyebrow">Agencies</span>
        <h1>Nova agencia</h1>
      </section>
      <AgencyForm action={createAgencyAction} submitLabel="Criar agencia" />
    </div>
  );
}
