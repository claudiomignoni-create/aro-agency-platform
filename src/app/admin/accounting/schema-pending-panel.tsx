import Link from "next/link";
import type { AccountingSchemaStatus } from "@/lib/accounting-schema";

export function AccountingSchemaPendingPanel({
  status
}: {
  status: AccountingSchemaStatus;
}) {
  return (
    <div className="stack">
      <section className="panel stack">
        <div>
          <span className="eyebrow">Accounting</span>
          <h2>Accounting ainda não foi ativado no banco desta instalação.</h2>
          <p>
            A interface está protegida até que as migrations oficiais desta release
            sejam aplicadas e validadas.
          </p>
        </div>
        <div className="grid">
          <article>
            <span className="eyebrow">Tabelas pendentes</span>
            <p>{status.missingTables.length ? status.missingTables.join(", ") : "Nenhuma"}</p>
          </article>
          <article>
            <span className="eyebrow">Colunas fiscais pendentes</span>
            <p>
              {status.missingClientColumns.length
                ? status.missingClientColumns.join(", ")
                : "Nenhuma"}
            </p>
          </article>
        </div>
        <div>
          <span className="eyebrow">Migrations pendentes</span>
          <ul>
            {status.missingMigrations.map((migration) => (
              <li key={migration}>{migration}</li>
            ))}
          </ul>
        </div>
        <div className="actions">
          <Link className="button" href="/admin/calendar">
            Voltar à Agenda
          </Link>
          <Link className="button secondary" href="/admin">
            Voltar ao painel
          </Link>
        </div>
      </section>
    </div>
  );
}
