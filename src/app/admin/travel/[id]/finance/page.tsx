import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeasonForTrip } from "@/lib/international-seasons";
import { getTravelTrip } from "@/lib/travel";

type TravelFinancePageProps = {
  params: Promise<{ id: string }>;
};

export default async function TravelFinancePage({ params }: TravelFinancePageProps) {
  const { id } = await params;
  const [trip, season] = await Promise.all([getTravelTrip(id), getSeasonForTrip(id)]);

  if (!trip) notFound();

  return (
    <div className="stack">
      <section className="aro-glass-card" style={{ padding: 18 }}>
        <span className="eyebrow">Season Finance</span>
        <h1>Financeiro da temporada</h1>
        <p className="muted">{trip.title}</p>
      </section>
      <section className="aro-glass-card" style={{ padding: 18 }}>
        {season ? (
          <dl className="grid">
            <div><dt>Pagamento final</dt><dd>{season.final_payment_due_date || "Pendente"}</dd></div>
            <div><dt>Moeda</dt><dd>{season.gross_earnings_currency || "Pendente"}</dd></div>
            <div><dt>Share modelo</dt><dd>{season.model_share_percentage ?? "—"}%</dd></div>
            <div><dt>Share agencia</dt><dd>{season.receiving_agency_share_percentage ?? "—"}%</dd></div>
            <div><dt>Share ARO</dt><dd>{season.mother_agency_share_percentage ?? "—"}%</dd></div>
            <div><dt>Status</dt><dd>{season.payment_status}</dd></div>
          </dl>
        ) : (
          <p className="muted">Nenhuma temporada internacional vinculada a esta viagem.</p>
        )}
        <div className="actions">
          <Link className="button secondary" href={`/admin/travel/${trip.id}`}>
            Voltar
          </Link>
          <Link className="button secondary" href="/admin/accounting">
            Accounting
          </Link>
        </div>
      </section>
    </div>
  );
}
