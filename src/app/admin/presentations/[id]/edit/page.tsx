import Link from "next/link";
import {
  AdminEmptyState,
  AdminPage,
  AdminPageHeader,
  AdminSection
} from "@/components/admin/admin-ui";
import {
  PresentationEditor,
  type PresentationEditorConfig,
  type PresentationEditorModel,
  type PresentationEditorStep
} from "@/components/admin/presentation-editor";
import { requireRole } from "@/lib/auth";
import { isMissingSchemaError } from "@/lib/accounting-schema";
import { createClient } from "@/lib/supabase/server";
import { createModelMainImageUrls, listModels } from "@/lib/models";
import {
  publishUpdatedPresentationAction,
  updatePresentationAction
} from "@/app/admin/presentations/actions";

type EditPresentationPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    error?: string;
    notice?: string;
    step?: string;
    token?: string;
  }>;
};

type PresentationModelRow = {
  include_location: boolean;
  include_measurements: boolean;
  include_social_links: boolean;
  model_id: string;
  model_snapshot: { highlighted?: boolean } | null;
  position: number;
};

type SelectedMediaRow = {
  media: { media_type: string } | Array<{ media_type: string }> | null;
  model_media_id: string | null;
  presentation_model:
    | { model_id: string; presentation_id: string }
    | Array<{ model_id: string; presentation_id: string }>;
};

function option(label: string, value: string) {
  return { label, value };
}

function editorStep(value?: string): PresentationEditorStep {
  if (value === "info" || value === "materials" || value === "review") return value;
  return "models";
}

