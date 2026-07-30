"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle, Settings, X } from "@/components/admin/admin-icons";
import {
  createDefaultPresentationSelection,
  filterPresentationModels,
  nextPresentationPosition,
  presentationModelLocation,
  selectedPresentationModelIds,
  togglePresentationMaterial,
  togglePresentationModel,
  type PresentationSelectionConfig
} from "@/lib/communications/presentation-editor-state";
import styles from "./presentation-editor.module.css";

export type PresentationEditorStep = "info" | "materials" | "models" | "review";

export type PresentationEditorModel = {
  categories: string[];
  city: string | null;
  country: string | null;
  gender: string | null;
  heightCm: number | null;
  id: string;
  imageUrl: string | null;
  name: string;
};

export type PresentationEditorConfig = PresentationSelectionConfig;

type PresentationMaterial = {
  approved: true;
  category: "book" | "digitals" | "downloads" | "video";
  id: string;
  mediaType: string;
  previewUrl: string | null;
  title: string;
};

type PresentationDetails = {
  agencyId: string | null;
  allowDownloads: boolean;
  clientId: string | null;
  description: string | null;
  expiresAt: string | null;
  jobId: string | null;
  language: string;
  purpose: string | null;
  title: string;
};

type PresentationEditorProps = {
  action: (formData: FormData) => void | Promise<void>;
  agencyOptions: Array<{ label: string; value: string }>;
  cancelHref: string;
  clientOptions: Array<{ label: string; value: string }>;
  configs: Record<string, PresentationEditorConfig>;
  details: PresentationDetails;
  initialStep: PresentationEditorStep;
  jobOptions: Array<{ label: string; value: string }>;
  models: PresentationEditorModel[];
  presentationId: string;
  publicToken?: string;
  publishAction: (formData: FormData) => void | Promise<void>;
};

const materialTabs = [
  { id: "book", label: "Book" },
  { id: "digitals", label: "Digitals" },
  { id: "video", label: "Video" },
  { id: "downloads", label: "PDF & Downloads" }
] as const;

function locationOf(model: PresentationEditorModel) {
  return presentationModelLocation(model);
}

