import Link from "next/link";
import { notFound } from "next/navigation";
import { agencyStatusLabel, agencyTypeLabel, getPartnerAgency } from "@/lib/agencies";
import { internationalSeasonStatusLabel } from "@/lib/international-seasons";

type AgencyDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Sao_Paulo",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00.000Z`));
}

export default async function AgencyDetailPage({ params }: AgencyDetailPageProps) {
  const { id } = await params;
  const agency = await getPartnerAgency(id);

  if (!agency) notFound();

  return (
    <div className="agency-detail">
      <section className="aro-glass-card agency-detail-hero">
        <div>
          <span className="eyebrow">Agencies</span>
          <h1>{agency.display_name}</h1>
          <p>{agency.legal_name || agencyTypeLabel(agency.agency_type)}</p>
        </div>
        <div className="actions">
          <Link className="button secondary" href="/admin/agencies">
            Voltar
          </Link>
          <Link className="button" href={`/admin/agencies/${agency.id}/edit`}>
            Editar
          </Link>
        </div>
      </section>

      <section className="agency-detail-grid">
        <article className="aro-glass-card agency-detail-card">
          <h2>Resumo</h2>
          <dl>
            <div><dt>Status</dt><dd>{agencyStatusLabel(agency.status)}</dd></div>
            <div><dt>Tipo</dt><dd>{agencyTypeLabel(agency.agency_type)}</dd></div>
            <div><dt>Local</dt><dd>{[agency.city, agency.state_region, agency.country].filter(Boolean).join(", ") || "—"}</dd></div>
            <div><dt>Timezone</dt><dd>{agency.timezone || "—"}</dd></div>
            <div><dt>Website</dt><dd>{agency.website_url ? <a href={agency.website_url}>{agency.website_url}</a> : "—"}</dd></div>
            <div><dt>Instagram</dt><dd>{agency.instagram_url ? <a href={agency.instagram_url}>{agency.instagram_url}</a> : "—"}</dd></div>
          </dl>
        </article>

        <article className="aro-glass-card agency-detail-card">
          <h2>Contato e financeiro</h2>
          <dl>
            <div><dt>E-mail</dt><dd>{agency.primary_email || "—"}</dd></div>
            <div><dt>Contato</dt><dd>{agency.contact_name || "—"}</dd></div>
            <div><dt>Cargo</dt><dd>{agency.contact_role || "—"}</dd></div>
            <div><dt>Telefone</dt><dd>{agency.phone || "—"}</dd></div>
            <div><dt>WhatsApp</dt><dd>{agency.whatsapp || "—"}</dd></div>
            <div><dt>Prazo</dt><dd>{agency.default_payment_terms_days === null ? "—" : `${agency.default_payment_terms_days} dias`}</dd></div>
          </dl>
        </article>

        <article className="aro-glass-card agency-detail-card span-2">
          <h2>Temporadas internacionais</h2>
          <div className="agency-season-list">
            {agency.seasons.length > 0 ? (
              agency.seasons.map((season) => (
                <Link href={season.trip_id ? `/admin/travel/${season.trip_id}` : "/admin/travel"} key={season.id}>
                  <strong>{season.title}</strong>
                  <span>{season.model?.stage_name || season.model?.display_name || "Modelo"}</span>
                  <small>
                    {formatDate(season.contract_start_date)} → {formatDate(season.contract_end_date)} · {internationalSeasonStatusLabel(season.status)}
                  </small>
                </Link>
              ))
            ) : (
              <p className="muted">Nenhuma temporada vinculada.</p>
            )}
          </div>
        </article>

        {agency.notes ? (
          <article className="aro-glass-card agency-detail-card span-2">
            <h2>Observacoes internas</h2>
            <p>{agency.notes}</p>
          </article>
        ) : null}
      </section>

      <style>{`
        .agency-detail {
          display: grid;
          gap: 14px;
        }

        .agency-detail-hero,
        .agency-detail-card {
          padding: 18px;
        }

        .agency-detail-hero {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 16px;
        }

        .agency-detail-hero h1 {
          margin: 0 0 6px;
          font-size: clamp(28px, 4vw, 44px);
        }

        .agency-detail-hero p,
        .agency-detail-card p {
          margin: 0;
          color: var(--admin-muted);
        }

        .agency-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .span-2 {
          grid-column: span 2;
        }

        .agency-detail-card h2 {
          margin: 0 0 12px;
          font-size: 18px;
        }

        .agency-detail-card dl {
          display: grid;
          gap: 9px;
          margin: 0;
        }

        .agency-detail-card div {
          display: grid;
          grid-template-columns: 92px minmax(0, 1fr);
          gap: 8px;
        }

        .agency-detail-card dt {
          color: var(--admin-muted);
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .agency-detail-card dd {
          margin: 0;
          overflow-wrap: anywhere;
        }

        .agency-season-list {
          display: grid;
          gap: 10px;
        }

        .agency-season-list a {
          display: grid;
          gap: 4px;
          border: 1px solid var(--admin-border);
          border-radius: 12px;
          padding: 12px;
        }

        .agency-season-list small,
        .agency-season-list span {
          color: var(--admin-muted);
        }

        @media (max-width: 820px) {
          .agency-detail-hero {
            align-items: start;
            flex-direction: column;
          }

          .agency-detail-grid {
            grid-template-columns: 1fr;
          }

          .span-2 {
            grid-column: auto;
          }
        }
      `}</style>
    </div>
  );
}
