import Link from "next/link";
import { listClients } from "@/lib/clients";
import type { Client, ClientStatus, ClientType } from "@/types/database";

type AdminClientsPageProps = {
  searchParams?: Promise<{
    city?: string;
    country?: string;
    q?: string;
    status?: string;
    type?: string;
  }>;
};

const clientTypeOptions: Array<{ label: string; value: ClientType | "all" }> = [
  { label: "Todos os tipos", value: "all" },
  { label: "International Agency", value: "international_agency" },
  { label: "Brand", value: "brand" },
  { label: "Production", value: "production" },
  { label: "Photographer", value: "photographer" },
  { label: "Casting Director", value: "casting_director" },
  { label: "Partner", value: "partner" },
  { label: "Other", value: "other" }
];

const statusOptions: Array<{ label: string; value: ClientStatus | "all" }> = [
  { label: "Todos os status", value: "all" },
  { label: "Lead", value: "lead" },
  { label: "Active", value: "active" },
  { label: "Partner", value: "partner" },
  { label: "Inactive", value: "inactive" },
  { label: "Do Not Contact", value: "do_not_contact" }
];

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function uniqueOptions(clients: Client[], key: "city" | "country") {
  return Array.from(
    new Set(
      clients
        .map((client) => client[key])
        .filter((value): value is string => Boolean(value?.trim()))
    )
  ).sort((a, b) => a.localeCompare(b));
}

function getClientTypeLabel(value: ClientType) {
  return (
    clientTypeOptions.find((option) => option.value === value)?.label ?? value
  );
}

function getStatusLabel(value: ClientStatus) {
  return statusOptions.find((option) => option.value === value)?.label ?? value;
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return dateFormatter.format(date);
}

function matchesSearch(client: Client, query: string) {
  if (!query) {
    return true;
  }

  return [
    client.company_name,
    client.general_email,
    client.country,
    client.city
  ].some((value) => normalize(value).includes(query));
}

function getClientValue(value: string | null | undefined) {
  return value?.trim() || "-";
}

