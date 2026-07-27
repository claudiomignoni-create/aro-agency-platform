import Image from "next/image";
import { notFound } from "next/navigation";
import { findPresentationByToken } from "@/lib/communications/data";

export const metadata = {
  robots: {
    follow: false,
    index: false
  }
};

export default async function PublicPresentationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const presentation = await findPresentationByToken(token);

  if (!presentation || !["published", "sent", "draft"].includes(presentation.status)) {
    notFound();
  }

  return (
    <main className="public-presentation">
      <header>
        <Image alt="ARO" height={54} priority src="/brand/aro-mark-white.png" width={54} />
        <span>ARO</span>
      </header>
      <section>
        <span>Private presentation</span>
        <h1>{presentation.title}</h1>
        {presentation.description ? <p>{presentation.description}</p> : null}
      </section>
      <section className="presentation-empty">
        <p>Esta apresentação usa snapshot autorizado e não exibe dados privados do cadastro ARO.</p>
      </section>
      <style>{`
        .public-presentation {
          min-height: 100vh;
          padding: clamp(22px, 5vw, 60px);
          background:
            radial-gradient(circle at 70% 10%, rgba(45, 133, 255, 0.32), transparent 24rem),
            linear-gradient(145deg, #041f4e, #020916);
          color: #f8fbff;
        }

        .public-presentation header {
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 900;
          letter-spacing: 0.18em;
        }

        .public-presentation section {
          max-width: 980px;
          margin-top: clamp(42px, 9vw, 110px);
        }

        .public-presentation span {
          color: rgba(223, 235, 255, 0.68);
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .public-presentation h1 {
          max-width: 820px;
          margin: 10px 0;
          font-size: clamp(38px, 9vw, 96px);
          line-height: 0.95;
        }

        .public-presentation p {
          color: rgba(248, 251, 255, 0.76);
          font-size: 16px;
          line-height: 1.7;
        }

        .presentation-empty {
          border: 1px solid rgba(153, 202, 255, 0.22);
          border-radius: 18px;
          background: rgba(9, 45, 104, 0.36);
          padding: 18px;
          backdrop-filter: blur(18px);
        }
      `}</style>
    </main>
  );
}
