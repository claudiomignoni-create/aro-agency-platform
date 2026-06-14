import Link from "next/link";

export default function ClientPortalPage() {
  return (
    <div className="grid">
      <section className="panel">
        <span className="eyebrow">Casting</span>
        <h2>Criar casting agora</h2>
        <p>
          Escolha uma data, veja modelos disponíveis e envie uma solicitação
          para a agência.
        </p>
        <Link className="button" href="/client/jobs/new">
          Criar casting agora
        </Link>
      </section>
      <section className="panel">
        <span className="eyebrow">Busca</span>
        <h2>Buscar modelos</h2>
        <p>
          Escolha um modelo específico, veja a agenda e solicite trabalho ou
          orçamento.
        </p>
        <Link className="button secondary" href="/client/models">
          Buscar modelos
        </Link>
      </section>
      <section className="panel">
        <span className="eyebrow">Trabalhos</span>
        <h2>Meus trabalhos</h2>
        <p>Acompanhe solicitações, propostas e confirmações.</p>
        <Link className="button secondary" href="/client/jobs">
          Ver solicitações
        </Link>
      </section>
    </div>
  );
}
