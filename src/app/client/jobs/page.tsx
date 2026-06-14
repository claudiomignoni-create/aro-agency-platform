import Link from "next/link";
import { dateKeyFromIso, formatDatePtBr } from "@/lib/calendar";
import {
  formatMoney,
  jobTitle,
  jobTypeLabel,
  listClientJobs,
  modelNames
} from "@/lib/jobs";

type ClientJobsPageProps = {
  searchParams?: Promise<{
    created?: string;
  }>;
};

export default async function ClientJobsPage({ searchParams }: ClientJobsPageProps) {
  const params = (await searchParams) ?? {};
  const jobs = await listClientJobs();

  return (
    <div className="stack">
      {params.created ? (
        <p className="toast">Solicitação enviada para revisão da agência.</p>
      ) : null}
      <section className="panel">
        <div className="actions spread">
          <div>
            <span className="eyebrow">Cliente</span>
            <h2>Meus trabalhos</h2>
            <p>Solicitações, orçamentos e trabalhos vinculados ao seu perfil.</p>
          </div>
          <Link className="button" href="/client/jobs/new">
            Nova solicitação
          </Link>
        </div>
      </section>

      <section className="panel table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Projeto / marca</th>
              <th>Data</th>
              <th>Modelos solicitados</th>
              <th>Tipo</th>
              <th>Status</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>{jobTitle(job)}</td>
                <td>{formatDatePtBr(dateKeyFromIso(job.start_at))}</td>
                <td>{modelNames(job) || "-"}</td>
                <td>{jobTypeLabel(job.type)}</td>
                <td>
                  <span className="status">{job.status}</span>
                </td>
                <td>{formatMoney(job.final_amount ?? job.client_budget)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {jobs.length === 0 ? (
          <p>Nenhum trabalho solicitado ainda.</p>
        ) : null}
      </section>
    </div>
  );
}
