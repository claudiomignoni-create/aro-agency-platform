import Link from "next/link";
import {
  AdminAgencyIdentity,
  AdminDataTable,
  AdminEmptyState,
  AdminFilterActions,
  AdminFilterBar,
  AdminModelIdentity,
  AdminPage,
  AdminPageHeader,
  AdminSearchField,
  AdminSection,
  AdminSelectField,
  AdminStatusPill,
  AdminToolbar
} from "@/components/admin/admin-ui";
import { Landmark } from "@/components/admin/admin-icons";
import {
  agencyStatusLabel,
  agencyStatusOptions,
  agencyTypeLabel,
  agencyTypeOptions,
  getAgenciesSchemaStatus,
  listPartnerAgencies
} from "@/lib/agencies";
import {
  internationalSeasonStatusLabel,
  listInternationalSeasons
} from "@/lib/international-seasons";
import { createModelMainImageUrls } from "@/lib/models";

type AgenciesPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    type?: string;
  }>;
};

function statusTone(status: string) {
  if (status === "active") return "success";
  if (status === "suspended" || status === "archived") return "danger";
  if (status === "prospect") return "warning";
  return "neutral";
}

export default async function AgenciesPage({ searchParams }: AgenciesPageProps) {
  const filters = (await searchParams) ?? {};
  const schema = await getAgenciesSchemaStatus();
  const [agencies, seasons] = schema.ready
    ? await Promise.all([listPartnerAgencies(filters), listInternationalSeasons({ activeOnly: true })])
    : [[], []];
  const seasonsByAgency = new Map<string, typeof seasons>();

  for (const season of seasons) {
    const agencyId = season.receiving_agency?.id;
    if (!agencyId) continue;
    seasonsByAgency.set(agencyId, [...(seasonsByAgency.get(agencyId) ?? []), season]);
  }

  const modelImageUrls = await createModelMainImageUrls(
    seasons
      .map((season) => season.model)
      .filter((model): model is NonNullable<typeof model> => Boolean(model))
  );

  return (
    <AdminPage>
      <AdminPageHeader
        actions={<Link className="button" href="/admin/agencies/new">Nova agência</Link>}
        description="CRM internacional de placements, receiving agencies, mother agencies e temporadas."
        eyebrow="Agencies"
        title="Agencies"
      />

      {!schema.ready ? (
        <AdminSection className="agencies-notice">
          <Landmark aria-hidden="true" />
          <div>
            <strong>Agencies ainda não ativado no banco.</strong>
            <p>Aplique as migrations 019 a 022 no ambiente correto para liberar este módulo.</p>
          </div>
        </AdminSection>
      ) : null}

      <AdminToolbar>
        <AdminFilterBar>
          <AdminSearchField
            defaultValue={filters.q}
            placeholder="Buscar agência, país, cidade, e-mail..."
          />
          <AdminSelectField
            defaultValue={filters.type}
            label="Tipo"
            name="type"
            options={[{ label: "Todos", value: "" }, ...agencyTypeOptions]}
          />
          <AdminSelectField
            defaultValue={filters.status}
            label="Status"
            name="status"
            options={[{ label: "Todos", value: "" }, ...agencyStatusOptions]}
          />
          <AdminFilterActions resetHref="/admin/agencies" />
        </AdminFilterBar>
      </AdminToolbar>

      {schema.ready && agencies.length > 0 ? (
        <AdminSection title="Agências parceiras" meta={`${agencies.length} resultado(s)`}>
          <AdminDataTable className="agencies-table">
            <thead>
              <tr>
                <th>Agência</th>
                <th>Local</th>
                <th>Contato</th>
                <th>Temporadas ativas</th>
                <th>Modelos</th>
                <th>Status</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {agencies.map((agency) => {
                const agencySeasons = seasonsByAgency.get(agency.id) ?? [];

                return (
                  <tr key={agency.id}>
                    <td data-label="Agência">
                      <AdminAgencyIdentity
                        href={`/admin/agencies/${agency.id}`}
                        name={agency.display_name}
                        secondary={agencyTypeLabel(agency.agency_type)}
                      />
                    </td>
                    <td data-label="Local">{[agency.city, agency.country].filter(Boolean).join(", ") || "—"}</td>
                    <td data-label="Contato">
                      <strong>{agency.contact_name || "—"}</strong>
                      <small>{agency.primary_email || agency.whatsapp || "Sem contato principal"}</small>
                    </td>
                    <td data-label="Temporadas">
                      <AdminStatusPill tone={agencySeasons.length ? "success" : "neutral"}>
                        {agencySeasons.length} ativa(s)
                      </AdminStatusPill>
                    </td>
                    <td data-label="Modelos">
                      <div className="agency-model-list">
                        {agencySeasons.slice(0, 2).map((season) => (
                          <AdminModelIdentity
                            href={season.trip_id ? `/admin/travel/${season.trip_id}` : `/admin/models/${season.model?.id}/edit`}
                            imageUrl={season.model?.id ? modelImageUrls[season.model.id] : undefined}
                            key={season.id}
                            name={season.model?.stage_name || season.model?.display_name}
                            secondary={internationalSeasonStatusLabel(season.status)}
                          />
                        ))}
                        {agencySeasons.length > 2 ? <span className="admin-chip">+{agencySeasons.length - 2}</span> : null}
                        {agencySeasons.length === 0 ? <span className="muted">Sem temporada ativa</span> : null}
                      </div>
                    </td>
                    <td data-label="Status">
                      <AdminStatusPill tone={statusTone(agency.status)}>
                        {agencyStatusLabel(agency.status)}
                      </AdminStatusPill>
                    </td>
                    <td data-label="Ação">
                      <Link className="button secondary" href={`/admin/agencies/${agency.id}`}>
                        Abrir
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </AdminDataTable>
        </AdminSection>
      ) : null}

      {schema.ready && agencies.length === 0 ? (
        <AdminEmptyState
          action={<Link className="button" href="/admin/agencies/new">Cadastrar agência</Link>}
          description="Use Agencies para representação internacional. Registros legados em Clients continuam preservados."
          title="Nenhuma agência encontrada."
        />
      ) : null}

      <style>{`
        .agencies-notice {
          display: flex;
          align-items: center;
          gap: 12px;
          border-color: rgba(255, 209, 102, 0.32);
        }

        .agencies-notice p {
          margin: 0;
        }

        .agency-model-list {
          display: grid;
          gap: 8px;
        }

        @media (max-width: 1240px) {
          .agencies-table th:nth-child(3),
          .agencies-table td:nth-child(3) {
            display: none;
          }
        }

        @media (max-width: 760px) {
          .agencies-table td:nth-child(3) {
            display: grid;
          }
        }
      `}</style>
    </AdminPage>
  );
}
