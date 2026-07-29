"use client";

import { useEffect, useRef, useState } from "react";

const aroGoogleEmail = "claudio@arolab.co";

export function GoogleTestEmailForm({ enabled = true }: { enabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        className="button secondary"
        disabled={!enabled}
        onClick={() => setOpen(true)}
        type="button"
      >
        Enviar teste para {aroGoogleEmail}
      </button>
      {open ? (
        <div aria-modal="true" className="admin-dialog-backdrop" role="dialog">
          <form action="/api/integrations/google/test-email" className="admin-dialog" method="post">
            <span className="eyebrow">Confirmação</span>
            <h2>Enviar e-mail real de teste?</h2>
            <p>
              O teste será enviado somente para {aroGoogleEmail}. Nenhum cliente ou modelo receberá e-mail nesta etapa.
            </p>
            <div className="actions">
              <button className="button" ref={confirmRef} type="submit">
                Confirmar envio
              </button>
              <button className="button secondary" onClick={() => setOpen(false)} type="button">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
