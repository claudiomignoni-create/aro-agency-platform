"use client";

import Link from "next/link";
import { useRef } from "react";
import { deleteSimpleJobAction, updateJobStatusAction } from "@/app/admin/jobs/actions";
import type { JobDeletionStatus } from "@/lib/jobs";

type JobActionsMenuProps = {
  dateLabel: string;
  deletionStatus: JobDeletionStatus;
  jobId: string;
  modelLabel: string;
  title: string;
};

export function JobActionsMenu({
  dateLabel,
  deletionStatus,
  jobId,
  modelLabel,
  title
}: JobActionsMenuProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <div className="job-actions-menu">
      <details>
        <summary aria-label={`Ações para ${title}`}>Ações</summary>
        <div className="job-actions-popover">
          <Link href={`/admin/calendar/${jobId}`}>Abrir</Link>
          <Link href={`/admin/calendar/${jobId}/edit`}>Editar</Link>
          <button disabled type="button" title="Duplicação será ativada em uma próxima etapa.">
            Duplicar
          </button>
          <form action={updateJobStatusAction.bind(null, jobId, "canceled")}>
            <button type="submit">Cancelar</button>
          </form>
          <button disabled type="button" title="Arquivamento exige schema próprio para preservar auditoria.">
            Arquivar
          </button>
          <button
            disabled={!deletionStatus.canDelete}
            onClick={() => dialogRef.current?.showModal()}
            type="button"
          >
            Excluir
          </button>
          {!deletionStatus.canDelete ? <p>{deletionStatus.reason}</p> : null}
        </div>
      </details>

      <dialog className="admin-confirm-dialog" ref={dialogRef}>
        <form method="dialog">
          <button aria-label="Fechar confirmação" type="submit">×</button>
        </form>
        <div>
          <span className="eyebrow">Exclusão permanente</span>
          <h3>Excluir este job?</h3>
          <p>
            Esta ação remove o trabalho, vínculos de modelos e bloqueios de agenda sem retorno.
          </p>
          <dl>
            <div>
              <dt>Trabalho</dt>
              <dd>{title}</dd>
            </div>
            <div>
              <dt>Modelo(s)</dt>
              <dd>{modelLabel || "Sem modelo"}</dd>
            </div>
            <div>
              <dt>Data</dt>
              <dd>{dateLabel}</dd>
            </div>
          </dl>
          <div className="actions">
            <form action={deleteSimpleJobAction.bind(null, jobId)}>
              <button className="button" type="submit">Excluir permanentemente</button>
            </form>
            <form method="dialog">
              <button className="button secondary" type="submit">Voltar</button>
            </form>
          </div>
        </div>
      </dialog>

      <style jsx>{`
        .job-actions-menu {
          position: relative;
        }

        details {
          position: relative;
        }

        summary {
          display: inline-flex;
          min-height: 34px;
          align-items: center;
          border: 1px solid var(--admin-border);
          border-radius: 999px;
          cursor: pointer;
          list-style: none;
          padding: 0 12px;
          color: var(--admin-text);
          font-size: 12px;
          font-weight: 800;
        }

        summary::-webkit-details-marker {
          display: none;
        }

        .job-actions-popover {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          z-index: 10;
          display: grid;
          min-width: 210px;
          gap: 4px;
          border: 1px solid var(--admin-border);
          border-radius: 12px;
          background: rgba(2, 18, 50, 0.94);
          padding: 8px;
          box-shadow: 0 22px 60px rgba(0, 0, 0, 0.28);
          backdrop-filter: blur(20px);
        }

        a,
        .job-actions-popover button {
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: var(--admin-text);
          padding: 9px 10px;
          text-align: left;
          font-size: 12px;
          font-weight: 800;
        }

        a:hover,
        .job-actions-popover button:not(:disabled):hover {
          background: rgba(105, 180, 255, 0.14);
        }

        button:disabled {
          cursor: not-allowed;
          color: var(--admin-muted);
          opacity: 0.58;
        }

        p {
          margin: 4px 2px 0;
          color: var(--admin-muted);
          font-size: 11px;
          line-height: 1.45;
        }

        .admin-confirm-dialog {
          width: min(460px, calc(100vw - 28px));
          border: 1px solid var(--admin-border-strong);
          border-radius: 14px;
          background: rgba(2, 18, 50, 0.96);
          color: var(--admin-text);
          padding: 0;
          box-shadow: 0 28px 90px rgba(0, 0, 0, 0.45);
        }

        .admin-confirm-dialog::backdrop {
          background: rgba(1, 10, 28, 0.62);
          backdrop-filter: blur(4px);
        }

        .admin-confirm-dialog > form:first-child {
          position: absolute;
          top: 10px;
          right: 10px;
        }

        .admin-confirm-dialog > form:first-child button {
          display: inline-flex;
          width: 32px;
          height: 32px;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--admin-border);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.06);
          color: var(--admin-text);
          font-size: 18px;
        }

        .admin-confirm-dialog > div {
          display: grid;
          gap: 12px;
          padding: 22px;
        }

        .admin-confirm-dialog h3,
        .admin-confirm-dialog p,
        .admin-confirm-dialog dl {
          margin: 0;
        }

        dl {
          display: grid;
          gap: 8px;
        }

        dl div {
          display: grid;
          grid-template-columns: 92px minmax(0, 1fr);
          gap: 10px;
        }

        dt {
          color: var(--admin-muted);
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
        }

        dd {
          margin: 0;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        @media (max-width: 760px) {
          .job-actions-popover {
            left: 0;
            right: auto;
          }
        }
      `}</style>
    </div>
  );
}
