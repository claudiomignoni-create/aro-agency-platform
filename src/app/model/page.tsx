export default function ModelPortalPage() {
  return (
    <div className="model-portal-home">
      <section className="model-portal-hero">
        <span className="eyebrow">ARO Model Portal</span>
        <h1>Minha área</h1>
        <p>Atualize perfil, materiais, agenda, viagens e pagamentos em um espaço seguro da ARO.</p>
        <div className="model-progress" aria-label="Cadastro 60% completo">
          <span style={{ width: "60%" }} />
        </div>
      </section>
      <section className="model-portal-grid">
        {[
          ["Atualização pendente", "Revise solicitações enviadas pela ARO.", "/model/requests"],
          ["Perfil e medidas", "Dados públicos e privados separados com clareza.", "/model/profile"],
          ["Materiais", "Portfolio, polaroids, vídeos e composites para revisão.", "/model/materials"],
          ["Trabalhos", "Próximos jobs, castings e opções.", "/model/jobs"],
          ["Travel", "Viagens, voos e documentos de temporada.", "/model/travel"],
          ["Pagamentos", "Resumo financeiro visível somente para você.", "/model/payments"]
        ].map(([title, description, href]) => (
          <a className="model-portal-card" href={href} key={href}>
            <strong>{title}</strong>
            <span>{description}</span>
          </a>
        ))}
      </section>
      <style>{`
        .model-portal-home {
          display: grid;
          gap: 14px;
        }

        .model-portal-hero,
        .model-portal-card {
          border: 1px solid rgba(153, 202, 255, 0.22);
          border-radius: 16px;
          background:
            radial-gradient(circle at 20% 0%, rgba(45, 133, 255, 0.2), transparent 18rem),
            rgba(9, 45, 104, 0.42);
          color: #f8fbff;
          padding: 16px;
          backdrop-filter: blur(16px);
        }

        .model-portal-hero h1 {
          margin: 6px 0;
          font-size: 28px;
          line-height: 1.1;
        }

        .model-portal-hero p,
        .model-portal-card span {
          color: rgba(248, 251, 255, 0.72);
          font-size: 12px;
          line-height: 1.5;
        }

        .model-progress {
          height: 8px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.1);
        }

        .model-progress span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: #69b4ff;
        }

        .model-portal-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .model-portal-card {
          display: grid;
          gap: 6px;
          text-decoration: none;
        }

        @media (max-width: 760px) {
          .model-portal-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
