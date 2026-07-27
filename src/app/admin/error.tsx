"use client";

import Link from "next/link";

export default function AdminError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="panel stack" role="alert">
      <span className="eyebrow">Admin</span>
      <h2>Não foi possível carregar esta área.</h2>
      <p>
        Tente novamente. Se o problema continuar, revise as migrations e os
        serviços conectados antes de publicar em produção.
      </p>
      <div className="actions">
        <button className="button" onClick={reset} type="button">
          Tentar novamente
        </button>
        <Link className="button secondary" href="/admin">
          Voltar ao Dashboard
        </Link>
      </div>
    </section>
  );
}
