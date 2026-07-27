import Image from "next/image";
import { notFound } from "next/navigation";
import { findUpdateRequestByToken, startUpdateRequestByToken } from "@/lib/communications/data";
import { ModelUpdateForm } from "@/app/update/[token]/model-update-form";

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

  await startUpdateRequestByToken(token);

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
        <p>
          Olá, {request.model.stage_name || request.model.display_name}. Este link é exclusivo, expirável e envia
          suas respostas para revisão da ARO.
        </p>
        <ol>
          <li>Boas-vindas</li>
          <li>Dados solicitados</li>
          <li>Materiais</li>
          <li>Revisão</li>
          <li>Enviado</li>
        </ol>
        <ModelUpdateForm request={request} token={token} />
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
          max-width: 760px;
          margin: 42px auto 0;
          border: 1px solid rgba(153, 202, 255, 0.24);
          border-radius: 18px;
          background: rgba(9, 45, 104, 0.42);
          padding: clamp(18px, 4vw, 28px);
          backdrop-filter: blur(18px);
        }

        .model-update-card h1 {
          margin: 8px 0;
          font-size: clamp(28px, 8vw, 54px);
          line-height: 1.02;
        }

        .model-update-card p,
        .model-update-card li {
          color: rgba(248, 251, 255, 0.76);
          font-size: 14px;
          line-height: 1.6;
        }

        .model-update-card ol {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 0;
          list-style: none;
        }

        .model-update-card li {
          border: 1px solid rgba(153, 202, 255, 0.2);
          border-radius: 999px;
          padding: 6px 10px;
        }

        .model-update-form,
        .model-update-form section {
          display: grid;
          gap: 14px;
          margin-top: 18px;
        }

        .model-update-form label {
          display: grid;
          gap: 8px;
        }

        .model-update-form label > span {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .model-update-form strong {
          border-radius: 999px;
          background: rgba(112, 178, 255, 0.16);
          color: #dcecff;
          padding: 4px 8px;
          font-size: 10px;
        }

        .model-update-form input,
        .model-update-form textarea {
          width: 100%;
          border: 1px solid rgba(153, 202, 255, 0.28);
          border-radius: 12px;
          background: rgba(4, 24, 60, 0.72);
          color: #f8fbff;
          padding: 12px;
        }

        .model-update-form input:focus,
        .model-update-form textarea:focus {
          border-color: rgba(112, 178, 255, 0.86);
          box-shadow: 0 0 0 3px rgba(45, 133, 255, 0.22);
          outline: none;
        }

        .model-update-progress {
          overflow: hidden;
          height: 8px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.1);
        }

        .model-update-progress span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #6ab2ff, #ffffff);
          transition: width 180ms ease;
        }

        .model-update-status {
          margin: 0;
          font-size: 12px;
        }

        .model-update-submit {
          width: fit-content;
          border: 1px solid rgba(153, 202, 255, 0.34);
          border-radius: 12px;
          background: #1f7dff;
          color: #fff;
          cursor: pointer;
          font-weight: 900;
          padding: 12px 16px;
        }

        .model-update-form dl {
          display: grid;
          gap: 8px;
        }

        .model-update-form dl div {
          display: grid;
          grid-template-columns: 160px 1fr;
          gap: 10px;
        }

        .model-update-form dt {
          color: rgba(223, 235, 255, 0.68);
        }

        .model-update-form dd {
          margin: 0;
        }
      `}</style>
    </main>
  );
}
