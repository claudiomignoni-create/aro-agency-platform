import Link from "next/link";
import { requireRole } from "@/lib/auth";

export default async function ModelPortalPage() {
  await requireRole(["model", "admin"]);

  return (
    <div className="stack">
      <div className="grid">
        <section className="panel">
          <span className="eyebrow">Perfil</span>
          <h2>Completar cadastro</h2>
          <p>Edite dados, medidas e consentimentos.</p>
        </section>
        <section className="panel">
          <span className="eyebrow">Mídia</span>
          <h2>Enviar material</h2>
          <p>Fotos, polaroids e vídeos entram para revisão.</p>
        </section>
        <section className="panel">
          <span className="eyebrow">Agenda</span>
          <h2>Agenda</h2>
          <p>Acompanhe castings, opções, ensaios e trabalhos confirmados.</p>
        </section>
      </div>
      <section className="panel assistant-entry-panel">
        <div>
          <span className="eyebrow">AI Assistant</span>
          <h2>Orientacoes e perfil</h2>
          <p>
            Abra uma conversa dedicada para consultar orientacoes de casting e
            revisar somente os dados do seu proprio perfil.
          </p>
        </div>
        <Link className="button" href="/model/assistant">
          Abrir AI Assistant
        </Link>
      </section>
    </div>
  );
}
