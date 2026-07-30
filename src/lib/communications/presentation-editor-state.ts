export type PresentationSelectionModel = {
  categories: string[];
  city: string | null;
  country: string | null;
  gender: string | null;
  id: string;
  name: string;
};

export type PresentationSelectionConfig = {
  highlighted: boolean;
  includeLocation: boolean;
  includeMeasurements: boolean;
  includeSocialLinks: boolean;
  media: Record<string, string>;
  position: number;
  selected: boolean;
};

export type PresentationSelectionFilters = {
  category: string;
  gender: string;
  location: string;
  query: string;
  selectedOnly: boolean;
};

export function presentationModelLocation(model: PresentationSelectionModel) {
  return [model.city, model.country].filter(Boolean).join(", ");
}

export function createDefaultPresentationSelection(
  position: number
): PresentationSelectionConfig {
  return {
    highlighted: false,
    includeLocation: true,
    includeMeasurements: true,
    includeSocialLinks: false,
    media: {},
    position,
    selected: false
  };
}

export function nextPresentationPosition(
  configs: Record<string, PresentationSelectionConfig>
) {
  return Math.max(-1, ...Object.values(configs).map((config) => config.position)) + 1;
}

export function togglePresentationModel(
  configs: Record<string, PresentationSelectionConfig>,
  modelId: string
) {
  const current =
    configs[modelId] ??
    createDefaultPresentationSelection(nextPresentationPosition(configs));
  return {
    ...configs,
    [modelId]: {
      ...current,
      position: current.selected ? current.position : nextPresentationPosition(configs),
      selected: !current.selected
    }
  };
}

export function selectedPresentationModelIds<T extends PresentationSelectionModel>(
  models: T[],
  configs: Record<string, PresentationSelectionConfig>
) {
  return models
    .filter((model) => configs[model.id]?.selected)
    .sort(
      (first, second) =>
        (configs[first.id]?.position ?? 0) - (configs[second.id]?.position ?? 0)
    )
    .map((model) => model.id);
}

export function filterPresentationModels<T extends PresentationSelectionModel>(
  models: T[],
  configs: Record<string, PresentationSelectionConfig>,
  filters: PresentationSelectionFilters
): T[] {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase("pt-BR");
  return models.filter((model) => {
    if (filters.selectedOnly && !configs[model.id]?.selected) return false;
    if (filters.gender && model.gender !== filters.gender) return false;
    if (filters.category && !model.categories.includes(filters.category)) return false;
    if (filters.location && presentationModelLocation(model) !== filters.location) return false;
    if (
      normalizedQuery &&
      ![model.name, presentationModelLocation(model), ...model.categories]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedQuery)
    ) {
      return false;
    }
    return true;
  });
}

export function togglePresentationMaterial(
  config: PresentationSelectionConfig,
  mediaId: string,
  mediaType: string
) {
  const media = { ...config.media };
  if (media[mediaId]) delete media[mediaId];
  else media[mediaId] = mediaType;
  return { ...config, media };
}
