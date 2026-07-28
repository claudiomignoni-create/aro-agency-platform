import type { PublicPresentationDecision } from "@/lib/communications/data";

export type PresentationMediaLike = {
  media_type: string;
};

export function withPresentationDecision(
  decisions: Record<string, PublicPresentationDecision>,
  publicModelKey: string,
  decision: PublicPresentationDecision
) {
  return { ...decisions, [publicModelKey]: decision };
}

export function presentationSelectionCounts(
  decisions: Record<string, PublicPresentationDecision>,
  modelKeys: Array<string | null | undefined>
) {
  const counts = { maybe: 0, no: 0, undecided: 0, yes: 0 };

  for (const key of modelKeys) {
    const decision = key ? decisions[key] : undefined;
    if (decision === "yes" || decision === "maybe" || decision === "no") {
      counts[decision] += 1;
    } else {
      counts.undecided += 1;
    }
  }

  return counts;
}

export function groupPresentationMedia<T extends PresentationMediaLike>(media: T[]) {
  return {
    book: media.filter((item) => item.media_type === "portfolio"),
    digitals: media.filter((item) => item.media_type === "polaroid"),
    documents: media.filter((item) => item.media_type === "document"),
    videos: media.filter((item) => item.media_type === "video")
  };
}

export function normalizeInstagramUrl(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) return null;

  if (/^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._-]+\/?$/i.test(normalized)) {
    return normalized;
  }

  const handle = normalized.replace(/^@/, "");
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(handle)) return null;
  return `https://www.instagram.com/${handle}`;
}
