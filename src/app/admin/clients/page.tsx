import Link from "next/link";
import {
  AdminClientIdentity,
  AdminDataTable,
  AdminEmptyState,
  AdminFilterActions,
  AdminFilterBar,
  AdminMoreFilters,
  AdminPage,
  AdminPageHeader,
  AdminSearchField,
  AdminSection,
  AdminSelectField,
  AdminStatusPill,
  AdminToolbar
} from "@/components/admin/admin-ui";
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
  { label: "Brand", value: "brand" },
  { label: "Production", value: "production" },
  { label: "Photographer", value: "photographer" },
  { label: "Casting Director", value: "casting_director" },
  { label: "Partner", value: "partner" },
  { label: "Other", value: "other" },
  { label: "Agência internacional legado", value: "international_agency" }
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
  return clientTypeOptions.find((option) => option.value === value)?.label ?? value;
}

function getStatusLabel(value: ClientStatus) {
  return statusOptions.find((option) => option.value === value)?.label ?? value;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

function matchesSearch(client: Client, query: string) {
  if (!query) return true;

  return [
    client.company_name,
    client.general_email,
    client.country,
    client.city,
    client.contact_name
  ].some((value) => normalize(value).includes(query));
}

function getClientValue(value: string | null | undefined) {
  return value?.trim() || "—";
}

function statusTone(status: ClientStatus) {
  if (status === "active" || status === "partner") return "success";
  if (status === "do_not_contact") return "danger";
  if (status === "lead") return "warning";
  return "neutral";
}

export default async function AdminClientsPage({ searchParams }: AdminClientsPageProps) {
  const clients = await listClients();
  const filters = (await searchParams) ?? {};
  const query = normalize(filters.q);
  const countryFilter = filters.country ?? "all";
  const cityFilter = filters.city ?? "all";
  const typeFilter = filters.type ?? "all";
  const statusFilter = filters.status ?? "all";
  const countries = uniqueOptions(clients, "country");
  const cities = uniqueOptions(clients, "city");
  const secondaryFilters = [countryFilter !== "all", cityFilter !== "all"].filter(Boolean).length;

  const filteredClients = clients.filter((client) => {
    const countryMatches = countryFilter === "all" || client.country === countryFilter;
    const cityMatches = cityFilter === "all" || client.city === cityFilter;
    const typeMatches = typeFilter === "all" || client.client_type === typeFilter;
    const statusMatches = statusFilter === "all" || client.status === statusFilter;

    return countryMatches && cityMatches && typeMatches && statusMatches && matchesSearch(client, query);
  });

  return (
    <AdminPage>
      <AdminPageHeader
        actions={<Link className="button" href="/admin/clients/new">Novo cliente</Link>}
        description="CRM de clientes, marcas, produtoras, casting directors e parceiros comerciais da ARO."
        eyebrow="Admin"
        title="Clientes"
      >
        <div className="clients-summary">
          <AdminStatusPill>{filteredClients.length} na visualização</AdminStatusPill>
          <AdminStatusPill>{clients.length} no CRM</AdminStatusPill>
        </div>
      </AdminPageHeader>

      <AdminToolbar>
        <AdminFilterBar>
          <AdminSearchField
            defaultValue={filters.q}
            placeholder="Empresa, contato, e-mail, país ou cidade"
          />
          <AdminSelectField
            defaultValue={typeFilter}
            label="Tipo"
            name="type"
            options={clientTypeOptions.map((option) => ({ label: option.label, value: option.value }))}
          />
          <AdminSelectField
            defaultValue={statusFilter}
            label="Status"
            name="status"
            options={statusOptions.map((option) => ({ label: option.label, value: option.value }))}
          />
          <AdminFilterActions resetHref="/admin/clients" />
          <AdminMoreFilters count={secondaryFilters}>
            <AdminSelectField
              defaultValue={countryFilter}
              label="País"
              name="country"
              options={[
                { label: "Todos os países", value: "all" },
                ...countries.map((country) => ({ label: country, value: country }))
              ]}
            />
            <AdminSelectField
              defaultValue={cityFilter}
              label="Cidade"
              name="city"
              options={[
                { label: "Todas as cidades", value: "all" },
                ...cities.map((city) => ({ label: city, value: city }))
              ]}
            />
          </AdminMoreFilters>
        </AdminFilterBar>
      </AdminToolbar>

      {clients.length > 0 ? (
        <AdminSection title="Base CRM" meta={`${filteredClients.length} resultado(s)`}>
          <AdminDataTable className="clients-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Local</th>
                <th>Contato</th>
                <th>Último contato</th>
                <th>Próximo follow-up</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => (
                <tr key={client.id}>
                  <td data-label="Empresa">
                    <AdminClientIdentity
                      href={`/admin/clients/${client.id}`}
                      name={client.company_name}
                      secondary={getClientTypeLabel(client.client_type)}
                    />
                  </td>
                  <td data-label="Tipo">{getClientTypeLabel(client.client_type)}</td>
                  <td data-label="Status">
                    <AdminStatusPill tone={statusTone(client.status)}>
                      {getStatusLabel(client.status)}
                    </AdminStatusPill>
                  </td>
                  <td data-label="Local">{[client.city, client.country].filter(Boolean).join(", ") || "—"}</td>
                  <td data-label="Contato">
                    <strong>{getClientValue(client.contact_name)}</strong>
                    <small>{getClientValue(client.general_email)}</small>
                  </td>
                  <td data-label="Último contato">{formatDate(client.last_contact_at)}</td>
                  <td data-label="Próximo follow-up">{formatDate(client.next_follow_up_at)}</td>
                  <td data-label="Ação">
                    <Link className="button secondary" href={`/admin/clients/${client.id}`}>
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminDataTable>
          {filteredClients.length === 0 ? <p className="muted">Nenhum cliente encontrado.</p> : null}
        </AdminSection>
      ) : (
        <AdminEmptyState
          action={<Link className="button" href="/admin/clients/new">Cadastrar cliente</Link>}
          description="A base do CRM já está pronta para receber marcas, produtoras e parceiros comerciais."
          title="Nenhum cliente cadastrado ainda."
        />
      )}

      <style>{`
        .clients-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        @media (max-width: 1240px) {
          .clients-table th:nth-child(6),
          .clients-table td:nth-child(6),
          .clients-table th:nth-child(7),
          .clients-table td:nth-child(7) {
            display: none;
          }
        }

        @media (max-width: 760px) {
          .clients-table td:nth-child(6),
          .clients-table td:nth-child(7) {
            display: grid;
          }
        }
      `}</style>
    </AdminPage>
  );
}
