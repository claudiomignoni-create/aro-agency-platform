import Link from "next/link";
import {
  AdminEmptyState,
  AdminPage,
  AdminPageHeader,
  AdminSearchField,
  AdminSection,
  AdminSelectField,
  AdminTextField
} from "@/components/admin/admin-ui";
import { requireRole } from "@/lib/auth";
import { isMissingSchemaError } from "@/lib/accounting-schema";
import { createClient } from "@/lib/supabase/server";
import { createModelMainImageUrls, listModels } from "@/lib/models";
import { updatePresentationAction } from "@/app/admin/presentations/actions";

type EditPresentationPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; q?: string }>;
};

type PresentationModelRow = {
  include_location: boolean;
  include_measurements: boolean;
  include_social_links: boolean;
  model_id: string;
  model_snapshot: { highlighted?: boolean } | null;
  position: number;
};

type MediaRow = {
  id: string;
  media_type: string;
  model_id: string;
  storage_path: string;
  thumbnail_path: string | null;
  title: string | null;
};

function option(label: string, value: string) {
  return { label, value };
}

function includesQuery(values: Array<string | null | undefined>, q: string) {
  if (!q) return true;
  const normalized = q.toLowerCase();
  return values.some((value) => value?.toLowerCase().includes(normalized));
}

