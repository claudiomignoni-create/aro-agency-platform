import { AIAssistantPanel } from "@/components/ai/ai-assistant-panel";
import { requireRole } from "@/lib/auth";

export default async function ClientPortalPage() {
  const profile = await requireRole(["client", "admin"]);

  return (
    <div className="stack">
      <div className="grid">
        <section className="panel">
          <span className="eyebrow">Busca</span>
          <h2>Encontrar modelos</h2>
          <p>Filtros por categoria, localização, medidas e tags.</p>
        </section>
        <section className="panel">
          <span className="eyebrow">Shortlists</span>
          <h2>Criar seleção</h2>
          <p>Organize modelos para enviar à agência.</p>
        </section>
        <section className="panel">
          <span className="eyebrow">Pedidos</span>
          <h2>Solicitar booking</h2>
          <p>Envie brief, data e local para análise.</p>
        </section>
      </div>
      <AIAssistantPanel role={profile.role} />
    </div>
  );
}
