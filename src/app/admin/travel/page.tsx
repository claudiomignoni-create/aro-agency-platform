import Link from "next/link";
import {
  AdminDataTable,
  AdminDateField,
  AdminEmptyState,
  AdminFilterActions,
  AdminFilterBar,
  AdminModelIdentity,
  AdminMoreFilters,
  AdminPage,
  AdminPageHeader,
  AdminSearchField,
  AdminSection,
  AdminSelectField,
  AdminStat,
  AdminStatusPill,
  AdminTabs,
  AdminTextField,
  AdminToolbar
} from "@/components/admin/admin-ui";
import { Plane } from "@/components/admin/admin-icons";
import {
  internationalSeasonStatusLabel,
  listInternationalSeasons
} from "@/lib/international-seasons";
import { createModelMainImageUrls, listModels } from "@/lib/models";
import {
  flightStatusLabel,
  getTravelSchemaStatus,
  listTravelTrips,
  tripStatusLabel,
  tripStatusOptions
} from "@/lib/travel";

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
    tab?: string;
  }>;
};

const tabs = [
  { id: "seasons", label: "Temporadas" },
  { id: "flights", label: "Viagens e voos" },
  { id: "documents", label: "Documentos pendentes" },
  { id: "alerts", label: "Alertas" },
  { id: "history", label: "Histórico" }
] as const;

