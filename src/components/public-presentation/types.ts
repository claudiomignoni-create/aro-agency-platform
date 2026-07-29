import type {
  PublicPresentationDecision,
  PublicPresentationLinkState,
  PublicPresentationPayload
} from "@/lib/communications/data";

export type PublicPresentationMedia = {
  download_href?: string | null;
  media_type: string;
  public_media_key?: string | null;
  signed_url?: string | null;
  source_url?: string | null;
  thumbnail_url?: string | null;
  title?: string | null;
};

export type PublicPresentationModel = Omit<
  NonNullable<PublicPresentationPayload["snapshot"]["models"]>[number],
  "media"
> & {
  media: PublicPresentationMedia[];
};

export type PublicPresentationExperienceProps = {
  initialDecisions: Record<string, PublicPresentationDecision>;
  initialNote: string;
  linkState: PublicPresentationLinkState;
  models: PublicPresentationModel[];
  presentation: PublicPresentationPayload;
};