export default async function EditPresentationPage({ params, searchParams }: EditPresentationPageProps) {
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
      .select("model_media_id, presentation_model:presentation_models!inner(presentation_id, model_id)")
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
            description="O editor será ativado após a migration 025."
            title="Schema pendente"
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
        <AdminPageHeader eyebrow="Presentation" title="Apresentação não encontrada" />
      </AdminPage>
    );
  }

  const selectedByModel = new Map<string, PresentationModelRow>();
  for (const row of (selectedResult.data ?? []) as PresentationModelRow[]) {
    selectedByModel.set(row.model_id, row);
  }

  const selectedMediaIds = new Set(
    (selectedMediaResult.data ?? [])
      .map((row) => row.model_media_id as string | null)
      .filter(Boolean) as string[]
  );

  const filteredModels = models.filter((model) =>
    includesQuery(
      [
        model.display_name,
        model.stage_name,
        model.email,
        model.current_city,
        model.current_country,
        model.base_city,
        model.base_country,
        model.nationality
      ],
      query.q ?? ""
    )
  );
  const modelIds = filteredModels.map((model) => model.id);
  const mainImageUrls = await createModelMainImageUrls(filteredModels);
  const mediaResult = modelIds.length
    ? await supabase
        .from("model_media")
        .select("id, model_id, media_type, storage_path, thumbnail_path, title")
        .in("model_id", modelIds)
        .eq("status", "approved")
        .neq("visibility", "private")
        .order("sort_order", { ascending: true, nullsFirst: false })
    : { data: [], error: null };

  if (mediaResult.error) throw mediaResult.error;

  const mediaByModel = new Map<string, MediaRow[]>();
  for (const media of (mediaResult.data ?? []) as MediaRow[]) {
    const bucket = mediaByModel.get(media.model_id) ?? [];
    bucket.push(media);
    mediaByModel.set(media.model_id, bucket);
  }

  const saveAction = updatePresentationAction.bind(null, id);
  const clientOptions = [
    option("Sem cliente", "none"),
    ...((clientsResult.data ?? []) as Array<{ company_name: string; id: string }>).map((client) =>
      option(client.company_name, client.id)
    )
  ];
  const agencyOptions = [
    option("Sem agência", "none"),
    ...(((agenciesResult.data ?? []) as Array<{ display_name: string; id: string }>).map((agency) =>
      option(agency.display_name, agency.id)
    ))
  ];
  const jobOptions = [
    option("Sem job", "none"),
    ...((jobsResult.data ?? []) as Array<{ brand_name: string | null; id: string; project_name: string | null; start_at: string }>).map((job) =>
      option(job.project_name || job.brand_name || new Date(job.start_at).toLocaleDateString("pt-BR"), job.id)
    )
  ];

  return (
    <AdminPage>
      <AdminPageHeader
        actions={<Link className="button secondary" href={`/admin/presentations/${id}`}>Voltar</Link>}
        description="Selecione modelos e materiais. Ao publicar, o sistema gera um snapshot sanitizado e imutável."
        eyebrow="Presentation"
        title="Editar apresentação"
      />

      {query.error === "no-models" ? (
        <AdminSection>
          <p className="muted">Selecione pelo menos um modelo antes de publicar.</p>
        </AdminSection>
      ) : null}

      <AdminSection title="Buscar modelos">
        <form className="admin-form-grid" method="get">
          <AdminSearchField defaultValue={query.q} placeholder="Buscar por nome, e-mail, cidade, país..." />
          <button className="button" type="submit">Buscar</button>
          <Link className="button secondary" href={`/admin/presentations/${id}/edit`}>Limpar</Link>
        </form>
      </AdminSection>

      <AdminSection title="Dados e seleção" meta={`${filteredModels.length} modelo(s)`}>
        <form action={saveAction} className="admin-presentation-editor">
          <div className="admin-form-grid">
            <AdminTextField defaultValue={presentation.title} label="Título" name="title" />
            <AdminTextField defaultValue={presentation.purpose ?? ""} label="Finalidade" name="purpose" />
            <AdminSelectField
              defaultValue={presentation.language}
              label="Idioma"
              name="language"
              options={[option("Português", "pt-BR"), option("English", "en")]}
            />
            <AdminSelectField
              defaultValue={presentation.client_id ?? "none"}
              label="Cliente"
              name="client_id"
              options={clientOptions}
            />
            <AdminSelectField
              defaultValue={presentation.agency_id ?? "none"}
              label="Agência"
              name="agency_id"
              options={agencyOptions}
            />
            <AdminSelectField
              defaultValue={presentation.job_id ?? "none"}
              label="Job"
              name="job_id"
              options={jobOptions}
            />
            <AdminTextField
              defaultValue={presentation.expires_at ? presentation.expires_at.slice(0, 16) : ""}
              label="Expira em"
              name="expires_at"
            />
            <label className="admin-field span-2">
              <span>Descrição</span>
              <textarea defaultValue={presentation.description ?? ""} name="description" rows={4} />
            </label>
            <label className="admin-field">
              <span>Downloads</span>
              <span className="admin-inline-check">
                <input defaultChecked={presentation.allow_downloads} name="allow_downloads" type="checkbox" /> Permitir
              </span>
            </label>
          </div>

          <div className="admin-checkbox-grid presentation-model-grid">
            {filteredModels.map((model, index) => {
              const selected = selectedByModel.get(model.id);
              const mediaItems = mediaByModel.get(model.id) ?? [];
              const displayName = model.stage_name || model.display_name;
              return (
                <article className="admin-selection-card" key={model.id}>
                  <label className="admin-inline-check">
                    <input defaultChecked={Boolean(selected)} name="model_id" type="checkbox" value={model.id} />
                    <strong>{displayName}</strong>
                  </label>
                  {mainImageUrls[model.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={displayName} src={mainImageUrls[model.id]} />
                  ) : (
                    <span className="admin-selection-placeholder">{displayName.slice(0, 2).toUpperCase()}</span>
                  )}
                  <input
                    aria-label={`Ordem de ${displayName}`}
                    defaultValue={selected?.position ?? index}
                    name={`position_${model.id}`}
                    type="hidden"
                  />
                  <label className="admin-inline-check">
                    <input
                      defaultChecked={selected?.include_measurements ?? true}
                      name={`include_measurements_${model.id}`}
                      type="checkbox"
                    /> Medidas
                  </label>
                  <label className="admin-inline-check">
                    <input
                      defaultChecked={selected?.include_location ?? true}
                      name={`include_location_${model.id}`}
                      type="checkbox"
                    /> Localização
                  </label>
                  <label className="admin-inline-check">
                    <input
                      defaultChecked={selected?.include_social_links ?? false}
                      name={`include_social_links_${model.id}`}
                      type="checkbox"
                    /> Redes sociais
                  </label>
                  <label className="admin-inline-check">
                    <input
                      defaultChecked={Boolean(selected?.model_snapshot?.highlighted)}
                      name="highlighted_model_id"
                      type="radio"
                      value={model.id}
                    /> Destaque
                  </label>
                  <div className="admin-media-select-list">
                    <span>Materiais</span>
                    {mediaItems.length ? (
                      mediaItems.map((media) => (
                        <label className="admin-inline-check" key={media.id}>
                          <input
                            defaultChecked={selectedMediaIds.has(media.id)}
                            name={`media_${model.id}`}
                            type="checkbox"
                            value={media.id}
                          />
                          <input name={`media_type_${media.id}`} type="hidden" value={media.media_type} />
                          {media.title || media.media_type}
                        </label>
                      ))
                    ) : (
                      <small className="muted">Sem mídia aprovada pública/client-only.</small>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="actions">
            <button className="button" type="submit">Salvar seleção</button>
            <Link className="button secondary" href={`/admin/presentations/${id}/preview`}>Preview</Link>
          </div>
        </form>
      </AdminSection>
    </AdminPage>
  );
}
