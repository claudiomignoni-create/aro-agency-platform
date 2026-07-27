import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "@/components/admin/admin-icons";
import { getSeasonForTrip } from "@/lib/international-seasons";
import { getTravelTrip } from "@/lib/travel";

type TravelDocumentsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function TravelDocumentsPage({ params }: TravelDocumentsPageProps) {
  const { id } = await params;
  const [trip, season] = await Promise.all([getTravelTrip(id), getSeasonForTrip(id)]);

  if (!trip) notFound();

  return (
    <div className="stack">
      <section className="aro-glass-card" style={{ padding: 18 }}>
        <span className="eyebrow">Travel Documents</span>
        <h1>Documentos privados</h1>
        <p className="muted">{trip.title}</p>
      </section>
      <section className="aro-glass-card" style={{ padding: 18 }}>
        <FileText aria-hidden="true" />
        <p>
          Esta área está preparada para documentos privados no bucket <strong>model-documents</strong>,
          prefixo <strong>travel/</strong>. Upload completo permanece bloqueado até a próxima etapa
          operacional.
        </p>
        {season ? (
          <p className="muted">
            Status: contrato {season.contract_document_status}, passagem ida {season.outbound_ticket_status},
            passagem volta {season.return_ticket_status}, visto {season.visa_status}.
          </p>
        ) : null}
        <Link className="button secondary" href={`/admin/travel/${trip.id}`}>
          Voltar
        </Link>
      </section>
    </div>
  );
}