function relation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function EditPresentationPage({
  params,
  searchParams
}: EditPresentationPageProps) {
  await requireRole(["admin"]);
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const supabase = await createClient();

  const [
    presentationResult,
    selectedResult,
    selectedMediaResult,
    clientsResult,
    agenciesResult,
    jobsResult,
    models
  ] = await Promise.all([
    supabase
      .from("presentations")
      .select("id, title, description, purpose, language, status, client_id, agency_id, job_id, expires_at, allow_downloads")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("presentation_models")
      .select("model_id, position, include_measurements, include_location, include_social_links, model_snapshot")
      .eq("presentation_id", id),
    supabase
      .from("presentation_model_media")
      .select("model_media_id, media:model_media(media_type), presentation_model:presentation_models!inner(presentation_id, model_id)")
      .eq("presentation_model.presentation_id", id),
    supabase.from("clients").select("id, company_name").order("company_name", { ascending: true }).limit(100),
    supabase.from("partner_agencies").select("id, display_name").order("display_name", { ascending: true }).limit(100),
    supabase.from("jobs").select("id, project_name, brand_name, start_at").order("start_at", { ascending: false }).limit(100),
    listModels()
  ]);

  if (presentationResult.error && isMissingSchemaError(presentationResult.error)) {
    return (
      <AdminPage>
        <AdminPageHeader eyebrow="Presentation" title="Editar apresentação" />
        <AdminSection>
          <AdminEmptyState
            description="O editor ainda não está disponível neste ambiente."
            title="Apresentações indisponíveis"
          />
        </AdminSection>
      </AdminPage>
    );
  }

  if (presentationResult.error) throw presentationResult.error;
  if (selectedResult.error) throw selectedResult.error;
  if (selectedMediaResult.error) throw selectedMediaResult.error;
  if (clientsResult.error) throw clientsResult.error;
  if (agenciesResult.error && !isMissingSchemaError(agenciesResult.error)) throw agenciesResult.error;
  if (jobsResult.error) throw jobsResult.error;

  const presentation = presentationResult.data;
  if (!presentation) {
    return (
      <AdminPage>
        <AdminPageHeader
          actions={<Link className="button secondary" href="/admin/presentations">Voltar</Link>}
          description="O registro solicitado não existe ou não está mais disponível."
          eyebrow="Presentation"
          title="Apresentação não encontrada"
        />
      </AdminPage>
    );
  }

  const configs: Record<string, PresentationEditorConfig> = {};
  for (const [index, model] of models.entries()) {
    configs[model.id] = {
      highlighted: false,
      includeLocation: true,
      includeMeasurements: true,
      includeSocialLinks: false,
      media: {},
      position: index,
      selected: false
    };
  }
  for (const row of (selectedResult.data ?? []) as PresentationModelRow[]) {
    configs[row.model_id] = {
      highlighted: Boolean(row.model_snapshot?.highlighted),
      includeLocation: row.include_location,
      includeMeasurements: row.include_measurements,
      includeSocialLinks: row.include_social_links,
      media: {},
      position: row.position,
      selected: true
    };
  }
  for (const row of (selectedMediaResult.data ?? []) as SelectedMediaRow[]) {
    const presentationModel = relation(row.presentation_model);
    const media = relation(row.media);
    if (!row.model_media_id || !presentationModel || !configs[presentationModel.model_id]) continue;
    configs[presentationModel.model_id].media[row.model_media_id] =
      media?.media_type ?? "portfolio";
  }

  const mainImageUrls = await createModelMainImageUrls(models);
  const editorModels: PresentationEditorModel[] = models.map((model) => ({
    categories: model.categories ?? [],
    city: model.current_city || model.base_city || model.city,
    country: model.current_country || model.base_country || model.country,
    gender: model.gender,
    heightCm: model.height_cm,
    id: model.id,
    imageUrl: mainImageUrls[model.id] ?? null,
    name: model.stage_name || model.display_name
  }));
  const clientOptions = [
    option("Sem cliente", "none"),
    ...((clientsResult.data ?? []) as Array<{ company_name: string; id: string }>).map((client) =>
      option(client.company_name, client.id)
    )
  ];
  const agencyOptions = [
    option("Sem agência", "none"),
    ...((agenciesResult.data ?? []) as Array<{ display_name: string; id: string }>).map((agency) =>
      option(agency.display_name, agency.id)
    )
  ];
  const jobOptions = [
    option("Sem job", "none"),
    ...((jobsResult.data ?? []) as Array<{
      brand_name: string | null;
      id: string;
      project_name: string | null;
      start_at: string;
    }>).map((job) =>
      option(
        job.project_name || job.brand_name || new Date(job.start_at).toLocaleDateString("pt-BR"),
        job.id
      )
    )
  ];
  const saveAction = updatePresentationAction.bind(null, id);
  const publishAction = publishUpdatedPresentationAction.bind(null, id);
  const detailHref = `/admin/presentations/${id}${query.token ? `?token=${encodeURIComponent(query.token)}` : ""}`;

  return (
    <AdminPage>
      <AdminPageHeader
        actions={<Link className="button secondary" href={detailHref}>Voltar</Link>}
        description="Selecione modelos diretamente pelas fotos e carregue os materiais somente quando precisar configurá-los."
        eyebrow="Presentation"
        title={presentation.title}
      />

      {query.error === "no-models" ? (
        <AdminSection className="admin-notice">
          <p className="muted">Selecione pelo menos um modelo antes de publicar.</p>
        </AdminSection>
      ) : null}
      {query.notice === "saved" ? (
        <AdminSection className="admin-notice">
          <p className="muted">Rascunho salvo.</p>
        </AdminSection>
      ) : null}

      <PresentationEditor
        action={saveAction}
        agencyOptions={agencyOptions}
        cancelHref={detailHref}
        clientOptions={clientOptions}
        configs={configs}
        details={{
          agencyId: presentation.agency_id,
          allowDownloads: presentation.allow_downloads,
          clientId: presentation.client_id,
          description: presentation.description,
          expiresAt: presentation.expires_at,
          jobId: presentation.job_id,
          language: presentation.language,
          purpose: presentation.purpose,
          title: presentation.title
        }}
        initialStep={editorStep(query.step)}
        jobOptions={jobOptions}
        models={editorModels}
        presentationId={id}
        publicToken={query.token}
        publishAction={publishAction}
      />
    </AdminPage>
  );
}
