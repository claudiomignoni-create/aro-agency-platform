import Link from "next/link";
import { Landmark, Search } from "@/components/admin/admin-icons";
import {
  agencyStatusLabel,
  agencyStatusOptions,
  agencyTypeLabel,
  agencyTypeOptions,
  getAgenciesSchemaStatus,
  listPartnerAgencies
} from "@/lib/agencies";

type AgenciesPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    type?: string;
  }>;
};

export default async function AgenciesPage({ searchParams }: AgenciesPageProps) {
  const filters = (await searchParams) ?? {};
  const schema = await getAgenciesSchemaStatus();
  const agencies = schema.ready ? await listPartnerAgencies(filters) : [];

  return (
    <div className="agencies-page">
      <section className="aro-glass-card agencies-hero">
        <div>
          <span className="eyebrow">Agencies</span>
          <h1>Agencies</h1>
          <p>Agencias parceiras, placements, receiving agencies e temporadas internacionais.</p>
        </div>
        <Link className="button" href="/admin/agencies/new">
          Nova agencia
        </Link>
      </section>

      {!schema.ready ? (
        <section className="aro-glass-card agencies-notice">
          <Landmark aria-hidden="true" />
          <div>
            <strong>Agencies ainda nao ativado no banco.</strong>
            <p>Aplique as migrations 019 a 022 no ambiente correto para liberar este modulo.</p>
          </div>
        </section>
      ) : null}

      <section className="aro-glass-card agencies-filters">
        <form method="get">
          <label className="agencies-search">
            <Search aria-hidden="true" />
            <input defaultValue={filters.q ?? ""} name="q" placeholder="Buscar agencia, pais, cidade, e-mail..." />
          </label>
          <label>
            Tipo
            <select defaultValue={filters.type ?? ""} name="type">
              <option value="">Todos</option>
              {agencyTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select defaultValue={filters.status ?? ""} name="status">
              <option value="">Todos</option>
              {agencyStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button className="button" type="submit">
              Aplicar
            </button>
            <Link className="button secondary" href="/admin/agencies">
              Limpar
            </Link>
          </div>
        </form>
      </section>

      <section className="agencies-grid">
        {agencies.map((agency) => (
          <Link className="aro-glass-card agency-card" href={`/admin/agencies/${agency.id}`} key={agency.id}>
            <header>
              <strong>{agency.display_name}</strong>
              <span>{agencyStatusLabel(agency.status)}</span>
            </header>
            <p>{agency.legal_name || agencyTypeLabel(agency.agency_type)}</p>
            <dl>
              <div><dt>Tipo</dt><dd>{agencyTypeLabel(agency.agency_type)}</dd></div>
              <div><dt>Local</dt><dd>{[agency.city, agency.country].filter(Boolean).join(", ") || "—"}</dd></div>
              <div><dt>E-mail</dt><dd>{agency.primary_email || "—"}</dd></div>
              <div><dt>Prazo</dt><dd>{agency.default_payment_terms_days === null ? "—" : `${agency.default_payment_terms_days} dias`}</dd></div>
            </dl>
          </Link>
        ))}
      </section>

      {schema.ready && agencies.length === 0 ? (
        <section className="aro-glass-card agencies-empty">Nenhuma agencia encontrada.</section>
      ) : null}

      <style>{`
        .agencies-page {
          display: grid;
          gap: 14px;
        }

        .agencies-hero,
        .agencies-notice,
        .agencies-filters,
        .agencies-empty {
          padding: 18px;
        }

        .agencies-hero {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 16px;
        }

        .agencies-hero h1 {
          margin: 0 0 8px;
          font-size: clamp(28px, 4vw, 44px);
        }

        .agencies-hero p,
        .agencies-notice p,
        .agency-card p {
          margin: 0;
          color: var(--admin-muted);
        }

        .agencies-notice {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .agencies-filters form {
          display: grid;
          grid-template-columns: minmax(240px, 1fr) minmax(150px, 220px) minmax(140px, 180px) auto;
          gap: 10px;
          align-items: end;
        }

        .agencies-filters label {
          display: grid;
          gap: 7px;
          color: var(--admin-muted);
          font-size: 12px;
          font-weight: 800;
        }

        .agencies-filters input,
        .agencies-filters select {
          min-height: 42px;
          border: 1px solid var(--admin-border);
          border-radius: 10px;
          background: rgba(2, 18, 50, 0.34);
          color: var(--admin-text);
          padding: 0 11px;
        }

        .agencies-search {
          position: relative;
        }

        .agencies-search svg {
          position: absolute;
          bottom: 11px;
          left: 11px;
          width: 18px;
          color: var(--admin-muted);
        }

        .agencies-search input {
          padding-left: 36px;
        }

        .agencies-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .agency-card {
          display: grid;
          gap: 12px;
          padding: 16px;
        }

        .agency-card header {
          display: flex;
          align-items: start;
          justify-content: space-between;
          gap: 10px;
        }

        .agency-card header span {
          border: 1px solid var(--admin-border);
          border-radius: 999px;
          color: var(--admin-muted);
          font-size: 11px;
          padding: 5px 8px;
          white-space: nowrap;
        }

        .agency-card dl {
          display: grid;
          gap: 8px;
          margin: 0;
        }

        .agency-card div {
          display: grid;
          grid-template-columns: 72px minmax(0, 1fr);
          gap: 8px;
        }

        .agency-card dt {
          color: var(--admin-muted);
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .agency-card dd {
          margin: 0;
          min-width: 0;
          overflow-wrap: anywhere;
        }

        @media (max-width: 1100px) {
          .agencies-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .agencies-hero,
          .agencies-filters form {
            align-items: stretch;
            grid-template-columns: 1fr;
          }

          .agencies-hero {
            flex-direction: column;
          }

          .agencies-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
