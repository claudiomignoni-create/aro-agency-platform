import Image from "next/image";
import { notFound } from "next/navigation";
import { findUpdateRequestByToken } from "@/lib/communications/data";

export const metadata = {
  robots: {
    follow: false,
    index: false
  }
};

export default async function ModelUpdatePortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const request = await findUpdateRequestByToken(token);

  if (!request || ["expired", "canceled", "applied"].includes(request.status)) {
    notFound();
  }

  return (
    <main className="model-update-portal">
      <header>
        <Image alt="ARO" height={48} priority src="/brand/aro-mark-white.png" width={48} />
        <span>ARO</span>
      </header>
      <section className="model-update-card">
        <span>Atualização segura</span>
        <h1>{request.title}</h1>
        {request.message ? <p>{request.message}</p> : null}
        <p>Este link é exclusivo, expirável e não revela o ID interno da modelo.</p>
        {request.verification_required ? (
          <strong>Alguns campos sensíveis exigirão verificação adicional por e-mail.</strong>
        ) : null}
        <ol>
          <li>Boas-vindas</li>
          <li>Dados pessoais</li>
          <li>Medidas</li>
          <li>Materiais</li>
          <li>Revisão</li>
          <li>Enviado</li>
        </ol>
      </section>
      <style>{`
        .model-update-portal {
          min-height: 100vh;
          padding: 22px;
          background:
            radial-gradient(circle at 30% 0%, rgba(45, 133, 255, 0.32), transparent 22rem),
            linear-gradient(145deg, #052968, #020916);
          color: #f8fbff;
        }

        .model-update-portal header {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 900;
          letter-spacing: 0.16em;
        }

        .model-update-card {
          max-width: 620px;
          margin: 42px auto 0;
          border: 1px solid rgba(153, 202, 255, 0.24);
          border-radius: 18px;
          background: rgba(9, 45, 104, 0.42);
          padding: 20px;
          backdrop-filter: blur(18px);
        }

        .model-update-card h1 {
          margin: 8px 0;
          font-size: 28px;
          line-height: 1.1;
        }

        .model-update-card p,
        .model-update-card li {
          color: rgba(248, 251, 255, 0.76);
          font-size: 14px;
          line-height: 1.6;
        }
      `}</style>
    </main>
  );
}
