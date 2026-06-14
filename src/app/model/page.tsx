import { AIAssistantPanel } from "@/components/ai/ai-assistant-panel";
import { requireRole } from "@/lib/auth";

export default async function ModelPortalPage() {
  const profile = await requireRole(["model", "admin"]);

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
      <AIAssistantPanel role={profile.role} />
    </div>
  );
}