export default async function AdminClientsPage({
  searchParams
}: AdminClientsPageProps) {
  const clients = await listClients();
  const filters = (await searchParams) ?? {};
  const query = normalize(filters.q);
  const countryFilter = filters.country ?? "all";
  const cityFilter = filters.city ?? "all";
  const typeFilter = filters.type ?? "all";
  const statusFilter = filters.status ?? "all";

  const countries = uniqueOptions(clients, "country");
  const cities = uniqueOptions(clients, "city");

  const filteredClients = clients.filter((client) => {
    const countryMatches =
      countryFilter === "all" || client.country === countryFilter;
    const cityMatches = cityFilter === "all" || client.city === cityFilter;
    const typeMatches =
      typeFilter === "all" || client.client_type === typeFilter;
    const statusMatches =
      statusFilter === "all" || client.status === statusFilter;

    return (
      countryMatches &&
      cityMatches &&
      typeMatches &&
      statusMatches &&
      matchesSearch(client, query)
    );
  });

  const hasClients = clients.length > 0;

  return (
    <div className="clients-shell">
      <section className="clients-header">
        <div>
          <span className="eyebrow">Admin</span>
          <h2>Clientes</h2>
          <p className="muted">
            CRM de clientes, agências, marcas, produtoras e parceiros
            internacionais da AROLAB.
          </p>
        </div>
        <div className="clients-header-meta">
          <span>{filteredClients.length} na visualização</span>
          <span>{clients.length} no CRM</span>
        </div>
      </section>

      <section className="clients-filter-panel" aria-label="Filtros de clientes">
        <form className="clients-filter-form" method="get">
          <label>
            Busca
            <input
              defaultValue={filters.q ?? ""}
              name="q"
              placeholder="Empresa, e-mail, país ou cidade"
            />
          </label>
          <label>
            País
            <select defaultValue={countryFilter} name="country">
              <option value="all">Todos os países</option>
              {countries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cidade
            <select defaultValue={cityFilter} name="city">
              <option value="all">Todas as cidades</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo
            <select defaultValue={typeFilter} name="type">
              {clientTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select defaultValue={statusFilter} name="status">
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="clients-filter-actions">
            <button className="button" type="submit">
              Aplicar
            </button>
            <Link className="button secondary" href="/admin/clients">
              Limpar
            </Link>
          </div>
        </form>
      </section>

      {hasClients ? (
        <section className="clients-table-panel" aria-label="Lista de clientes">
          <div className="clients-table-scroll">
            <table className="clients-table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>País</th>
                  <th>Cidade</th>
                  <th>Email geral</th>
                  <th>WhatsApp geral</th>
                  <th>WeChat geral</th>
                  <th>Último contato</th>
                  <th>Próximo follow-up</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => (
                  <tr
                    className={
                      client.status === "do_not_contact"
                        ? "client-row caution"
                        : "client-row"
                    }
                    key={client.id}
                  >
                    <td>
                      <strong>{client.company_name}</strong>
                    </td>
                    <td>{getClientTypeLabel(client.client_type)}</td>
                    <td>
                      <span className={`status-pill ${client.status}`}>
                        {getStatusLabel(client.status)}
                      </span>
                    </td>
                    <td>{getClientValue(client.country)}</td>
                    <td>{getClientValue(client.city)}</td>
                    <td>{getClientValue(client.general_email)}</td>
                    <td>{getClientValue(client.general_whatsapp)}</td>
                    <td>{getClientValue(client.general_wechat)}</td>
                    <td>{formatDate(client.last_contact_at)}</td>
                    <td>{formatDate(client.next_follow_up_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="clients-empty-state">
          <span className="eyebrow">CRM</span>
          <h3>Nenhum cliente cadastrado ainda.</h3>
          <p>
            A base do CRM já está pronta. Na próxima etapa, criaremos o cadastro
            de clientes e contatos.
          </p>
        </section>
      )}

      <style>{`
        .clients-shell {
          display: grid;
          gap: 1rem;
        }

        .clients-header,
        .clients-filter-panel,
        .clients-table-panel,
        .clients-empty-state {
          background: color-mix(in srgb, var(--panel) 92%, transparent);
          border: 1px solid var(--line);
          border-radius: 8px;
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.16);
        }

        .clients-header {
          align-items: flex-start;
          display: flex;
          gap: 1rem;
          justify-content: space-between;
          padding: 1rem;
        }

        .clients-header h2 {
          font-size: 1.45rem;
          line-height: 1.2;
          margin: 0;
        }

        .clients-header p {
          font-size: 0.875rem;
          line-height: 1.45;
          margin: 0.35rem 0 0;
          max-width: 44rem;
        }

        .clients-header-meta {
          align-items: flex-end;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }

        .clients-header-meta span,
        .status-pill {
          border: 1px solid var(--line);
          border-radius: 999px;
          font-size: 0.72rem;
          line-height: 1;
          padding: 0.35rem 0.55rem;
          white-space: nowrap;
        }

        .clients-filter-panel,
        .clients-empty-state {
          padding: 1rem;
        }

        .clients-filter-form {
          display: grid;
          gap: 0.75rem;
          grid-template-columns: minmax(14rem, 1.4fr) repeat(4, minmax(9rem, 1fr));
        }

        .clients-filter-form label {
          color: var(--muted-strong);
          font-size: 0.75rem;
          line-height: 1.35;
        }

        .clients-filter-form input,
        .clients-filter-form select {
          margin-top: 0.3rem;
          min-width: 0;
        }

        .clients-filter-actions {
          align-items: end;
          display: flex;
          gap: 0.5rem;
          grid-column: 1 / -1;
          justify-content: flex-end;
        }

        .clients-filter-actions .button {
          font-size: 0.72rem;
          min-height: 2rem;
          padding: 0.35rem 0.65rem;
        }

        .clients-table-panel {
          overflow: hidden;
        }

        .clients-table-scroll {
          overflow-x: auto;
        }

        .clients-table {
          border-collapse: collapse;
          min-width: 76rem;
          width: 100%;
        }

        .clients-table th,
        .clients-table td {
          border-bottom: 1px solid var(--line);
          font-size: 0.78rem;
          line-height: 1.35;
          padding: 0.8rem;
          text-align: left;
          vertical-align: top;
        }

        .clients-table th {
          color: var(--muted-strong);
          font-size: 0.68rem;
          letter-spacing: 0;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .clients-table td {
          color: var(--muted);
          overflow-wrap: anywhere;
        }

        .clients-table td strong {
          color: var(--foreground);
          display: inline-block;
          max-width: 15rem;
        }

        .client-row.caution {
          background: color-mix(in srgb, var(--danger) 12%, transparent);
        }

        .status-pill {
          display: inline-flex;
          color: var(--foreground);
        }

        .status-pill.active,
        .status-pill.partner {
          border-color: color-mix(in srgb, var(--success) 54%, transparent);
          color: var(--success);
        }

        .status-pill.do_not_contact {
          border-color: color-mix(in srgb, var(--danger) 74%, transparent);
          color: var(--danger);
        }

        .clients-empty-state {
          display: grid;
          gap: 0.45rem;
          min-height: 15rem;
          place-content: center;
          text-align: center;
        }

        .clients-empty-state h3,
        .clients-empty-state p {
          margin: 0;
        }

        .clients-empty-state p {
          max-width: 34rem;
        }

        @media (max-width: 1100px) {
          .clients-filter-form {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .clients-header {
            flex-direction: column;
          }

          .clients-header-meta {
            align-items: flex-start;
            flex-direction: row;
            flex-wrap: wrap;
          }

          .clients-filter-form {
            grid-template-columns: 1fr;
          }

          .clients-filter-actions {
            justify-content: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
