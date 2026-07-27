/* eslint-disable @next/next/no-img-element */
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  findPresentationByTokenWithRateLimit,
  getPresentationPrivateMediaRefsByToken,
  type PublicPresentationPayload
} from "@/lib/communications/data";
import { requestIpHash } from "@/lib/communications/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  robots: {
    follow: false,
    index: false
  }
};

type SnapshotModel = Omit<NonNullable<PublicPresentationPayload["snapshot"]["models"]>[number], "media"> & {
  media?: Array<{
    media_type: string;
    signed_url?: string | null;
    storage_bucket?: string;
    storage_path?: string | null;
    thumbnail_path?: string | null;
    title?: string | null;
  }>;
};

async function signPresentationMedia(
  presentation: PublicPresentationPayload,
  privateRefs: Awaited<ReturnType<typeof getPresentationPrivateMediaRefsByToken>>
): Promise<SnapshotModel[]> {
  const admin = createAdminClient();
  const models = await Promise.all(
    (presentation.snapshot.models ?? []).map(async (model, modelIndex): Promise<SnapshotModel> => {
      const refs = privateRefs[modelIndex] ?? [];
      const media = await Promise.all(
        (model.media ?? []).map(async (item, mediaIndex) => {
          const ref = refs[mediaIndex];
          const bucket = ref?.storage_bucket ?? "";
          const path = ref?.thumbnail_path || ref?.storage_path;
          if (!bucket || !path) return { ...item, signed_url: null };
          const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, 300);
          return { ...item, signed_url: error ? null : data.signedUrl };
        })
      );

      return { ...model, media } as SnapshotModel;
    })
  );

  return models;
}

function measurementLabel(key: string) {
  const labels: Record<string, string> = {
    bust_cm: "Busto",
    height_cm: "Altura",
    hips_cm: "Quadril",
    shoe_size: "Sapato",
    waist_cm: "Cintura"
  };
  return labels[key] ?? key;
}

export default async function PublicPresentationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ipHash = await requestIpHash();
  const presentation = await findPresentationByTokenWithRateLimit(token, ipHash);

  if (!presentation) {
    notFound();
  }

  const privateRefs = await getPresentationPrivateMediaRefsByToken(token);
  const models = await signPresentationMedia(presentation, privateRefs);

  return (
    <main className="public-presentation">
      <header>
        <Image alt="ARO" height={54} priority src="/brand/aro-mark-white.png" width={54} />
        <span>ARO</span>
      </header>
      <section className="presentation-hero">
        <span>Private presentation</span>
        <h1>{presentation.title}</h1>
        {presentation.description ? <p>{presentation.description}</p> : null}
      </section>

      <section className="presentation-grid" aria-label="Modelos selecionados">
        {models.map((model) => (
          <article className="presentation-model-card" key={model.display_name}>
            {model.media?.[0]?.signed_url ? (
              <img alt={model.display_name} src={model.media[0].signed_url} />
            ) : (
              <div className="presentation-placeholder">{model.display_name.slice(0, 2).toUpperCase()}</div>
            )}
            <div>
              {model.highlighted ? <span>Destaque</span> : null}
              <h2>{model.display_name}</h2>
              <p>{[model.city, model.country].filter(Boolean).join(", ") || "ARO"}</p>
              <dl>
                {Object.entries(model.measurements ?? {})
                  .filter(([, value]) => value)
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt>{measurementLabel(key)}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
              </dl>
            </div>
            {model.media && model.media.length > 1 ? (
              <div className="presentation-media-strip">
                {model.media.slice(1, 7).map((item, index) =>
                  item.signed_url ? (
                    <img alt={`${model.display_name} material ${index + 2}`} key={`${item.signed_url}-${index}`} src={item.signed_url} />
                  ) : null
                )}
              </div>
            ) : null}
          </article>
        ))}
      </section>

      {!models.length ? (
        <section className="presentation-empty">
          <p>Esta apresentação ainda não possui modelos publicados.</p>
        </section>
      ) : null}

      <footer>
        <strong>{presentation.snapshot.contact?.name ?? "Claudio Mignoni"}</strong>
        <span>{presentation.snapshot.contact?.email ?? "claudio@arolab.co"}</span>
        <span>{presentation.snapshot.contact?.website ?? "www.arolab.co"}</span>
      </footer>

      <style>{`
        .public-presentation {
          min-height: 100vh;
          padding: clamp(22px, 5vw, 60px);
          background:
            radial-gradient(circle at 70% 10%, rgba(45, 133, 255, 0.32), transparent 24rem),
            linear-gradient(145deg, #041f4e, #020916);
          color: #f8fbff;
        }

        .public-presentation header,
        .public-presentation footer {
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 900;
          letter-spacing: 0.12em;
        }

        .public-presentation footer {
          flex-wrap: wrap;
          margin-top: 48px;
          color: rgba(248, 251, 255, 0.72);
          font-size: 12px;
        }

        .presentation-hero {
          max-width: 980px;
          margin-top: clamp(42px, 9vw, 96px);
        }

        .public-presentation span {
          color: rgba(223, 235, 255, 0.68);
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .public-presentation h1 {
          max-width: 900px;
          margin: 10px 0;
          font-size: clamp(38px, 9vw, 96px);
          line-height: 0.95;
        }

        .public-presentation p {
          color: rgba(248, 251, 255, 0.76);
          font-size: 15px;
          line-height: 1.7;
        }

        .presentation-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 18px;
          margin-top: 36px;
        }

        .presentation-model-card {
          overflow: hidden;
          border: 1px solid rgba(153, 202, 255, 0.22);
          border-radius: 18px;
          background: rgba(9, 45, 104, 0.36);
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.32);
          backdrop-filter: blur(18px);
        }

        .presentation-model-card > img,
        .presentation-placeholder {
          width: 100%;
          aspect-ratio: 2 / 3;
          object-fit: cover;
          background: rgba(255, 255, 255, 0.08);
        }

        .presentation-placeholder {
          display: grid;
          place-items: center;
          font-size: 42px;
          font-weight: 900;
        }

        .presentation-model-card > div {
          padding: 16px;
        }

        .presentation-model-card h2 {
          margin: 4px 0;
          font-size: 22px;
        }

        .presentation-model-card dl {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin: 14px 0 0;
        }

        .presentation-model-card dt {
          color: rgba(223, 235, 255, 0.62);
          font-size: 11px;
          text-transform: uppercase;
        }

        .presentation-model-card dd {
          margin: 0;
          font-weight: 800;
        }

        .presentation-media-strip {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
          padding: 0 16px 16px;
        }

        .presentation-media-strip img {
          width: 100%;
          aspect-ratio: 1;
          border-radius: 10px;
          object-fit: cover;
        }
      `}</style>
    </main>
  );
}