function activeTab(value: string | undefined) {
  return tabs.some((tab) => tab.id === value) ? value : "seasons";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function daysRemaining(value: string | null) {
  if (!value) return "—";
  const today = new Date();
  const end = new Date(`${value}T12:00:00.000Z`);
  const days = Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "Encerrada";
  if (days === 0) return "Termina hoje";
  return `${days} dias`;
}

function statusTone(value: string) {
  if (["active", "booked", "traveling", "hosted", "arrived"].includes(value)) return "success";
  if (["canceled"].includes(value)) return "danger";
  if (["ending_soon", "visa_pending", "preparing", "in_transit"].includes(value)) return "warning";
  return "neutral";
}

function documentIssues(season: Awaited<ReturnType<typeof listInternationalSeasons>>[number]) {
  return [
    season.contract_document_status !== "complete" ? "Contrato" : null,
    season.visa_status !== "approved" ? "Visto" : null,
    season.return_ticket_status !== "issued" ? "Retorno" : null
  ].filter(Boolean);
}

export default async function AdminTravelPage({ searchParams }: AdminTravelPageProps) {
  const filters = (await searchParams) ?? {};
  const selectedTab = activeTab(filters.tab);
  const [schema, models, seasons] = await Promise.all([
    getTravelSchemaStatus(),
    listModels(),
    listInternationalSeasons({ activeOnly: selectedTab !== "history" })
  ]);
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
  const imageSources = [
    ...seasons.map((season) => season.model),
    ...trips.map((trip) => trip.model)
  ].filter((model): model is NonNullable<typeof model> => Boolean(model));
  const modelImageUrls = await createModelMainImageUrls(imageSources);
  const activeSeasons = seasons.filter((season) =>
    ["booked", "traveling", "active", "ending_soon"].includes(season.status)
  );
  const pendingDocuments = seasons.filter((season) => documentIssues(season).length > 0);
  const alerts = seasons.flatMap((season) => season.alerts ?? []).filter((alert) => alert.status !== "dismissed");
  const upcomingFlights = trips.filter((trip) =>
    (trip.flight_segments ?? []).some((segment) =>
      ["planned", "booked", "check_in_open", "boarding"].includes(segment.status)
    )
  );

  return (
    <AdminPage className="travel-workspace">
      <AdminPageHeader
        actions={
          <>
            <Link className="button secondary" href="/admin/travel/new?reason=international_season">Nova temporada</Link>
            <Link className="button" href="/admin/travel/new">Nova viagem</Link>
          </>
        }
        description="Operações internacionais, temporadas, voos, documentos e alertas de modelos em movimento."
        eyebrow="Travel"
        title="Travel"
      />

      {!schema.ready ? (
        <AdminSection className="travel-notice">
          <Plane aria-hidden="true" />
          <div>
            <strong>Travel ainda não ativado no banco.</strong>
            <p>Aplique as migrations 016, 017 e 018 no ambiente correto para liberar viagens e voos.</p>
          </div>
        </AdminSection>
      ) : null}

      <section className="admin-stat-grid">
        <AdminStat label="Temporadas ativas" value={activeSeasons.length} />
        <AdminStat label="Modelos no exterior" value={new Set(activeSeasons.map((season) => season.model_id)).size} />
        <AdminStat label="Próximos voos" value={upcomingFlights.length} />
        <AdminStat label="Documentos pendentes" value={pendingDocuments.length} />
      </section>

      <AdminTabs
        items={tabs.map((tab) => ({
          active: selectedTab === tab.id,
          href: `/admin/travel?tab=${tab.id}`,
          label: tab.label
        }))}
      />

      <AdminToolbar>
        <AdminFilterBar>
          <AdminSearchField defaultValue={filters.q} placeholder="Buscar viagem, modelo, cidade, voo..." />
          <AdminSelectField
            defaultValue={filters.model}
            label="Modelo"
            name="model"
            options={[
              { label: "Todos", value: "" },
              ...models.map((model) => ({ label: model.stage_name || model.display_name, value: model.id }))
            ]}
          />
          <AdminSelectField
            defaultValue={filters.status}
            label="Status"
            name="status"
            options={[{ label: "Todos", value: "" }, ...tripStatusOptions]}
          />
          <input name="tab" type="hidden" value={selectedTab} />
          <AdminFilterActions resetHref={`/admin/travel?tab=${selectedTab}`} />
          <AdminMoreFilters count={[filters.origin, filters.destination, filters.airline, filters.dateFrom, filters.dateTo].filter(Boolean).length}>
            <AdminTextField defaultValue={filters.origin} label="Origem" name="origin" />
            <AdminTextField defaultValue={filters.destination} label="Destino" name="destination" />
            <AdminTextField defaultValue={filters.airline} label="Companhia/voo" name="airline" />
            <AdminDateField defaultValue={filters.dateFrom} label="De" name="dateFrom" />
            <AdminDateField defaultValue={filters.dateTo} label="Até" name="dateTo" />
          </AdminMoreFilters>
        </AdminFilterBar>
      </AdminToolbar>

      {selectedTab === "seasons" ? (
        <AdminSection title="Temporadas internacionais" meta={`${activeSeasons.length} ativa(s)`}>
          <div className="travel-season-list">
            {activeSeasons.map((season) => {
              const issues = documentIssues(season);
              return (
                <article className="travel-season-card" key={season.id}>
                  <AdminModelIdentity
                    href={season.trip_id ? `/admin/travel/${season.trip_id}` : `/admin/models/${season.model_id}/edit?tab=representation`}
                    imageUrl={season.model?.id ? modelImageUrls[season.model.id] : undefined}
                    name={season.model?.stage_name || season.model?.display_name}
                    secondary={[season.city, season.country].filter(Boolean).join(", ")}
                  />
                  <div>
                    <span className="eyebrow">Agência receptora</span>
                    <strong>{season.receiving_agency?.display_name || "—"}</strong>
                  </div>
                  <div>
                    <span className="eyebrow">Contrato</span>
                    <strong>{formatDate(season.contract_start_date)} → {formatDate(season.contract_end_date)}</strong>
                    <small>{daysRemaining(season.contract_end_date)}</small>
                  </div>
                  <div className="travel-season-statuses">
                    <AdminStatusPill tone={statusTone(season.status)}>{internationalSeasonStatusLabel(season.status)}</AdminStatusPill>
                    <AdminStatusPill tone={issues.length ? "warning" : "success"}>
                      {issues.length ? `${issues.length} doc(s)` : "Documentos ok"}
                    </AdminStatusPill>
                    <AdminStatusPill tone={season.return_ticket_status === "issued" ? "success" : "warning"}>
                      Retorno {season.return_ticket_status === "issued" ? "emitido" : "pendente"}
                    </AdminStatusPill>
                  </div>
                  <div className="travel-season-actions">
                    <Link className="button secondary" href={season.trip_id ? `/admin/travel/${season.trip_id}` : `/admin/models/${season.model_id}/edit?tab=representation`}>Abrir</Link>
                    {season.trip_id ? <Link className="button secondary" href={`/admin/travel/${season.trip_id}/documents`}>Documentos</Link> : null}
                  </div>
                </article>
              );
            })}
          </div>
          {activeSeasons.length === 0 ? <p className="muted">Nenhuma temporada ativa encontrada.</p> : null}
        </AdminSection>
      ) : null}

      {selectedTab === "flights" ? (
        <AdminSection title="Viagens e voos" meta={`${trips.length} viagem(ns)`}>
          <AdminDataTable className="travel-flights-table">
            <thead>
              <tr>
                <th>Modelo</th>
                <th>Rota</th>
                <th>Voo</th>
                <th>Partida</th>
                <th>Chegada</th>
                <th>Status</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip) => {
                const segment = trip.flight_segments?.[0];
                return (
                  <tr key={trip.id}>
                    <td data-label="Modelo">
                      <AdminModelIdentity
                        href={`/admin/travel/${trip.id}`}
                        imageUrl={trip.model?.id ? modelImageUrls[trip.model.id] : undefined}
                        name={trip.model?.stage_name || trip.model?.display_name}
                        secondary={trip.title}
                      />
                    </td>
                    <td data-label="Rota">{[trip.origin_city, trip.destination_city].filter(Boolean).join(" → ") || "—"}</td>
                    <td data-label="Voo">{segment ? [segment.airline_code, segment.flight_number].filter(Boolean).join(" ") || segment.airline_name || "Trecho cadastrado" : "Sem trecho"}</td>
                    <td data-label="Partida">{segment?.departure_at ? new Date(segment.departure_at).toLocaleString("pt-BR") : formatDate(trip.starts_on)}</td>
                    <td data-label="Chegada">{segment?.arrival_at ? new Date(segment.arrival_at).toLocaleString("pt-BR") : formatDate(trip.ends_on)}</td>
                    <td data-label="Status">
                      <AdminStatusPill tone={statusTone(segment?.status ?? trip.status)}>
                        {segment ? flightStatusLabel(segment.status) : tripStatusLabel(trip.status)}
                      </AdminStatusPill>
                    </td>
                    <td data-label="Ação">
                      <Link className="button secondary" href={`/admin/travel/${trip.id}`}>Abrir</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </AdminDataTable>
          {trips.length === 0 ? <p className="muted">Nenhuma viagem encontrada.</p> : null}
        </AdminSection>
      ) : null}

      {selectedTab === "documents" ? (
        <AdminSection title="Documentos pendentes" meta={`${pendingDocuments.length} temporada(s)`}>
          <div className="travel-alert-list">
            {pendingDocuments.map((season) => (
              <Link className="travel-alert-row" href={season.trip_id ? `/admin/travel/${season.trip_id}/documents` : `/admin/models/${season.model_id}/edit?tab=documents`} key={season.id}>
                  <AdminModelIdentity
                  imageUrl={season.model?.id ? modelImageUrls[season.model.id] : undefined}
                  name={season.model?.stage_name || season.model?.display_name}
                  secondary={[season.city, season.country].filter(Boolean).join(", ")}
                />
                <span>{documentIssues(season).join(", ")}</span>
              </Link>
            ))}
          </div>
          {pendingDocuments.length === 0 ? <p className="muted">Nenhum documento pendente nas temporadas visíveis.</p> : null}
        </AdminSection>
      ) : null}

      {selectedTab === "alerts" ? (
        <AdminSection title="Alertas operacionais" meta={`${alerts.length} alerta(s)`}>
          <div className="travel-alert-list">
            {alerts.map((alert) => (
              <Link className="travel-alert-row" href={alert.link_path || "/admin/travel"} key={alert.id}>
                <AdminStatusPill tone={alert.priority === "high" ? "danger" : alert.priority === "medium" ? "warning" : "neutral"}>
                  {alert.priority}
                </AdminStatusPill>
                <strong>{alert.title}</strong>
                <span>{alert.description || formatDate(alert.due_on)}</span>
              </Link>
            ))}
          </div>
          {alerts.length === 0 ? <p className="muted">Nenhum alerta real ativo.</p> : null}
        </AdminSection>
      ) : null}

      {selectedTab === "history" ? (
        <AdminEmptyState
          description="O histórico usa os registros concluídos, cancelados ou fechados. Use filtros de data para auditar períodos específicos."
          title="Histórico preparado"
        />
      ) : null}

      <style>{`
        .travel-notice {
          display: flex;
          align-items: center;
          gap: 12px;
          border-color: rgba(255, 209, 102, 0.32);
        }

        .travel-notice p {
          margin: 0;
        }

        .travel-season-list {
          display: grid;
          gap: 10px;
        }

        .travel-season-card {
          display: grid;
          grid-template-columns: minmax(230px, 1.4fr) minmax(140px, 0.8fr) minmax(190px, 1fr) minmax(230px, 1.1fr) auto;
          gap: 12px;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.09);
          padding: 12px 0;
        }

        .travel-season-card small,
        .travel-alert-row span {
          color: var(--admin-muted);
        }

        .travel-season-statuses,
        .travel-season-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .travel-alert-list {
          display: grid;
          gap: 8px;
        }

        .travel-alert-row {
          display: grid;
          grid-template-columns: minmax(220px, 0.8fr) minmax(0, 1fr);
          gap: 12px;
          align-items: center;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 10px;
        }

        @media (max-width: 1180px) {
          .travel-season-card {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .travel-season-card,
          .travel-alert-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </AdminPage>
  );
}
