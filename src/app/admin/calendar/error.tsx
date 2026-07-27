"use client";

import Link from "next/link";
import { useEffect } from "react";

type AdminCalendarErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AdminCalendarError({ error, reset }: AdminCalendarErrorProps) {
  useEffect(() => {
    console.error("[admin:calendar:error-boundary]", {
      digest: error.digest ?? "no-digest"
    });
  }, [error.digest]);

  return (
    <section className="panel stack">
      <div>
        <span className="eyebrow">Agenda</span>
        <h2>Não foi possível carregar esta área.</h2>
        <p>O erro foi registrado com um código seguro para diagnóstico.</p>
      </div>
      <div className="actions">
        <button className="button" onClick={reset} type="button">
          Tentar novamente
        </button>
        <Link className="button secondary" href="/admin">
          Voltar ao painel
        </Link>
      </div>
    </section>
  );
}
