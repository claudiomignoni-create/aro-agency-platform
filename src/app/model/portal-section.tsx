import Link from "next/link";

export function ModelPortalSection({
  description,
  items = [],
  title
}: {
  description: string;
  items?: Array<{ href?: string; meta?: string | null; title: string }>;
  title: string;
}) {
  return (
    <section className="model-portal-section">
      <header>
        <span className="eyebrow">ARO Model Portal</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      {items.length ? (
        <div className="model-portal-list">
          {items.map((entry) => {
            const content = (
              <>
                <strong>{entry.title}</strong>
                {entry.meta ? <span>{entry.meta}</span> : null}
              </>
            );

            return entry.href ? (
              <Link href={entry.href} key={`${entry.title}-${entry.meta}`}>
                {content}
              </Link>
            ) : (
              <article key={`${entry.title}-${entry.meta}`}>{content}</article>
            );
          })}
        </div>
      ) : (
        <p className="muted">Nenhum registro disponível agora.</p>
      )}
      <Link className="button secondary" href="/model">Voltar ao portal</Link>
      <style>{`
        .model-portal-section {
          display: grid;
          gap: 14px;
          border: 1px solid rgba(153, 202, 255, 0.22);
          border-radius: 16px;
          background: rgba(9, 45, 104, 0.42);
          color: #f8fbff;
          padding: 16px;
          backdrop-filter: blur(16px);
        }

        .model-portal-section h2 {
          margin: 6px 0;
          font-size: 24px;
        }

        .model-portal-section p,
        .model-portal-list span {
          color: rgba(248, 251, 255, 0.72);
          font-size: 12px;
          line-height: 1.5;
        }

        .model-portal-list {
          display: grid;
          gap: 8px;
        }

        .model-portal-list article,
        .model-portal-list a {
          display: grid;
          gap: 4px;
          border: 1px solid rgba(153, 202, 255, 0.18);
          border-radius: 12px;
          background: rgba(4, 24, 60, 0.42);
          color: inherit;
          padding: 12px;
          text-decoration: none;
        }
      `}</style>
    </section>
  );
}
