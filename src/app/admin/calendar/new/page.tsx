import Link from "next/link";
import { currentDateKey, isValidDateKey, safeDateKey } from "@/lib/calendar";
import { listClients } from "@/lib/clients";
import {
  listModelCalendarConflictsByDate,
  safeJobType
} from "@/lib/jobs";
import { createModelMainImageUrls, listModels } from "@/lib/models";
import { createAdminJobAction } from "../../jobs/actions";
import { CalendarEventForm } from "../event-form";

type NewCalendarEventPageProps = {
  searchParams?: Promise<{
    date?: string;
    error?: string;
    modelId?: string;
    type?: string;
  }>;
};

export default async function NewCalendarEventPage({
  searchParams
}: NewCalendarEventPageProps) {
  const params = (await searchParams) ?? {};
  const today = currentDateKey();
  const selectedDate = safeDateKey(params.date, today);
  const hasInvalidDateParam = Boolean(params.date && !isValidDateKey(params.date));
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
            <h2>Novo evento</h2>
            <p>Crie trabalho, casting, opção, fitting, viagem, reunião ou bloqueio.</p>
          </div>
          <Link className="button secondary" href="/admin/calendar">
            Voltar
          </Link>
        </div>
      </section>

      {params.error ? <p className="notice error">{params.error}</p> : null}
      {hasInvalidDateParam ? (
        <p className="notice error">
          Data invalida na URL. Usamos a data atual para continuar.
        </p>
      ) : null}

      <CalendarEventForm
        action={createAdminJobAction}
        clients={clients}
        conflicts={conflicts}
        initialDate={selectedDate}
        initialModelId={params.modelId}
        initialType={safeJobType(params.type)}
        modelImageUrls={modelImageUrls}
        models={models}
        submitLabel="Criar evento"
      />
    </div>
  );
}
