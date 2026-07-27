import Link from "next/link";
import { notFound } from "next/navigation";
import { dateKeyFromIso } from "@/lib/calendar";
import { listClients } from "@/lib/clients";
import {
  getAdminJob,
  jobTitle,
  listModelCalendarConflictsByDate
} from "@/lib/jobs";
import { createModelMainImageUrls, listModels } from "@/lib/models";
import { updateAdminJobAction } from "../../../jobs/actions";
import { CalendarEventForm } from "../../event-form";

type EditCalendarEventPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function EditCalendarEventPage({
  params,
  searchParams
}: EditCalendarEventPageProps) {
  const { id } = await params;
  const { error } = (await searchParams) ?? {};
  const job = await getAdminJob(id);

  if (!job) {
    notFound();
  }

  const selectedDate = dateKeyFromIso(job.start_at);
  const [clients, models, conflicts] = await Promise.all([
    listClients(),
    listModels(),
    listModelCalendarConflictsByDate(selectedDate)
  ]);
  const modelImageUrls = await createModelMainImageUrls(models);

  return (
    <div className="stack">
      <section className="panel">
        <div className="actions spread">
          <div>
            <span className="eyebrow">Agenda</span>
            <h2>Editar evento</h2>
            <p>{jobTitle(job)}</p>
          </div>
          <Link className="button secondary" href={`/admin/calendar/${job.id}`}>
            Voltar ao detalhe
          </Link>
        </div>
      </section>

      {error ? <p className="notice error">{error}</p> : null}

      <CalendarEventForm
        action={updateAdminJobAction.bind(null, job.id)}
        clients={clients}
        conflicts={conflicts}
        event={job}
        modelImageUrls={modelImageUrls}
        models={models}
        submitLabel="Salvar evento"
      />
    </div>
  );
}
