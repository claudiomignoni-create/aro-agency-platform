import Link from "next/link";
import { requireRole } from "@/lib/auth";

export default async function ClientPortalPage() {
  await requireRole(["client", "admin"]);

  return (
    <div className="stack">
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
      <section className="panel assistant-entry-panel">
        <div>
          <span className="eyebrow">AI Assistant</span>
          <h2>Recomendar modelos com AI</h2>
          <p>
            Abra uma conversa dedicada para buscar modelos publicados e refinar
            campanhas com dados disponiveis para clientes.
          </p>
        </div>
        <Link className="button" href="/client/assistant">
          Abrir AI Assistant
        </Link>
      </section>
    </div>
  );
}
