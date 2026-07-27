import assert from "node:assert/strict";
import test from "node:test";
import {
  canDeleteSimpleJob,
  isUntitledJob,
  smartJobTitle
} from "../src/lib/jobs";

test("smart job title uses type, model and date for untitled jobs", () => {
  const title = smartJobTitle({
    brand_name: null,
    job_models: [
      {
        model: {
          bust_cm: null,
          categories: [],
          current_city: "São Paulo",
          current_country: "Brasil",
          display_name: "Bella Campelo",
          height_cm: null,
          hips_cm: null,
          id: "model-1",
          main_image_path: null,
          stage_name: null,
          waist_cm: null
        }
      }
    ],
    project_name: null,
    start_at: "2026-06-13T09:00:00-03:00",
    type: "job"
  });

  assert.equal(isUntitledJob({ brand_name: null, project_name: null }), true);
  assert.match(title, /Trabalho · Bella Campelo · 13/);
});

test("safe job delete allows simple draft without finance", () => {
  assert.deepEqual(
    canDeleteSimpleJob({
      financialEntryCount: 0,
      hasReceipts: false,
      status: "draft"
    }),
    { canDelete: true, reason: null }
  );
});

test("safe job delete blocks receipts and financial entries", () => {
  assert.equal(
    canDeleteSimpleJob({
      financialEntryCount: 0,
      hasReceipts: true,
      status: "draft"
    }).canDelete,
    false
  );

  assert.equal(
    canDeleteSimpleJob({
      financialEntryCount: 1,
      hasReceipts: false,
      status: "draft"
    }).canDelete,
    false
  );
});

test("safe job delete blocks operationally confirmed jobs", () => {
  const result = canDeleteSimpleJob({
    financialEntryCount: 0,
    hasReceipts: false,
    status: "confirmed"
  });

  assert.equal(result.canDelete, false);
  assert.match(result.reason ?? "", /rascunhos|recusados|cancelados/i);
});

