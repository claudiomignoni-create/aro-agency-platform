import {
  PublicPresentationExperience,
  PresentationUnavailableState
} from "@/components/public-presentation/public-presentation-experience";
import type {
  PublicPresentationMedia,
  PublicPresentationModel
} from "@/components/public-presentation/types";
import {
  findPresentationByTokenWithRateLimit,
  findPresentationLinkState,
  getPresentationPrivateMediaRefsByToken,
  recordPresentationEvent,
  type PublicPresentationLinkState,
  type PublicPresentationPayload
} from "@/lib/communications/data";
import { requestIpHash } from "@/lib/communications/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import "./public-presentation.css";

export const dynamic = "force-dynamic";

export const metadata = {
  robots: {
    follow: false,
    index: false
  }
};

async function signedUrl(bucket: string, path: string | null | undefined) {
  if (!path) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, 300);
  return error ? null : data.signedUrl;
}

async function signPresentationMedia(
  presentation: PublicPresentationPayload,
  privateRefs: Awaited<ReturnType<typeof getPresentationPrivateMediaRefsByToken>>,
  token: string
): Promise<PublicPresentationModel[]> {
  return Promise.all(
    (presentation.snapshot.models ?? []).map(async (model) => {
      const media = await Promise.all(
        (model.media ?? []).map(async (item): Promise<PublicPresentationMedia> => {
          const ref = item.public_media_key ? privateRefs[item.public_media_key] : null;
          const bucket = ref?.storage_bucket ?? "";
          if (!bucket || !ref?.storage_path) return { ...item };

          const previewPath =
            item.media_type === "video" || item.media_type === "document"
              ? ref.thumbnail_path
              : ref.storage_path;
          const [sourceUrl, thumbnailUrl] =
            previewPath === ref.storage_path
              ? await signedUrl(bucket, ref.storage_path).then((url) => [url, url])
              : await Promise.all([
                  signedUrl(bucket, ref.storage_path),
                  signedUrl(bucket, ref.thumbnail_path)
                ]);

          return {
            ...item,
            download_href: item.public_media_key
              ? `/p/${encodeURIComponent(token)}/download/${encodeURIComponent(item.public_media_key)}`
              : null,
            signed_url: thumbnailUrl || (item.media_type === "document" ? null : sourceUrl),
            source_url: sourceUrl,
            thumbnail_url: thumbnailUrl
          };
        })
      );

      return { ...model, media };
    })
  );
}

function legacyActiveState(presentation: PublicPresentationPayload): PublicPresentationLinkState {
  return {
    expires_at: presentation.link?.expires_at ?? null,
    recipient_name: presentation.link?.recipient_name ?? null,
    schema_ready: false,
    selection: {
      client_note: null,
      decisions: {},
      submitted_at: null
    },
    state: "active"
  };
}

export default async function PublicPresentationPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ipHash = await requestIpHash();
  const [presentation, state] = await Promise.all([
    findPresentationByTokenWithRateLimit(token, ipHash),
    findPresentationLinkState(token)
  ]);

  if (!presentation) {
    return <PresentationUnavailableState status={state?.state === "active" ? "invalid" : state?.state ?? "invalid"} />;
  }

  const linkState = state ?? legacyActiveState(presentation);
  if (linkState.state !== "active") {
    return <PresentationUnavailableState status={linkState.state} />;
  }

  const privateRefs = await getPresentationPrivateMediaRefsByToken(token);
  const models = await signPresentationMedia(presentation, privateRefs, token);

  await recordPresentationEvent({
    eventType: "presentation_viewed",
    token
  }).catch(() => false);

  return (
    <PublicPresentationExperience
      initialDecisions={linkState.selection.decisions}
      initialNote={linkState.selection.client_note ?? ""}
      linkState={linkState}
      models={models}
      presentation={presentation}
    />
  );
}
