import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createDefaultPresentationSelection,
  filterPresentationModels,
  selectedPresentationModelIds,
  togglePresentationMaterial,
  togglePresentationModel,
  type PresentationSelectionConfig,
  type PresentationSelectionModel
} from "../src/lib/communications/presentation-editor-state";
import { buildPresentationOperationalSummaries } from "../src/lib/communications/presentation-operational-summary";

async function file(path: string) {
  return readFile(path, "utf8");
}

const presentations = [
  {
    created_at: "2026-07-28T12:00:00Z",
    description: null,
    id: "presentation-1",
    language: "pt-BR",
    status: "draft",
    title: "Seleção ARO"
  }
];

test("presentation list keeps its primary rows when every optional metric is available", () => {
  const result = buildPresentationOperationalSummaries(
    presentations,
    {
      deliveries: [
        { created_at: "2026-07-29T10:00:00Z", presentation_id: "presentation-1" }
      ],
      models: [
        { presentation_id: "presentation-1" },
        { presentation_id: "presentation-1" }
      ],
      recipients: [{ presentation_id: "presentation-1" }],
      selections: [{ presentation_id: "presentation-1" }]
    },
    []
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].model_count, 2);
  assert.equal(result[0].recipient_count, 1);
  assert.equal(result[0].selection_count, 1);
  assert.equal(result[0].last_delivery_at, "2026-07-29T10:00:00Z");
});

test("each unavailable presentation metric becomes null without removing the list", () => {
  for (const metric of ["deliveries", "models", "recipients", "selections"] as const) {
    const result = buildPresentationOperationalSummaries(
      presentations,
      {
        deliveries: [],
        models: [],
        recipients: [],
        selections: []
      },
      [metric]
    );

    assert.equal(result.length, 1, metric);
    assert.equal(result[0].title, "Seleção ARO", metric);
    if (metric === "deliveries") assert.equal(result[0].last_delivery_at, null);
    if (metric === "models") assert.equal(result[0].model_count, null);
    if (metric === "recipients") assert.equal(result[0].recipient_count, null);
    if (metric === "selections") assert.equal(result[0].selection_count, null);
  }
});

test("presentation selection defaults match the operational brief", () => {
  const config = createDefaultPresentationSelection(0);

  assert.equal(config.includeMeasurements, true);
  assert.equal(config.includeLocation, true);
  assert.equal(config.includeSocialLinks, false);
  assert.equal(config.highlighted, false);
  assert.equal(config.selected, false);
});

test("clicking a model state selects it and clicking again removes it", () => {
  const selected = togglePresentationModel({}, "model-1");
  const removed = togglePresentationModel(selected, "model-1");

  assert.equal(selected["model-1"].selected, true);
  assert.equal(removed["model-1"].selected, false);
});

test("search and filters preserve selection state and selected count", () => {
  const models: PresentationSelectionModel[] = [
    {
      categories: ["Mainboard"],
      city: "São Paulo",
      country: "Brasil",
      gender: "female",
      id: "model-1",
      name: "Modelo Um"
    },
    {
      categories: ["New Face"],
      city: "Rio de Janeiro",
      country: "Brasil",
      gender: "male",
      id: "model-2",
      name: "Modelo Dois"
    }
  ];
  const configs: Record<string, PresentationSelectionConfig> = togglePresentationModel(
    {
      "model-1": createDefaultPresentationSelection(0),
      "model-2": createDefaultPresentationSelection(1)
    },
    "model-1"
  );
  const filtered = filterPresentationModels(models, configs, {
    category: "New Face",
    gender: "",
    location: "",
    query: "dois",
    selectedOnly: false
  });

  assert.deepEqual(filtered.map((model) => model.id), ["model-2"]);
  assert.deepEqual(selectedPresentationModelIds(models, configs), ["model-1"]);
});

test("material selection toggles without changing model options", () => {
  const config = createDefaultPresentationSelection(0);
  const selected = togglePresentationMaterial(config, "media-1", "portfolio");
  const removed = togglePresentationMaterial(selected, "media-1", "portfolio");

  assert.equal(selected.media["media-1"], "portfolio");
  assert.deepEqual(removed.media, {});
  assert.equal(selected.includeMeasurements, true);
});

test("presentation list isolates optional queries and renders contextual failures", async () => {
  const [data, page] = await Promise.all([
    file("src/lib/communications/data.ts"),
    file("src/app/admin/presentations/page.tsx")
  ]);

  assert.match(data, /Promise\.allSettled/);
  assert.match(data, /PRES-METRIC-/);
  assert.match(data, /PRES-LIST-001/);
  assert.match(page, /Algumas métricas estão temporariamente indisponíveis/);
  assert.match(page, /Não foi possível carregar as apresentações/);
  assert.match(page, /Tentar novamente/);
  assert.match(page, /model_count \?\? "—"/);
});

test("presentation gallery uses photo check controls and an accessible native dialog", async () => {
  const editor = await file("src/components/admin/presentation-editor.tsx");

  assert.match(editor, /className=\{styles\.photoButton\}/);
  assert.match(editor, /role="checkbox"/);
  assert.match(editor, /aria-checked=\{selected\}/);
  assert.match(editor, /<dialog/);
  assert.match(editor, /showModal\(\)/);
  assert.match(editor, /onClose=\{\(\) => setActiveModelId\(null\)\}/);
  assert.match(editor, /disabled=\{!selectedCount\}/);
  assert.match(editor, /Configurar apresentação/);
});

test("presentation materials are loaded on demand and private media never reaches the response", async () => {
  const [editor, route] = await Promise.all([
    file("src/components/admin/presentation-editor.tsx"),
    file("src/app/api/admin/presentations/[id]/materials/route.ts")
  ]);

  assert.match(editor, /fetch\(\s*`\/api\/admin\/presentations/);
  assert.match(route, /\.eq\("status", "approved"\)/);
  assert.match(route, /\.neq\("visibility", "private"\)/);
  assert.match(route, /Cache-Control": "private, no-store"/);
  assert.equal(route.includes("return {\n        storagePath"), false);
  assert.doesNotMatch(route, /storage_path:/);
});

test("presentation editor defines responsive two-column mobile gallery without horizontal overflow", async () => {
  const css = await file("src/components/admin/presentation-editor.module.css");

  assert.match(css, /grid-template-columns:\s*repeat\(5,/);
  assert.match(css, /@media \(max-width: 1220px\)/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(2,/);
  assert.equal(css.includes(".gallery {\n  overflow-x: auto"), false);
});

test("selection migrations explain the optional metric permission fallback", async () => {
  const migration = await file("supabase/migrations/026_presentation_model_selections.sql");

  assert.match(migration, /enable row level security/);
  assert.match(migration, /admins manage presentation model selections/);
  assert.match(
    migration,
    /revoke all on table public\.presentation_model_selections from anon, authenticated/
  );
});
