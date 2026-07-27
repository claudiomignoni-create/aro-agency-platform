import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Plane } from "@/components/admin/admin-icons";
import { getTravelTrip, flightStatusLabel, tripReasonLabel, tripStatusLabel } from "@/lib/travel";

type TravelDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "America/Sao_Paulo",
    year: "numeric"
  }).format(new Date(value));
}

export default async function TravelDetailPage({ params }: TravelDetailPageProps) {
  const { id } = await params;
  const trip = await getTravelTrip(id);

  if (!trip) notFound();

  return (
    <div className="travel-detail">
      <section className="aro-glass-card travel-detail-hero">
        <div>
          <span className="eyebrow">Travel</span>
          <h1>{trip.title}</h1>
          <p>{trip.model?.stage_name || trip.model?.display_name || "Modelo"}</p>
        </div>
        <div className="actions">
          <Link className="button secondary" href="/admin/travel">
            Voltar
          </Link>
          <Link className="button" href={`/admin/travel/${trip.id}/edit`}>
            Editar
          </Link>
        </div>
      </section>

      <section className="travel-detail-grid">
        <article className="aro-glass-card travel-detail-card">
          <h2>Resumo</h2>
          <dl>
            <div><dt>Status</dt><dd>{tripStatusLabel(trip.status)}</dd></div>
            <div><dt>Motivo</dt><dd>{tripReasonLabel(trip.reason)}</dd></div>
            <div><dt>Origem</dt><dd>{[trip.origin_city, trip.origin_country].filter(Boolean).join(", ") || "—"}</dd></div>
            <div><dt>Destino</dt><dd>{[trip.destination_city, trip.destination_country].filter(Boolean).join(", ") || "—"}</dd></div>
            <div><dt>Agência</dt><dd>{trip.agency_name || "—"}</dd></div>
            <div><dt>Período</dt><dd>{[trip.starts_on, trip.ends_on].filter(Boolean).join(" → ") || "—"}</dd></div>
          </dl>
        </article>

        <article className="aro-glass-card travel-detail-card span-2">
          <h2>Trechos de voo</h2>
          <div className="flight-list">
            {trip.flight_segments.length > 0 ? (
              trip.flight_segments.map((segment) => (
                <div className="flight-card" key={segment.id}>
                  <Plane aria-hidden="true" />
                  <div>
                    <strong>{[segment.airline_code, segment.flight_number].filter(Boolean).join(" ") || segment.airline_name || "Voo"}</strong>
                    <small>{[segment.departure_iata, segment.arrival_iata].filter(Boolean).join(" → ") || "Rota não informada"}</small>
                  </div>
                  <dl>
                    <div><dt>Partida</dt><dd>{formatDateTime(segment.departure_at)}</dd></div>
                    <div><dt>Chegada</dt><dd>{formatDateTime(segment.arrival_at)}</dd></div>
                    <div><dt>PNR</dt><dd>{segment.pnr || "—"}</dd></div>
                    <div><dt>Ticket</dt><dd>{segment.ticket_number || "—"}</dd></div>
                    <div><dt>Status</dt><dd>{flightStatusLabel(segment.status)}</dd></div>
                    <div><dt>Assento</dt><dd>{segment.seat || "—"}</dd></div>
                  </dl>
                </div>
              ))
            ) : (
              <p className="muted">Nenhum trecho cadastrado.</p>
            )}
          </div>
        </article>

        <article className="aro-glass-card travel-detail-card span-3">
          <h2>Documentos privados</h2>
          <div className="documents-note">
            <FileText aria-hidden="true" />
            <p>
              A tabela de documentos usa o bucket privado <strong>model-documents</strong> com prefixo
              <strong> travel/</strong>. O upload completo deve ser ativado após aplicar a migration
              018 no ambiente correto.
            </p>
          </div>
        </article>
      </section>

      <style>{`
        .travel-detail {
          display: grid;
          gap: 14px;
        }

        .travel-detail-hero,
        .travel-detail-card {
          padding: 18px;
        }

        .travel-detail-hero {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 16px;
        }

        .travel-detail-hero h1 {
          margin: 0 0 6px;
          font-size: clamp(28px, 4vw, 44px);
        }

        .travel-detail-hero p,
        .travel-detail-card p {
          margin: 0;
          color: var(--admin-muted);
        }

        .travel-detail-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .span-2 {
          grid-column: span 2;
        }

        .span-3 {
          grid-column: span 3;
        }

        .travel-detail-card h2 {
          margin: 0 0 12px;
          font-size: 18px;
        }

        .travel-detail-card dl,
        .flight-card dl {
          display: grid;
          gap: 9px;
          margin: 0;
        }

        .travel-detail-card div,
        .flight-card dl div {
          display: grid;
          grid-template-columns: 92px minmax(0, 1fr);
          gap: 8px;
        }

        .travel-detail-card dt,
        .flight-card dt {
          color: var(--admin-muted);
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .travel-detail-card dd,
        .flight-card dd {
          margin: 0;
        }

        .flight-list {
          display: grid;
          gap: 10px;
        }

        .flight-card {
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr);
          gap: 10px;
          border: 1px solid var(--admin-border);
          border-radius: 14px;
          padding: 12px;
        }

        .flight-card dl {
          grid-column: 1 / -1;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .flight-card small {
          display: block;
          color: var(--admin-muted);
        }

        .documents-note {
          display: flex;
          gap: 12px;
          align-items: start;
        }

        @media (max-width: 900px) {
          .travel-detail-hero {
            align-items: start;
            flex-direction: column;
          }

          .travel-detail-grid,
          .flight-card dl {
            grid-template-columns: 1fr;
          }

          .span-2,
          .span-3 {
            grid-column: auto;
          }
        }
      `}</style>
    </div>
  );
}
