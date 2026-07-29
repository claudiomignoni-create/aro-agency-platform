import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  groupPresentationMedia,
  normalizeInstagramUrl,
  presentationSelectionCounts,
  withPresentationDecision
} from "../src/lib/communications/public-presentation";

async function file(path: string) {
  return readFile(path, "utf8");
}

test("presentation decisions persist by stable snapshot key and update cleanly", () => {
  const initial = {};
  const yes = withPresentationDecision(initial, "model-key-a", "yes");
  const changed = withPresentationDecision(yes, "model-key-a", "maybe");
  const complete = withPresentationDecision(changed, "model-key-b", "no");

  assert.deepEqual(initial, {});
  assert.deepEqual(changed, { "model-key-a": "maybe" });
  assert.deepEqual(complete, {
    "model-key-a": "maybe",
    "model-key-b": "no"
  });
});

test("selection counters cover yes, maybe, no and undecided models", () => {
  const counts = presentationSelectionCounts(
    {
      a: "yes",
      b: "maybe",
      c: "no"
    },
    ["a", "b", "c", "d", null]
  );

  assert.deepEqual(counts, { maybe: 1, no: 1, undecided: 2, yes: 1 });
});

test("Book, Digitals, Video and Downloads stay in separate media groups", () => {
  const media = [
    { id: "book", media_type: "portfolio" },
    { id: "digital", media_type: "polaroid" },
    { id: "video", media_type: "video" },
    { id: "document", media_type: "document" }
  ];
  const groups = groupPresentationMedia(media);

  assert.deepEqual(groups.book.map((item) => item.id), ["book"]);
  assert.deepEqual(groups.digitals.map((item) => item.id), ["digital"]);
  assert.deepEqual(groups.videos.map((item) => item.id), ["video"]);
  assert.deepEqual(groups.documents.map((item) => item.id), ["document"]);
});

test("Instagram links accept only a handle or an Instagram HTTPS URL", () => {
  assert.equal(normalizeInstagramUrl("@aro.model"), "https://www.instagram.com/aro.model");
  assert.equal(
    normalizeInstagramUrl("https://instagram.com/aro.model/"),
    "https://instagram.com/aro.model/"
  );
  assert.equal(normalizeInstagramUrl("javascript:alert(1)"), null);
  assert.equal(normalizeInstagramUrl("https://example.com/aro"), null);
});

test("selection migration is additive, RLS protected and service-role only", async () => {
  const sql = await file("supabase/migrations/026_presentation_model_selections.sql");

  assert.match(sql, /create table if not exists public\.presentation_selection_responses/);
  assert.match(sql, /create table if not exists public\.presentation_model_selections/);
  assert.match(sql, /unique \(response_id, public_model_key\)/);
  assert.match(sql, /decision in \('yes', 'maybe', 'no'\)/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /set search_path = public/);
  assert.match(sql, /model_not_in_presentation_snapshot/);
  assert.match(sql, /on conflict \(response_id, public_model_key\)/);
  assert.match(
    sql,
    /if response_record\.submitted_at is not null\s+and coalesce\(response_record\.client_note/
  );
  assert.match(sql, /grant execute on function public\.save_public_presentation_model_decision\(text, text, text\) to service_role/);
  assert.doesNotMatch(sql, /grant execute on function public\.save_public_presentation_model_decision\([^)]*\) to anon/);
  assert.doesNotMatch(sql, /\bdrop table\b/i);
  assert.doesNotMatch(sql, /\bdrop type\b/i);
  assert.doesNotMatch(sql, /\btruncate\b/i);
});

test("every public mutation revalidates the hashed link and never grants table access to anon", async () => {
  const sql = await file("supabase/migrations/026_presentation_model_selections.sql");
  const selectionRoute = await file("src/app/p/[token]/selection/route.ts");
  const downloadRoute = await file("src/app/p/[token]/download/[mediaKey]/route.ts");

  assert.match(sql, /resolve_public_presentation_token\(p_token_hash\)/g);
  assert.match(sql, /sl\.revoked_at is null/);
  assert.match(sql, /sl\.expires_at is null or sl\.expires_at > now\(\)/);
  assert.match(sql, /p\.status in \('published', 'sent'\)/);
  assert.match(sql, /revoke all on table public\.presentation_selection_responses from anon, authenticated/);
  assert.match(selectionRoute, /sha256\(token\)/);
  assert.match(downloadRoute, /createSignedUrl\(mediaRef\.storage_path, 60\)/);
  assert.doesNotMatch(selectionRoute, /console\.(log|error)\([^)]*token/);
  assert.doesNotMatch(downloadRoute, /storage_path.*NextResponse\.json/);
});

test("public payload contains commercial snapshot fields but no private model data", async () => {
  const sql = await file("supabase/migrations/026_presentation_model_selections.sql");
  const publicFunction = sql.slice(
    sql.indexOf("create or replace function public.get_public_presentation_by_token"),
    sql.indexOf("create or replace function public.get_public_presentation_link_state")
  );

  for (const safeField of ["hair_color", "eye_color", "nationality", "instagram", "categories"]) {
    assert.match(publicFunction, new RegExp(`'${safeField}'`));
  }
  for (const privateField of [
    "cpf",
    "passport",
    "address",
    "phone",
    "whatsapp",
    "banking",
    "recipient_email",
    "storage_path",
    "storage_bucket"
  ]) {
    assert.doesNotMatch(publicFunction, new RegExp(privateField, "i"));
  }
});

test("public UI provides editorial sections, accessible decisions and real empty states", async () => {
  const modelContent = await file("src/components/public-presentation/public-model-content.tsx");
  const decisionControl = await file("src/components/public-presentation/model-decision-control.tsx");
  const sidebar = await file("src/components/public-presentation/presentation-sidebar.tsx");
  const dialog = await file("src/components/public-presentation/submit-selection-dialog.tsx");
  const css = await file("src/app/p/[token]/public-presentation.css");

  for (const label of ["Overview", "Book", "Digitals", "Video", "PDF & Downloads"]) {
    assert.match(modelContent, new RegExp(label.replace("&", "\\&")));
  }
  assert.match(modelContent, /aria-current/);
  assert.match(decisionControl, /aria-pressed/);
  assert.match(modelContent, /preload="metadata"/);
  assert.match(modelContent, /No Book images were included/);
  assert.match(modelContent, /No Digitals were included/);
  assert.match(modelContent, /No videos were included/);
  assert.match(sidebar, /Send my selection/);
  assert.match(sidebar, /Add a note for ARO/);
  assert.match(dialog, /showModal\(\)/);
  assert.match(dialog, /onCancel/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /\.aro-public-mobile-decision\s*\{[\s\S]*position: fixed/);
  assert.match(css, /overflow-x: auto/);
});

test("public experience does not add tracking pixels or expose administrative fields", async () => {
  const source = (
    await Promise.all([
      file("src/app/p/[token]/page.tsx"),
      file("src/components/public-presentation/public-presentation-experience.tsx"),
      file("src/components/public-presentation/public-model-content.tsx"),
      file("src/components/public-presentation/presentation-sidebar.tsx")
    ])
  ).join("\n");

  for (const forbidden of [
    "tracking_pixel",
    "dangerouslySetInnerHTML",
    "passport_number",
    "banking_info_private",
    "address_line",
    "recipient_email",
    "cpf"
  ]) {
    assert.doesNotMatch(source, new RegExp(forbidden, "i"));
  }
});