export function PresentationEditor({
  action,
  agencyOptions,
  cancelHref,
  clientOptions,
  configs: initialConfigs,
  details,
  initialStep,
  jobOptions,
  models,
  presentationId,
  publicToken,
  publishAction
}: PresentationEditorProps) {
  const [configs, setConfigs] = useState(initialConfigs);
  const [query, setQuery] = useState("");
  const [gender, setGender] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [activeMaterialTab, setActiveMaterialTab] =
    useState<(typeof materialTabs)[number]["id"]>("book");
  const [materials, setMaterials] = useState<Record<string, PresentationMaterial[]>>({});
  const [materialErrors, setMaterialErrors] = useState<Record<string, boolean>>({});
  const [loadingModelId, setLoadingModelId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const selectedIds = useMemo(
    () => selectedPresentationModelIds(models, configs),
    [configs, models]
  );
  const selectedCount = selectedIds.length;

  const genders = useMemo(
    () => Array.from(new Set(models.map((model) => model.gender).filter(Boolean))).sort(),
    [models]
  );
  const categories = useMemo(
    () => Array.from(new Set(models.flatMap((model) => model.categories))).filter(Boolean).sort(),
    [models]
  );
  const locations = useMemo(
    () => Array.from(new Set(models.map(locationOf).filter(Boolean))).sort(),
    [models]
  );
  const visibleModels = useMemo(() => {
    return filterPresentationModels(models, configs, {
      category,
      gender,
      location,
      query,
      selectedOnly
    });
  }, [category, configs, gender, location, models, query, selectedOnly]);

  const activeModel = models.find((model) => model.id === activeModelId) ?? null;
  const activeConfig = activeModelId ? configs[activeModelId] : null;
  const activeMaterials = activeModelId ? materials[activeModelId] ?? [] : [];
  const visibleMaterials = activeMaterials.filter(
    (material) => material.category === activeMaterialTab
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (activeModelId && !dialog.open) dialog.showModal();
    if (!activeModelId && dialog.open) dialog.close();
  }, [activeModelId]);

  useEffect(() => {
    if (!activeModelId || materials[activeModelId]) return;
    const controller = new AbortController();
    setLoadingModelId(activeModelId);
    setMaterialErrors((current) => ({ ...current, [activeModelId]: false }));

    fetch(
      `/api/admin/presentations/${encodeURIComponent(presentationId)}/materials?modelId=${encodeURIComponent(activeModelId)}`,
      { signal: controller.signal }
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("materials-unavailable");
        return (await response.json()) as { materials: PresentationMaterial[] };
      })
      .then((payload) => {
        setMaterials((current) => ({ ...current, [activeModelId]: payload.materials }));
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMaterialErrors((current) => ({ ...current, [activeModelId]: true }));
      })
      .finally(() => setLoadingModelId((current) => (current === activeModelId ? null : current)));

    return () => controller.abort();
  }, [activeModelId, materials, presentationId]);

  function updateConfig(
    modelId: string,
    update: (current: PresentationEditorConfig) => PresentationEditorConfig
  ) {
    setConfigs((current) => ({
      ...current,
      [modelId]: update(
        current[modelId] ??
          createDefaultPresentationSelection(nextPresentationPosition(current))
      )
    }));
  }

  function toggleModel(modelId: string) {
    setConfigs((current) => togglePresentationModel(current, modelId));
  }

  function openConfiguration(modelId: string) {
    if (!configs[modelId]?.selected) {
      toggleModel(modelId);
    }
    setActiveMaterialTab("book");
    setActiveModelId(modelId);
  }

  function updateActiveConfig(update: Partial<PresentationEditorConfig>) {
    if (!activeModelId) return;
    updateConfig(activeModelId, (current) => ({ ...current, ...update }));
  }

  function setHighlighted(value: boolean) {
    if (!activeModelId) return;
    setConfigs((current) =>
      Object.fromEntries(
        Object.entries(current).map(([modelId, config]) => [
          modelId,
          { ...config, highlighted: modelId === activeModelId ? value : false }
        ])
      )
    );
  }

  function toggleMaterial(material: PresentationMaterial) {
    if (!activeConfig || !activeModelId) return;
    updateConfig(activeModelId, (current) =>
      togglePresentationMaterial(current, material.id, material.mediaType)
    );
  }

  function setCategoryMaterials(select: boolean) {
    if (!activeConfig) return;
    const nextMedia = { ...activeConfig.media };
    for (const material of visibleMaterials) {
      if (select) nextMedia[material.id] = material.mediaType;
      else delete nextMedia[material.id];
    }
    updateActiveConfig({ media: nextMedia });
  }

  function moveModel(modelId: string, direction: -1 | 1) {
    const index = selectedIds.indexOf(modelId);
    const swapId = selectedIds[index + direction];
    if (!swapId) return;
    setConfigs((current) => ({
      ...current,
      [modelId]: { ...current[modelId], position: current[swapId].position },
      [swapId]: { ...current[swapId], position: current[modelId].position }
    }));
  }

  function clearFilters() {
    setQuery("");
    setGender("");
    setCategory("");
    setLocation("");
    setSelectedOnly(false);
  }

  return (
    <form action={action} className={styles.root}>
      {initialStep !== "info" ? (
        <>
          <input name="title" type="hidden" value={details.title} />
          <input name="purpose" type="hidden" value={details.purpose ?? ""} />
          <input name="language" type="hidden" value={details.language} />
          <input name="client_id" type="hidden" value={details.clientId ?? "none"} />
          <input name="agency_id" type="hidden" value={details.agencyId ?? "none"} />
          <input name="job_id" type="hidden" value={details.jobId ?? "none"} />
          <input name="expires_at" type="hidden" value={details.expiresAt ?? ""} />
          <input name="description" type="hidden" value={details.description ?? ""} />
          {details.allowDownloads ? <input name="allow_downloads" type="hidden" value="on" /> : null}
        </>
      ) : null}
      {publicToken ? <input name="public_token" type="hidden" value={publicToken} /> : null}

      {selectedIds.map((modelId, index) => {
        const config = configs[modelId];
        return (
          <div hidden key={modelId}>
            <input name="model_id" readOnly value={modelId} />
            <input name={`position_${modelId}`} readOnly value={index} />
            {config.includeMeasurements ? (
              <input name={`include_measurements_${modelId}`} readOnly value="on" />
            ) : null}
            {config.includeLocation ? (
              <input name={`include_location_${modelId}`} readOnly value="on" />
            ) : null}
            {config.includeSocialLinks ? (
              <input name={`include_social_links_${modelId}`} readOnly value="on" />
            ) : null}
            {config.highlighted ? (
              <input name="highlighted_model_id" readOnly value={modelId} />
            ) : null}
            {Object.entries(config.media).map(([mediaId, mediaType]) => (
              <span key={mediaId}>
                <input name={`media_${modelId}`} readOnly value={mediaId} />
                <input name={`media_type_${mediaId}`} readOnly value={mediaType} />
              </span>
            ))}
          </div>
        );
      })}

      <nav aria-label="Etapas da apresentação" className={styles.stepper}>
        <button className={initialStep === "info" ? styles.active : styles.done} name="next_step" type="submit" value="info">
          <b>1</b> Informações
        </button>
        <button className={initialStep === "models" ? styles.active : styles.done} name="next_step" type="submit" value="models">
          <b>2</b> Selecionar modelos
        </button>
        <button className={initialStep === "materials" ? styles.active : ""} disabled={!selectedCount} name="next_step" type="submit" value="materials">
          <b>3</b> Organizar materiais
        </button>
        <button className={initialStep === "review" ? styles.active : ""} disabled={!selectedCount} name="next_step" type="submit" value="review">
          <b>4</b> Revisar e publicar
        </button>
      </nav>

      {initialStep === "info" ? (
        <section className={styles.infoGrid}>
          <label>
            <span>Título</span>
            <input defaultValue={details.title} name="title" required />
          </label>
          <label>
            <span>Finalidade</span>
            <input defaultValue={details.purpose ?? ""} name="purpose" />
          </label>
          <label>
            <span>Idioma</span>
            <select defaultValue={details.language} name="language">
              <option value="pt-BR">Português</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            <span>Cliente</span>
            <select defaultValue={details.clientId ?? "none"} name="client_id">
              {clientOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>
            <span>Agência</span>
            <select defaultValue={details.agencyId ?? "none"} name="agency_id">
              {agencyOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>
            <span>Job</span>
            <select defaultValue={details.jobId ?? "none"} name="job_id">
              {jobOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>
            <span>Validade</span>
            <input
              defaultValue={details.expiresAt ? details.expiresAt.slice(0, 16) : ""}
              name="expires_at"
              type="datetime-local"
            />
          </label>
          <label className={styles.descriptionField}>
            <span>Descrição</span>
            <textarea defaultValue={details.description ?? ""} name="description" rows={5} />
          </label>
          <label className={styles.downloadField}>
            <input defaultChecked={details.allowDownloads} name="allow_downloads" type="checkbox" />
            Permitir downloads autorizados
          </label>
        </section>
      ) : null}

      {initialStep === "models" ? (
        <>
          <section className={styles.toolbar} aria-label="Filtros de modelos">
            <label className={styles.search}>
              <span>Busca</span>
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nome, cidade ou categoria"
                type="search"
                value={query}
              />
            </label>
            <label>
              <span>Gênero</span>
              <select onChange={(event) => setGender(event.target.value)} value={gender}>
                <option value="">Todos</option>
                {genders.map((item) => <option key={item} value={item ?? ""}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>Categoria</span>
              <select onChange={(event) => setCategory(event.target.value)} value={category}>
                <option value="">Todas</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>Localização</span>
              <select onChange={(event) => setLocation(event.target.value)} value={location}>
                <option value="">Todas</option>
                {locations.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className={styles.selectedFilter}>
              <input
                checked={selectedOnly}
                onChange={(event) => setSelectedOnly(event.target.checked)}
                type="checkbox"
              />
              Somente selecionados
            </label>
            <button className="button secondary" onClick={clearFilters} type="button">Limpar filtros</button>
          </section>

          <div className={styles.gallery}>
            {visibleModels.map((model) => {
              const selected = Boolean(configs[model.id]?.selected);
              return (
                <article className={`${styles.card} ${selected ? styles.cardSelected : ""}`} key={model.id}>
                  <button
                    aria-checked={selected}
                    aria-label={`${selected ? "Remover" : "Selecionar"} ${model.name}`}
                    className={styles.photoButton}
                    onClick={() => toggleModel(model.id)}
                    role="checkbox"
                    type="button"
                  >
                    {model.imageUrl ? (
                      <img alt={model.name} loading="lazy" src={model.imageUrl} />
                    ) : (
                      <span className={styles.placeholder}>{model.name.slice(0, 2).toUpperCase()}</span>
                    )}
                    <span aria-hidden="true" className={styles.selectionCircle}>
                      {selected ? <CheckCircle /> : null}
                    </span>
                    {selected ? <span className={styles.selectedOverlay} /> : null}
                  </button>
                  <div className={styles.cardCopy}>
                    <span>
                      <strong>{model.name}</strong>
                      <small>
                        {model.heightCm ? `${model.heightCm} cm` : "Altura —"}
                        {locationOf(model) ? ` · ${locationOf(model)}` : ""}
                      </small>
                    </span>
                    {selected ? (
                      <button
                        aria-label={`Configurar apresentação de ${model.name}`}
                        className={styles.settingsButton}
                        onClick={() => openConfiguration(model.id)}
                        type="button"
                      >
                        <Settings />
                      </button>
                    ) : null}
                  </div>
                  {selected ? <span className={styles.selectedLabel}>Selecionado</span> : null}
                </article>
              );
            })}
          </div>
          {!visibleModels.length ? (
            <p className={styles.empty}>Nenhum modelo corresponde aos filtros atuais.</p>
          ) : null}
        </>
      ) : null}

      {initialStep === "materials" ? (
        <section className={styles.selectedList}>
          <header>
            <div>
              <span className="eyebrow">Etapa 3</span>
              <h2>Organizar materiais</h2>
            </div>
            <span>{selectedCount} modelo(s)</span>
          </header>
          {selectedIds.map((modelId, index) => {
            const model = models.find((item) => item.id === modelId);
            const config = configs[modelId];
            if (!model) return null;
            return (
              <article key={modelId}>
                {model.imageUrl ? <img alt="" src={model.imageUrl} /> : <span>{model.name.slice(0, 2)}</span>}
                <div>
                  <strong>{model.name}</strong>
                  <small>{Object.keys(config.media).length} material(is) selecionado(s)</small>
                </div>
                <div className={styles.orderActions}>
                  <button
                    aria-label={`Mover ${model.name} para cima`}
                    disabled={index === 0}
                    onClick={() => moveModel(modelId, -1)}
                    type="button"
                  >↑</button>
                  <button
                    aria-label={`Mover ${model.name} para baixo`}
                    disabled={index === selectedIds.length - 1}
                    onClick={() => moveModel(modelId, 1)}
                    type="button"
                  >↓</button>
                  <button className="button secondary" onClick={() => openConfiguration(modelId)} type="button">
                    Configurar
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      {initialStep === "review" ? (
        <section className={styles.review}>
          <div>
            <span className="eyebrow">Etapa 4</span>
            <h2>Revisar e publicar</h2>
            <p>Confira o conteúdo antes de criar um snapshot público imutável.</p>
          </div>
          <dl>
            <div><dt>Título</dt><dd>{details.title}</dd></div>
            <div><dt>Idioma</dt><dd>{details.language}</dd></div>
            <div><dt>Modelos</dt><dd>{selectedCount}</dd></div>
            <div>
              <dt>Materiais</dt>
              <dd>{selectedIds.reduce((total, id) => total + Object.keys(configs[id].media).length, 0)}</dd>
            </div>
            <div><dt>Downloads</dt><dd>{details.allowDownloads ? "Permitidos" : "Bloqueados"}</dd></div>
          </dl>
          <div className={styles.reviewModels}>
            {selectedIds.map((modelId) => {
              const model = models.find((item) => item.id === modelId);
              if (!model) return null;
              return (
                <span key={modelId}>
                  {model.imageUrl ? <img alt="" src={model.imageUrl} /> : null}
                  {model.name}
                </span>
              );
            })}
          </div>
        </section>
      ) : null}

      <footer className={styles.actionBar}>
        <strong>{selectedCount} modelos selecionados</strong>
        <div>
          <Link className="button secondary" href={cancelHref}>Cancelar</Link>
          <button className="button secondary" name="next_step" type="submit" value={initialStep}>
            Salvar rascunho
          </button>
          {initialStep === "info" ? (
            <button className="button" name="next_step" type="submit" value="models">
              Continuar
            </button>
          ) : null}
          {initialStep === "models" ? (
            <button className="button" disabled={!selectedCount} name="next_step" type="submit" value="materials">
              Continuar
            </button>
          ) : null}
          {initialStep === "materials" ? (
            <button className="button" disabled={!selectedCount} name="next_step" type="submit" value="review">
              Continuar
            </button>
          ) : null}
          {initialStep === "review" ? (
            <>
              <Link className="button secondary" href={`/admin/presentations/${presentationId}/preview`}>Preview</Link>
              <button
                className="button"
                disabled={!selectedCount}
                formAction={publishAction}
                type="submit"
              >
                Publicar
              </button>
            </>
          ) : null}
        </div>
      </footer>

      <dialog
        aria-labelledby="presentation-config-title"
        className={styles.dialog}
        onClose={() => setActiveModelId(null)}
        ref={dialogRef}
      >
        {activeModel && activeConfig ? (
          <>
            <header>
              <div>
                <span className="eyebrow">Modelo selecionado</span>
                <h2 id="presentation-config-title">Configurar apresentação</h2>
                <p>{activeModel.name}</p>
              </div>
              <button
                aria-label="Fechar configuração"
                className={styles.closeButton}
                onClick={() => dialogRef.current?.close()}
                type="button"
              >
                <X />
              </button>
            </header>

            <fieldset className={styles.options}>
              <legend>Informações incluídas</legend>
              <label>
                <input
                  checked={activeConfig.includeMeasurements}
                  onChange={(event) => updateActiveConfig({ includeMeasurements: event.target.checked })}
                  type="checkbox"
                />
                Medidas
              </label>
              <label>
                <input
                  checked={activeConfig.includeLocation}
                  onChange={(event) => updateActiveConfig({ includeLocation: event.target.checked })}
                  type="checkbox"
                />
                Localização
              </label>
              <label>
                <input
                  checked={activeConfig.includeSocialLinks}
                  onChange={(event) => updateActiveConfig({ includeSocialLinks: event.target.checked })}
                  type="checkbox"
                />
                Redes sociais
              </label>
              <label>
                <input
                  checked={activeConfig.highlighted}
                  onChange={(event) => setHighlighted(event.target.checked)}
                  type="checkbox"
                />
                Modelo em destaque
              </label>
            </fieldset>

            <nav aria-label="Categorias de materiais" className={styles.materialTabs}>
              {materialTabs.map((tab) => (
                <button
                  aria-pressed={activeMaterialTab === tab.id}
                  className={activeMaterialTab === tab.id ? styles.materialTabActive : ""}
                  key={tab.id}
                  onClick={() => setActiveMaterialTab(tab.id)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className={styles.materialActions}>
              <button disabled={!visibleMaterials.length} onClick={() => setCategoryMaterials(true)} type="button">
                Selecionar todas desta categoria
              </button>
              <button disabled={!visibleMaterials.length} onClick={() => setCategoryMaterials(false)} type="button">
                Limpar categoria
              </button>
            </div>

            {loadingModelId === activeModelId ? <p className={styles.loading}>Carregando materiais…</p> : null}
            {materialErrors[activeModel.id] ? (
              <p className={styles.empty}>Não foi possível carregar os materiais agora.</p>
            ) : null}
            {!loadingModelId && !materialErrors[activeModel.id] ? (
              <div className={styles.materialGrid}>
                {visibleMaterials.map((material) => {
                  const selected = Boolean(activeConfig.media[material.id]);
                  return (
                    <button
                      aria-checked={selected}
                      className={selected ? styles.materialSelected : ""}
                      key={material.id}
                      onClick={() => toggleMaterial(material)}
                      role="checkbox"
                      type="button"
                    >
                      {material.previewUrl ? (
                        <img alt="" loading="lazy" src={material.previewUrl} />
                      ) : (
                        <span className={styles.materialPlaceholder}>{material.mediaType.toUpperCase()}</span>
                      )}
                      <span><strong>{material.title}</strong><small>{material.mediaType} · aprovado</small></span>
                      <i>{selected ? <CheckCircle /> : null}</i>
                    </button>
                  );
                })}
                {!visibleMaterials.length ? (
                  <p className={styles.empty}>Nenhum material aprovado nesta categoria.</p>
                ) : null}
              </div>
            ) : null}
            <footer>
              <span>{Object.keys(activeConfig.media).length} material(is) selecionado(s)</span>
              <button className="button" onClick={() => dialogRef.current?.close()} type="button">Concluir</button>
            </footer>
          </>
        ) : null}
      </dialog>
    </form>
  );
}
