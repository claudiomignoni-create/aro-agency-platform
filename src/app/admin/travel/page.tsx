import Link from "next/link";
import { Plane, Search } from "@/components/admin/admin-icons";
import {
  getTravelSchemaStatus,
  listTravelTrips,
  tripStatusLabel,
  tripStatusOptions
} from "@/lib/travel";
import { listModels } from "@/lib/models";

type AdminTravelPageProps = {
  searchParams?: Promise<{
    airline?: string;
    dateFrom?: string;
    dateTo?: string;
    destination?: string;
    model?: string;
    origin?: string;
    q?: string;
    status?: string;
  }>;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00.000Z`));
}

export default async function AdminTravelPage({ searchParams }: AdminTravelPageProps) {
  const filters = (await searchParams) ?? {};
  const [schema, models] = await Promise.all([getTravelSchemaStatus(), listModels()]);
  const trips = schema.ready
    ? await listTravelTrips({
        airline: filters.airline,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        destination: filters.destination,
        modelId: filters.model,
        origin: filters.origin,
        q: filters.q,
        status: filters.status
      })
    : [];

  return (
    <div className="travel-page">
      <section className="aro-glass-card travel-hero">
        <div>
          <span className="eyebrow">Travel</span>
          <h1>Travel</h1>
          <p>Viagens, temporadas internacionais, voos, PNRs, tickets e alertas operacionais.</p>
        </div>
        <Link className="button" href="/admin/travel/new">
          Nova viagem
        </Link>
      </section>

      {!schema.ready ? (
        <section className="aro-glass-card travel-notice">
          <Plane aria-hidden="true" />
          <div>
            <strong>Travel ainda não ativado no banco.</strong>
            <p>Aplique as migrations 016, 017 e 018 no ambiente correto para liberar viagens e voos.</p>
          </div>
        </section>
      ) : null}

      <section className="aro-glass-card travel-filters">
        <form method="get">
          <label className="travel-search">
            <Search aria-hidden="true" />
            <input defaultValue={filters.q ?? ""} name="q" placeholder="Buscar viagem, modelo, cidade, voo..." />
          </label>
          <label>
            Modelo
            <select defaultValue={filters.model ?? ""} name="model">
              <option value="">Todos</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.stage_name || model.display_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select defaultValue={filters.status ?? ""} name="status">
              <option value="">Todos</option>
              {tripStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Origem
            <input defaultValue={filters.origin ?? ""} name="origin" />
          </label>
          <label>
            Destino
            <input defaultValue={filters.destination ?? ""} name="destination" />
          </label>
          <label>
            Companhia/voo
            <input defaultValue={filters.airline ?? ""} name="airline" />
          </label>
          <label>
            De
            <input defaultValue={filters.dateFrom ?? ""} name="dateFrom" type="date" />
          </label>
          <label>
            Até
            <input defaultValue={filters.dateTo ?? ""} name="dateTo" type="date" />
          </label>
          <div className="travel-actions">
            <button className="button" type="submit">
              Aplicar
            </button>
            <Link className="button secondary" href="/admin/travel">
              Limpar
            </Link>
          </div>
        </form>
      </section>

      <section className="travel-grid">
        {trips.map((trip) => {
          const segment = trip.flight_segments?.[0];
          return (
            <Link className="aro-glass-card travel-card" href={`/admin/travel/${trip.id}`} key={trip.id}>
              <header>
                <strong>{trip.title}</strong>
                <span>{tripStatusLabel(trip.status)}</span>
              </header>
              <p>{trip.model?.stage_name || trip.model?.display_name || "Modelo"}</p>
              <dl>
                <div>
                  <dt>Origem</dt>
                  <dd>{[trip.origin_city, trip.origin_country].filter(Boolean).join(", ") || "—"}</dd>
                </div>
                <div>
                  <dt>Destino</dt>
                  <dd>{[trip.destination_city, trip.destination_country].filter(Boolean).join(", ") || "—"}</dd>
                </div>
                <div>
                  <dt>Período</dt>
                  <dd>{formatDate(trip.starts_on)} → {formatDate(trip.ends_on)}</dd>
                </div>
                <div>
                  <dt>Voo</dt>
                  <dd>{segment ? [segment.airline_code, segment.flight_number].filter(Boolean).join(" ") || segment.airline_name || "Trecho cadastrado" : "Sem trecho"}</dd>
                </div>
              </dl>
            </Link>
          );
        })}
      </section>
      {schema.ready && trips.length === 0 ? (
        <section className="aro-glass-card travel-empty">Nenhuma viagem encontrada.</section>
      ) : null}

      <style>{`
        .travel-page {
          display: grid;
          gap: 14px;
        }

        .travel-hero,
        .travel-notice,
        .travel-filters,
        .travel-empty {
          padding: 18px;
        }

        .travel-hero {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 16px;
        }

        .travel-hero h1 {
          margin: 0 0 8px;
          font-size: clamp(28px, 4vw, 44px);
        }

        .travel-hero p,
        .travel-notice p {
          margin: 0;
          color: var(--admin-muted);
        }

        .travel-notice {
          display: flex;
          align-items: center;
          gap: 12px;
          border-color: rgba(255, 209, 102, 0.32);
        }

        .travel-filters form {
          display: grid;
          grid-template-columns: minmax(250px, 1.6fr) repeat(7, minmax(120px, 1fr)) auto;
          gap: 10px;
          align-items: end;
        }

        .travel-filters label {
          display: grid;
          gap: 7px;
          color: var(--admin-muted);
          font-size: 12px;
          font-weight: 800;
        }

        .travel-filters input,
        .travel-filters select {
          min-height: 42px;
          border: 1px solid var(--admin-border);
          border-radius: 10px;
          background: rgba(2, 18, 50, 0.34);
          color: var(--admin-text);
          padding: 0 11px;
        }

        .travel-search {
          position: relative;
        }

        .travel-search svg {
          position: absolute;
          bottom: 11px;
          left: 11px;
          width: 18px;
          height: 18px;
          color: var(--admin-muted);
        }

        .travel-search input {
          padding-left: 36px;
        }

        .travel-actions {
          display: flex;
          gap: 8px;
        }

        .travel-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .travel-card {
          display: grid;
          gap: 12px;
          padding: 16px;
        }

        .travel-card header {
          display: flex;
          align-items: start;
          justify-content: space-between;
          gap: 10px;
        }

        .travel-card header strong {
          font-size: 16px;
        }

        .travel-card header span {
          border: 1px solid var(--admin-border);
          border-radius: 999px;
          color: var(--admin-muted);
          font-size: 11px;
          padding: 5px 8px;
          white-space: nowrap;
        }

        .travel-card p {
          margin: 0;
          color: var(--admin-muted);
        }

        .travel-card dl {
          display: grid;
          gap: 9px;
          margin: 0;
        }

        .travel-card div {
          display: grid;
          grid-template-columns: 82px minmax(0, 1fr);
          gap: 8px;
        }

        .travel-card dt {
          color: var(--admin-muted);
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .travel-card dd {
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        @media (max-width: 1320px) {
          .travel-filters form,
          .travel-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .travel-search {
            grid-column: span 2;
          }
        }

        @media (max-width: 760px) {
          .travel-hero {
            align-items: start;
            flex-direction: column;
          }

          .travel-filters form,
          .travel-grid {
            grid-template-columns: 1fr;
          }

          .travel-search {
            grid-column: auto;
          }
        }
      `}</style>
    </div>
  );
}
