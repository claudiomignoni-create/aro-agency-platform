import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { imageSize } from "image-size";
import * as XLSX from "xlsx";

// The importer reads dynamic Supabase rows and Wix payloads whose shapes are validated at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientLike = any;

type Args = {
  spreadsheet: string;
  site: string;
  apply: boolean;
};

type MeasureSet = {
  height_cm?: number | null;
  bust_cm?: number | null;
  waist_cm?: number | null;
  hips_cm?: number | null;
  shoe_size_br?: string | null;
  dress_size_br?: string | null;
  clothing_size?: string | null;
  hair_color?: string | null;
  eye_color?: string | null;
};

type ImportProfile = {
  key: string;
  source: "spreadsheet" | "site" | "combined";
  displayName: string;
  stageName: string;
  legalName?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  wechat?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  xiaohongshu?: string | null;
  portfolioUrl?: string | null;
  nationality?: string | null;
  location?: string | null;
  currentCity?: string | null;
  currentCountry?: string | null;
  baseCity?: string | null;
  baseCountry?: string | null;
  birthDate?: string | null;
  address?: string | null;
  state?: string | null;
  country?: string | null;
  modelType?: string | null;
  cpf?: string | null;
  rg?: string | null;
  passport?: string | null;
  visas?: {
    us?: string | null;
    eu?: string | null;
    china?: string | null;
    other?: string | null;
  };
  parents?: {
    mother?: string | null;
    father?: string | null;
  };
  emergency?: {
    name?: string | null;
    phone?: string | null;
    relationship?: string | null;
  };
  health?: {
    foodRestrictions?: string | null;
    allergies?: string | null;
    medicalHistory?: string | null;
  };
  banking?: string | null;
  activeAgencies?: string[];
  inactiveAgencies?: string[];
  importantJobs?: string | null;
  measures: MeasureSet;
  board: "Desenvolvimento" | "New Face" | "Mainboard" | "Image";
  images: SiteImage[];
  sitePath?: string;
  importedFromSpreadsheet: boolean;
  importedFromSite: boolean;
};

type SiteImage = {
  url: string;
  sourceUrl: string;
  title: string;
  order: number;
  role: "cover" | "gallery";
};

type ExistingModel = AnyRecord & {
  id: string;
  display_name: string;
  stage_name: string | null;
  legal_name: string | null;
  categories: string[] | null;
};

type ImportStats = {
  apply: boolean;
  createdModels: number;
  updatedModels: number;
  spreadsheetProfiles: number;
  siteProfiles: number;
  createdMedia: number;
  reusedMedia: number;
  failedImages: Array<{ model: string; source: string; reason: string }>;
  skippedSiteProfiles: Array<{ title: string; reason: string }>;
  warnings: string[];
};

const MODEL_BUCKET = "model-portfolio";
const PROJECT_REF = "vsevxuxinfqpwtpykhon";
const REPORT_ROOT = path.join(homedir(), "Documents", "AROLAB-import-reports");
const BACKUP_ROOT = path.join(homedir(), "Documents", "AROLAB-import-backups");

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const valueAfter = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const spreadsheet = valueAfter("--spreadsheet");
  const site = valueAfter("--site");

  if (!spreadsheet || !site) {
    throw new Error("Usage: npm run import:arolab-models -- --spreadsheet <xlsx> --site <url> [--apply]");
  }

  return {
    spreadsheet,
    site,
    apply: args.includes("--apply")
  };
}

function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || /^não$/i.test(text) || /^nao$/i.test(text) || /^n\/a$/i.test(text)) return null;
  return text;
}

function normalize(value: unknown): string {
  return cleanText(value)
    ?.normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim() ?? "";
}

function canonicalKey(...values: Array<unknown>): string {
  for (const value of values) {
    const normalized = normalize(value);
    if (!normalized) continue;
    return normalized;
  }
  return randomUUID();
}

function properName(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      if (["da", "de", "do", "dos", "das"].includes(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function firstDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = cleanText(value);
  if (!text) return null;
  const match = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (!match) return null;
  const [, dayRaw, monthRaw, yearRaw] = match;
  const day = String(dayRaw).padStart(2, "0");
  const month = String(monthRaw).padStart(2, "0");
  const fullYear = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  return `${fullYear}-${month}-${day}`;
}

function intFrom(value: unknown): number | null {
  const text = cleanText(value);
  if (!text) return null;
  const match = text.replace(",", ".").match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Math.round(Number(match[0]));
  return Number.isFinite(parsed) ? parsed : null;
}

function pick(row: AnyRecord, includes: string[]): unknown {
  const keys = Object.keys(row);
  const target = keys.find((key) => includes.every((part) => normalize(key).includes(normalize(part))));
  return target ? row[target] : null;
}

function splitList(value: unknown): string[] {
  const text = cleanText(value);
  if (!text) return [];
  return text
    .split(/[,;\n]/)
    .map((item) => cleanText(item))
    .filter((item): item is string => Boolean(item));
}

function parseLocation(value: unknown): { city: string | null; country: string | null; label: string | null } {
  const text = cleanText(value);
  if (!text) return { city: null, country: null, label: null };
  const parts = text.replace(/\.$/, "").split(",").map((part) => cleanText(part)).filter(Boolean) as string[];
  if (parts.length >= 2) {
    return { city: parts[0], country: parts.slice(1).join(", "), label: parts.join(", ") };
  }
  return { city: parts[0] ?? null, country: null, label: text };
}

function extractEmergency(value: unknown): ImportProfile["emergency"] {
  const text = cleanText(value);
  if (!text) return {};
  const phone = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0] ?? null;
  const name = phone ? cleanText(text.replace(phone, "")) : text;
  return { name, phone, relationship: null };
}

function normalizeBoard(existing?: string[] | null, fromSite = false): ImportProfile["board"] {
  const validBoards = ["Desenvolvimento", "New Face", "Mainboard", "Image"] as const;
  const valid = existing?.find((category) => validBoards.includes(category as ImportProfile["board"]));
  if (valid) return valid as ImportProfile["board"];
  return fromSite ? "Mainboard" : "New Face";
}

function parseSpreadsheet(spreadsheetPath: string): ImportProfile[] {
  const workbook = XLSX.readFile(spreadsheetPath, { cellDates: true });
  const sheet = workbook.Sheets["Respostas ao formulário 1"] ?? workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("No worksheet found in spreadsheet.");
  const rows = XLSX.utils.sheet_to_json<AnyRecord>(sheet, { defval: null });
  const profiles = new Map<string, ImportProfile>();

  for (const row of rows) {
    const fullName = cleanText(pick(row, ["nome", "completo"]));
    const stageName = cleanText(pick(row, ["nome", "artistico"])) ?? fullName;
    if (!fullName && !stageName) continue;
    const key = canonicalKey(stageName, fullName);
    const reason = normalize(pick(row, ["motivo"]));
    const existing = profiles.get(key);
    const baseLocation = parseLocation(pick(row, ["cidade", "base"]));
    const measures: MeasureSet = {
      height_cm: intFrom(pick(row, ["altura"])),
      bust_cm: intFrom(pick(row, ["busto"])) ?? intFrom(pick(row, ["torax"])),
      waist_cm: intFrom(pick(row, ["cintura"])),
      hips_cm: intFrom(pick(row, ["quadril"])),
      shoe_size_br: cleanText(pick(row, ["calcado"])) ?? cleanText(pick(row, ["sapato"])),
      dress_size_br: cleanText(pick(row, ["manequim"])),
      clothing_size: cleanText(pick(row, ["manequim"])),
      hair_color: cleanText(pick(row, ["cabelo"])),
      eye_color: cleanText(pick(row, ["olhos"]))
    };

    const isMeasurementOnly = reason.includes("atualizacao") && !reason.includes("cadastro completo");
    if (existing && isMeasurementOnly) {
      existing.measures = mergeDefined(existing.measures, measures);
      continue;
    }

    const completeProfile: ImportProfile = {
      key,
      source: "spreadsheet",
      displayName: stageName ?? fullName ?? "Modelo ARO",
      stageName: stageName ?? fullName ?? "Modelo ARO",
      legalName: fullName,
      email: cleanText(pick(row, ["email"])),
      phone: cleanText(pick(row, ["telefone"])),
      whatsapp: cleanText(pick(row, ["whatsapp"])),
      wechat: cleanText(pick(row, ["wechat"])),
      instagram: cleanText(pick(row, ["instagram"])),
      tiktok: cleanText(pick(row, ["tiktok"])),
      xiaohongshu: cleanText(pick(row, ["rednote"])) ?? cleanText(pick(row, ["xiaohongshu"])),
      portfolioUrl: cleanText(pick(row, ["portfolio"])),
      nationality: cleanText(pick(row, ["nacionalidade"])),
      location: baseLocation.label,
      currentCity: baseLocation.city,
      currentCountry: baseLocation.country,
      baseCity: baseLocation.city,
      baseCountry: baseLocation.country,
      birthDate: firstDate(pick(row, ["nascimento"])),
      address: cleanText(pick(row, ["endereco"])),
      country: baseLocation.country,
      modelType: null,
      cpf: cleanText(pick(row, ["cpf"])),
      rg: cleanText(pick(row, ["rg"])),
      passport: cleanText(pick(row, ["passaporte"])),
      visas: {
        us: cleanText(pick(row, ["visto", "americano"])) ?? cleanText(pick(row, ["visto", "eua"])),
        eu: cleanText(pick(row, ["visto", "europeu"])),
        china: cleanText(pick(row, ["visto", "china"])),
        other: cleanText(pick(row, ["outros", "vistos"]))
      },
      parents: {
        mother: cleanText(pick(row, ["mae"])),
        father: cleanText(pick(row, ["pai"]))
      },
      emergency: extractEmergency(pick(row, ["emergencia"])),
      health: {
        foodRestrictions: cleanText(pick(row, ["restricao", "alimentar"])),
        allergies: cleanText(pick(row, ["alergia"])),
        medicalHistory: cleanText(pick(row, ["historico", "saude"]))
      },
      banking: cleanText(pick(row, ["pix"])) ?? cleanText(pick(row, ["banco"])),
      activeAgencies: splitList(pick(row, ["agencias", "ativas"])),
      inactiveAgencies: splitList(pick(row, ["agencias", "inativas"])),
      importantJobs: cleanText(pick(row, ["trabalhos", "relevantes"])),
      measures,
      board: "New Face",
      images: [],
      importedFromSpreadsheet: true,
      importedFromSite: false
    };

    if (existing) {
      profiles.set(key, combineProfiles(existing, completeProfile));
    } else {
      profiles.set(key, completeProfile);
    }
  }

  return [...profiles.values()];
}

async function parseSite(siteUrl: string): Promise<ImportProfile[]> {
  const response = await fetch(siteUrl, { headers: { "user-agent": "ARO import/1.0" } });
  if (!response.ok) throw new Error(`Site fetch failed with ${response.status}.`);
  const html = await response.text();
  const objects = extractWixModelObjects(html);
  return objects.map((object) => {
    const title = cleanText(object.title) ?? "Modelo ARO";
    const name = /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s]+$/.test(title) ? properName(title) : title;
    const location = parseLocation(object.type);
    const medidas = htmlToText(object.medidas ?? object.description ?? "");
    const galleryImages = Array.isArray(object.mediagallery) ? object.mediagallery : [];
    const images: SiteImage[] = [];
    const cover = wixImageToUrl(object.image);
    if (cover) {
      images.push({
        url: cover,
        sourceUrl: cleanText(object.image) ?? cover,
        title: `${name} cover`,
        order: 0,
        role: "cover"
      });
    }
    galleryImages.forEach((image: AnyRecord, index: number) => {
      if (image.type && image.type !== "image") return;
      const source = cleanText(image.src) ?? cleanText(image.slug);
      const url = wixImageToUrl(source);
      if (!url) return;
      images.push({
        url,
        sourceUrl: source ?? url,
        title: cleanText(image.title) ?? cleanText(image.fileName) ?? `${name} ${index + 1}`,
        order: index + 1,
        role: "gallery"
      });
    });

    return {
      key: canonicalKey(name),
      source: "site",
      displayName: name,
      stageName: name,
      nationality: normalize(object.year).includes("brazil") ? "Brazilian" : cleanText(object.year),
      location: location.label,
      currentCity: location.city,
      currentCountry: location.country,
      baseCity: location.city,
      baseCountry: location.country,
      modelType: "model",
      measures: parseMeasures(medidas),
      board: "Mainboard",
      images: dedupeImages(images),
      sitePath: cleanText(object["link-work-title"])?.replaceAll("\\/", "/"),
      importedFromSpreadsheet: false,
      importedFromSite: true
    };
  });
}

function extractWixModelObjects(html: string): AnyRecord[] {
  const objects: AnyRecord[] = [];
  const seen = new Set<string>();
  const linkRegex = /"link-work-title":"\\\/models\\\/[^\"]+"/g;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html))) {
    const prefixStart = Math.max(0, match.index - 5000);
    const prefix = html.slice(prefixStart, match.index);
    const keys = [...prefix.matchAll(/"([0-9a-f]{8}-[0-9a-f-]{27,})"\s*:\s*\{/g)];
    const keyMatch = keys.at(-1);
    if (!keyMatch || keyMatch.index === undefined) continue;
    const objectStart = html.indexOf("{", prefixStart + keyMatch.index);
    const objectEnd = findObjectEnd(html, objectStart);
    if (objectStart < 0 || objectEnd < 0) continue;
    try {
      const object = JSON.parse(html.slice(objectStart, objectEnd));
      const link = cleanText(object["link-work-title"])?.replaceAll("\\/", "/");
      if (!link || seen.has(link)) continue;
      seen.add(link);
      objects.push(object);
    } catch {
      continue;
    }
  }
  return objects;
}

function findObjectEnd(source: string, start: number): number {
  let inString = false;
  let escaping = false;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (escaping) {
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if (char === "\"") inString = !inString;
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return -1;
}

function htmlToText(html: unknown): string {
  return cleanText(html)
    ?.replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+\n/g, "\n")
    .trim() ?? "";
}

function parseMeasures(text: string): MeasureSet {
  const value = (label: string) => {
    const regex = new RegExp(`(?:${label}):?\\s*(\\d+(?:[.,]\\d+)?)`, "i");
    return intFrom(text.match(regex)?.[1]);
  };
  const raw = (label: string) => {
    const regex = new RegExp(`(?:${label}):?\\s*([^\\n]+)`, "i");
    return cleanText(text.match(regex)?.[1]);
  };
  return {
    height_cm: value("Height|Altura"),
    bust_cm: value("Bust|Chest|Busto|T[oó]rax"),
    waist_cm: value("Waist|Cintura"),
    hips_cm: value("Hips|Quadril"),
    dress_size_br: raw("Manequim"),
    clothing_size: raw("Manequim"),
    shoe_size_br: raw("Shoes|Sapatos|Cal[cç]ado"),
    hair_color: raw("Hair|Cabelo"),
    eye_color: raw("Eyes|Olhos")
  };
}

function wixImageToUrl(source: unknown): string | null {
  const text = cleanText(source);
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  const match = text.match(/(?:wix:image:\/\/v1\/)?([^/#]+)(?:\/[^#]*)?(?:#.*)?$/);
  const slug = match?.[1];
  if (!slug || !/\.(jpe?g|png|webp)$/i.test(slug)) return null;
  return `https://static.wixstatic.com/media/${slug}`;
}

function dedupeImages(images: SiteImage[]): SiteImage[] {
  const seen = new Set<string>();
  return images.filter((image) => {
    const key = image.sourceUrl || image.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeDefined<T extends AnyRecord>(base: T, updates: T): T {
  const merged = { ...base };
  for (const [key, value] of Object.entries(updates)) {
    if (value !== null && value !== undefined && value !== "") merged[key as keyof T] = value as T[keyof T];
  }
  return merged;
}

function combineProfiles(base: ImportProfile, incoming: ImportProfile): ImportProfile {
  const source = base.importedFromSpreadsheet || incoming.importedFromSpreadsheet
    ? base.importedFromSite || incoming.importedFromSite
      ? "combined"
      : "spreadsheet"
    : "site";
  return {
    ...mergeDefined(base, incoming),
    source,
    legalName: base.legalName ?? incoming.legalName,
    measures: mergeDefined(base.measures, incoming.measures),
    images: dedupeImages([...incoming.images, ...base.images]),
    board: incoming.importedFromSite ? "Mainboard" : base.board,
    importedFromSpreadsheet: base.importedFromSpreadsheet || incoming.importedFromSpreadsheet,
    importedFromSite: base.importedFromSite || incoming.importedFromSite
  };
}

async function main() {
  const args = parseArgs();
  const startedAt = new Date().toISOString().replace(/[:.]/g, "-");
  const reportDir = path.join(REPORT_ROOT, startedAt);
  const backupDir = path.join(BACKUP_ROOT, startedAt);
  await mkdir(reportDir, { recursive: true });
  await mkdir(backupDir, { recursive: true });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  if (!supabaseUrl.includes(PROJECT_REF)) {
    throw new Error("Refusing to import because NEXT_PUBLIC_SUPABASE_URL does not match the expected AROLAB project.");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const stats: ImportStats = {
    apply: args.apply,
    createdModels: 0,
    updatedModels: 0,
    spreadsheetProfiles: 0,
    siteProfiles: 0,
    createdMedia: 0,
    reusedMedia: 0,
    failedImages: [],
    skippedSiteProfiles: [],
    warnings: []
  };

  await assertProductionState(admin);
  const spreadsheetProfiles = parseSpreadsheet(args.spreadsheet);
  const siteProfiles = await parseSite(args.site);
  stats.spreadsheetProfiles = spreadsheetProfiles.length;
  stats.siteProfiles = siteProfiles.length;
  stats.warnings.push(...coverageWarnings(spreadsheetProfiles, siteProfiles));

  const importProfiles = combineSources(spreadsheetProfiles, siteProfiles);
  await writeFile(
    path.join(reportDir, "import-plan.json"),
    JSON.stringify({
      apply: args.apply,
      generatedAt: new Date().toISOString(),
      spreadsheetProfiles: spreadsheetProfiles.map(redactProfile),
      siteProfiles: siteProfiles.map(redactProfile),
      combinedProfiles: importProfiles.map(redactProfile),
      warnings: stats.warnings
    }, null, 2)
  );

  const snapshot = await createSnapshot(admin, importProfiles);
  await writeFile(path.join(backupDir, "snapshot.json"), JSON.stringify(snapshot, null, 2));
  await writeFile(path.join(backupDir, "manifest.json"), JSON.stringify(redactSnapshot(snapshot), null, 2));

  if (!args.apply) {
    await finishReport(reportDir, stats, "Dry-run complete. No database or storage changes were made.");
    printSummary(stats, reportDir, backupDir, "Dry-run complete. Use --apply to execute.");
    return;
  }

  const createdStoragePaths: string[] = [];
  const createdMediaIds: string[] = [];
  const createdModelIds: string[] = [];

  try {
    const existing = await loadExistingModels(admin);
    const mediaByModel = await loadMediaByModel(admin);

    for (const profile of importProfiles) {
      const match = findExistingModel(profile, existing);
      const model = match
        ? await updateModel(admin, match, profile)
        : await createModel(admin, profile);
      if (!match) {
        createdModelIds.push(model.id);
        existing.push(model);
        stats.createdModels += 1;
      } else {
        stats.updatedModels += 1;
      }

      await upsertPrivateProfile(admin, model.id, profile);
      if (profile.images.length) {
        const currentMedia = mediaByModel.get(model.id) ?? [];
        const importedMedia = await importImages(admin, model, profile, currentMedia, stats, createdStoragePaths, createdMediaIds);
        mediaByModel.set(model.id, [...currentMedia, ...importedMedia]);
      }
    }

    await validateImport(admin, anonKey, importProfiles, stats);
    await finishReport(reportDir, stats, "Import applied successfully.");
    printSummary(stats, reportDir, backupDir, "Import applied successfully.");
  } catch (error) {
    await rollbackCreatedObjects(admin, createdStoragePaths, createdMediaIds, createdModelIds);
    await finishReport(reportDir, stats, `Import failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

function combineSources(spreadsheet: ImportProfile[], site: ImportProfile[]): ImportProfile[] {
  const map = new Map<string, ImportProfile>();
  for (const profile of spreadsheet) map.set(profile.key, profile);
  for (const profile of site) {
    const existing = map.get(profile.key);
    map.set(profile.key, existing ? combineProfiles(existing, profile) : profile);
  }
  return [...map.values()].sort((a, b) => a.stageName.localeCompare(b.stageName, "pt-BR"));
}

function coverageWarnings(spreadsheet: ImportProfile[], site: ImportProfile[]): string[] {
  const warnings: string[] = [];
  const spreadsheetKeys = spreadsheet.map((profile) => profile.key);
  const siteKeys = site.map((profile) => profile.key);
  if (spreadsheet.length !== 12) {
    warnings.push(`Spreadsheet profile count is ${spreadsheet.length}; expected 12 unique profiles for this import file.`);
  }
  for (const key of new Set(spreadsheetKeys)) {
    if (spreadsheetKeys.filter((item) => item === key).length > 1) {
      warnings.push(`Spreadsheet duplicate normalized key detected: ${key}`);
    }
  }
  for (const key of new Set(siteKeys)) {
    if (siteKeys.filter((item) => item === key).length > 1) {
      warnings.push(`Site duplicate normalized key detected: ${key}`);
    }
  }
  if (!site.length) warnings.push("No individual model pages were discovered on the site.");
  return warnings;
}

async function assertProductionState(admin: SupabaseClientLike) {
  const { error: modelError } = await admin.from("models").select("id").limit(1);
  if (modelError) throw new Error(`Cannot read models table: ${modelError.message}`);
  const { error: viewError } = await admin.from("model_client_profiles").select("id").limit(1);
  if (viewError) throw new Error(`Cannot read public client profile view: ${viewError.message}`);
  const { data: bucket, error: bucketError } = await admin.storage.getBucket(MODEL_BUCKET);
  if (bucketError || !bucket) throw new Error(`Cannot read storage bucket ${MODEL_BUCKET}.`);
  if (bucket.public) throw new Error(`${MODEL_BUCKET} must not be public.`);
}

async function loadExistingModels(admin: SupabaseClientLike): Promise<ExistingModel[]> {
  const { data, error } = await admin.from("models").select("*").order("created_at", { ascending: true });
  if (error) throw new Error(`Cannot load existing models: ${error.message}`);
  return (data ?? []) as ExistingModel[];
}

async function loadMediaByModel(admin: SupabaseClientLike): Promise<Map<string, AnyRecord[]>> {
  const { data, error } = await admin
    .from("model_media")
    .select("*")
    .eq("media_type", "portfolio")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`Cannot load existing media: ${error.message}`);
  const map = new Map<string, AnyRecord[]>();
  for (const media of data ?? []) {
    const list = map.get(media.model_id) ?? [];
    list.push(media);
    map.set(media.model_id, list);
  }
  return map;
}

function findExistingModel(profile: ImportProfile, models: ExistingModel[]): ExistingModel | null {
  const aliases = new Set([
    profile.key,
    canonicalKey(profile.displayName),
    canonicalKey(profile.stageName),
    canonicalKey(profile.legalName)
  ]);
  return models.find((model) => {
    const modelKeys = [
      canonicalKey(model.stage_name),
      canonicalKey(model.display_name),
      canonicalKey(model.legal_name)
    ];
    return modelKeys.some((key) => aliases.has(key));
  }) ?? null;
}

async function createModel(admin: SupabaseClientLike, profile: ImportProfile): Promise<ExistingModel> {
  const { data, error } = await admin
    .from("models")
    .insert(modelPayload(profile, null))
    .select("*")
    .single();
  if (error) throw new Error(`Cannot create model ${profile.stageName}: ${error.message}`);
  return data as ExistingModel;
}

async function updateModel(admin: SupabaseClientLike, existing: ExistingModel, profile: ImportProfile): Promise<ExistingModel> {
  const { data, error } = await admin
    .from("models")
    .update(modelPayload(profile, existing))
    .eq("id", existing.id)
    .select("*")
    .single();
  if (error) throw new Error(`Cannot update model ${profile.stageName}: ${error.message}`);
  return data as ExistingModel;
}

function modelPayload(profile: ImportProfile, existing: ExistingModel | null): AnyRecord {
  const board = normalizeBoard(existing?.categories, profile.importedFromSite);
  const now = new Date().toISOString();
  const payload: AnyRecord = {
    display_name: profile.displayName,
    stage_name: profile.stageName,
    legal_name: profile.legalName ?? existing?.legal_name ?? null,
    email: profile.email ?? existing?.email ?? null,
    phone: profile.phone ?? existing?.phone ?? null,
    whatsapp: profile.whatsapp ?? existing?.whatsapp ?? null,
    wechat: profile.wechat ?? existing?.wechat ?? null,
    status: "approved",
    is_published: true,
    categories: Array.from(new Set([board, ...(existing?.categories ?? []).filter((item) => !["Freelance", "Freelancer", "VEIN"].includes(item))])),
    nationality: profile.nationality ?? existing?.nationality ?? null,
    birth_date: profile.birthDate ?? existing?.birth_date ?? null,
    location: profile.location ?? existing?.location ?? null,
    current_city: profile.currentCity ?? existing?.current_city ?? null,
    current_country: profile.currentCountry ?? existing?.current_country ?? null,
    base_city: profile.baseCity ?? existing?.base_city ?? null,
    base_country: profile.baseCountry ?? existing?.base_country ?? null,
    model_type: profile.modelType ?? existing?.model_type ?? "model",
    height_cm: profile.measures.height_cm ?? existing?.height_cm ?? null,
    bust_cm: profile.measures.bust_cm ?? existing?.bust_cm ?? null,
    waist_cm: profile.measures.waist_cm ?? existing?.waist_cm ?? null,
    hips_cm: profile.measures.hips_cm ?? existing?.hips_cm ?? null,
    shoe_size: profile.measures.shoe_size_br ?? existing?.shoe_size ?? null,
    shoe_size_br: profile.measures.shoe_size_br ?? existing?.shoe_size_br ?? null,
    dress_size_br: profile.measures.dress_size_br ?? existing?.dress_size_br ?? null,
    clothing_size: profile.measures.clothing_size ?? existing?.clothing_size ?? null,
    hair_color: profile.measures.hair_color ?? existing?.hair_color ?? null,
    eye_color: profile.measures.eye_color ?? existing?.eye_color ?? null,
    consent_lgpd: true,
    last_profile_update_at: now,
    last_measurements_update_at: now,
    profile_reviewed_at: now
  };

  if (profile.address) payload.address_line = profile.address;
  if (profile.emergency?.name) payload.emergency_contact_name = profile.emergency.name;
  if (profile.emergency?.phone) payload.emergency_contact_phone = profile.emergency.phone;
  if (profile.emergency?.relationship) payload.emergency_contact_relationship = profile.emergency.relationship;

  return payload;
}

async function upsertPrivateProfile(admin: SupabaseClientLike, modelId: string, profile: ImportProfile) {
  await upsertByModel(admin, "model_social_links", modelId, {
    instagram: profile.instagram ?? null,
    tiktok: profile.tiktok ?? null,
    xiaohongshu: profile.xiaohongshu ?? null,
    wechat_id: profile.wechat ?? null,
    external_portfolio_url: profile.portfolioUrl ?? null
  });

  await upsertByModel(admin, "model_documents", modelId, {
    cpf: profile.cpf ?? null,
    rg: profile.rg ?? null,
    passport_number: profile.passport ?? null,
    visa_us: profile.visas?.us ?? null,
    visa_eu: profile.visas?.eu ?? null,
    visa_china: profile.visas?.china ?? null,
    other_visas: profile.visas?.other ?? null,
    legal_guardian_name: [profile.parents?.mother, profile.parents?.father].filter(Boolean).join(" | ") || null,
    banking_info_private: profile.banking ?? null
  });

  await upsertByModel(admin, "model_health_logistics", modelId, {
    food_restrictions: profile.health?.foodRestrictions ?? null,
    allergies: profile.health?.allergies ?? null,
    medications_notes: profile.health?.medicalHistory ?? null,
    passport_valid: Boolean(profile.passport),
    can_travel_internationally: Boolean(profile.passport),
    accepts_out_of_city_jobs: true
  });

  await upsertByModel(admin, "model_representation", modelId, {
    mother_agency: null,
    international_agencies: profile.activeAgencies ?? [],
    previous_markets: profile.inactiveAgencies ?? [],
    strategic_notes: profile.importantJobs ?? null,
    commercial_status: "active"
  });
}

async function upsertByModel(admin: SupabaseClientLike, table: string, modelId: string, payload: AnyRecord) {
  const nonEmptyPayload = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0))
  );
  if (!Object.keys(nonEmptyPayload).length) return;
  const { error } = await admin
    .from(table)
    .upsert({ model_id: modelId, ...nonEmptyPayload }, { onConflict: "model_id" });
  if (error) throw new Error(`Cannot upsert ${table}: ${error.message}`);
}

async function importImages(
  admin: SupabaseClientLike,
  model: ExistingModel,
  profile: ImportProfile,
  currentMedia: AnyRecord[],
  stats: ImportStats,
  createdStoragePaths: string[],
  createdMediaIds: string[]
): Promise<AnyRecord[]> {
  const imported: AnyRecord[] = [];
  const existingNotes = new Set(currentMedia.flatMap((media) => [
    extractNoteToken(media.notes, "source_url"),
    extractNoteToken(media.notes, "sha256")
  ]).filter(Boolean) as string[]);

  for (const image of profile.images) {
    try {
      if (existingNotes.has(image.sourceUrl)) {
        stats.reusedMedia += 1;
        continue;
      }
      const downloaded = await downloadImage(image.url);
      if (existingNotes.has(downloaded.sha256)) {
        stats.reusedMedia += 1;
        continue;
      }
      existingNotes.add(image.sourceUrl);
      existingNotes.add(downloaded.sha256);
      const fileName = safeFileName(image.title, downloaded.extension);
      const storagePath = `models/${model.id}/portfolio/${Date.now()}-${randomUUID()}-${fileName}`;
      const { error: uploadError } = await admin.storage
        .from(MODEL_BUCKET)
        .upload(storagePath, downloaded.buffer, {
          contentType: downloaded.contentType,
          upsert: false
        });
      if (uploadError) throw uploadError;
      createdStoragePaths.push(storagePath);

      const { data, error } = await admin
        .from("model_media")
        .insert({
          model_id: model.id,
          media_type: "portfolio",
          storage_bucket: MODEL_BUCKET,
          storage_path: storagePath,
          title: image.title,
          status: "approved",
          visibility: "public",
          sort_order: image.order,
          notes: `Imported by AROLAB XLSX/site importer\nsource_url=${image.sourceUrl}\nsha256=${downloaded.sha256}`
        })
        .select("*")
        .single();
      if (error) throw error;
      createdMediaIds.push(data.id);
      imported.push(data);
      stats.createdMedia += 1;

      if (image.role === "cover" || image.order === 0) {
        const { error: coverError } = await admin
          .from("models")
          .update({ main_image_path: storagePath, last_media_update_at: new Date().toISOString() })
          .eq("id", model.id);
        if (coverError) throw coverError;
      }
    } catch (error) {
      stats.failedImages.push({
        model: profile.stageName,
        source: image.sourceUrl,
        reason: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return imported;
}

function extractNoteToken(notes: unknown, key: string): string | null {
  const text = cleanText(notes);
  if (!text) return null;
  const match = text.match(new RegExp(`${key}=([^\\n]+)`));
  return cleanText(match?.[1]);
}

async function downloadImage(url: string): Promise<{ buffer: Buffer; contentType: string; extension: string; sha256: string }> {
  const response = await fetch(url, { headers: { "user-agent": "ARO import/1.0" } });
  if (!response.ok) throw new Error(`image fetch failed ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  if (!contentType.startsWith("image/")) throw new Error(`not an image: ${contentType}`);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.byteLength < 1024) throw new Error("image too small");
  const dimensions = imageSize(buffer);
  if (!dimensions.width || !dimensions.height) throw new Error("image dimensions unavailable");
  const extension = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg";
  return {
    buffer,
    contentType,
    extension,
    sha256: createHash("sha256").update(buffer).digest("hex")
  };
}

function safeFileName(title: string, extension: string): string {
  const base = normalize(title).replace(/\s+/g, "-").slice(0, 60) || "portfolio";
  return `${base}.${extension}`;
}

async function createSnapshot(admin: SupabaseClientLike, profiles: ImportProfile[]) {
  const existingModels = await loadExistingModels(admin);
  const affected = existingModels.filter((model) => profiles.some((profile) => findExistingModel(profile, [model])));
  const affectedIds = affected.map((model) => model.id);
  const snapshot: AnyRecord = {
    createdAt: new Date().toISOString(),
    affectedModelIds: affectedIds,
    models: affected,
    model_media: [],
    model_social_links: [],
    model_documents: [],
    model_health_logistics: [],
    model_representation: [],
    model_work_history: []
  };
  if (!affectedIds.length) return snapshot;
  for (const table of ["model_media", "model_social_links", "model_documents", "model_health_logistics", "model_representation", "model_work_history"]) {
    const { data, error } = await admin.from(table).select("*").in("model_id", affectedIds);
    if (error) throw new Error(`Cannot snapshot ${table}: ${error.message}`);
    snapshot[table] = data ?? [];
  }
  snapshot.hash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  return snapshot;
}

function redactProfile(profile: ImportProfile): AnyRecord {
  return {
    key: profile.key,
    source: profile.source,
    displayName: profile.displayName,
    stageName: profile.stageName,
    hasPrivateData: Boolean(profile.legalName || profile.cpf || profile.rg || profile.passport || profile.address || profile.banking),
    importedFromSpreadsheet: profile.importedFromSpreadsheet,
    importedFromSite: profile.importedFromSite,
    imageCount: profile.images.length,
    measures: profile.measures,
    board: profile.board,
    location: profile.location
  };
}

function redactSnapshot(snapshot: AnyRecord): AnyRecord {
  return {
    createdAt: snapshot.createdAt,
    hash: snapshot.hash,
    affectedModelCount: snapshot.models?.length ?? 0,
    affectedModels: (snapshot.models ?? []).map((model: AnyRecord) => ({
      id: model.id,
      displayName: model.display_name,
      stageName: model.stage_name,
      mediaCount: (snapshot.model_media ?? []).filter((media: AnyRecord) => media.model_id === model.id).length
    }))
  };
}

async function validateImport(admin: SupabaseClientLike, anonKey: string | undefined, profiles: ImportProfile[], stats: ImportStats) {
  const existing = await loadExistingModels(admin);
  const missing = profiles.filter((profile) => !findExistingModel(profile, existing));
  if (missing.length) throw new Error(`Import validation failed; missing profiles: ${missing.map((profile) => profile.stageName).join(", ")}`);

  const siteProfiles = profiles.filter((profile) => profile.importedFromSite);
  for (const profile of siteProfiles) {
    const model = findExistingModel(profile, existing);
    if (!model?.main_image_path) throw new Error(`Import validation failed; missing cover for ${profile.stageName}`);
    const { error } = await admin.storage.from(MODEL_BUCKET).createSignedUrl(model.main_image_path, 60);
    if (error) throw new Error(`Import validation failed; cover not accessible for ${profile.stageName}: ${error.message}`);
  }

  if (!anonKey) {
    stats.warnings.push("Anon privacy validation skipped because NEXT_PUBLIC_SUPABASE_ANON_KEY was not provided.");
    return;
  }
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data, error } = await anon.from("model_client_profiles").select("*").limit(5);
  if (error) {
    stats.warnings.push(`Anon client profile view validation skipped: ${error.message}`);
    return;
  }
  const forbiddenKeys = ["cpf", "rg", "passport", "address", "bank", "health", "notes", "legal_name", "email", "phone", "whatsapp"];
  for (const row of data ?? []) {
    for (const key of Object.keys(row)) {
      if (forbiddenKeys.some((forbidden) => normalize(key).includes(forbidden))) {
        throw new Error(`Privacy validation failed; public view exposes ${key}.`);
      }
    }
  }
}

async function rollbackCreatedObjects(admin: SupabaseClientLike, storagePaths: string[], mediaIds: string[], modelIds: string[]) {
  if (mediaIds.length) {
    await admin.from("model_media").delete().in("id", mediaIds);
  }
  if (storagePaths.length) {
    await admin.storage.from(MODEL_BUCKET).remove(storagePaths);
  }
  if (modelIds.length) {
    await admin.from("models").delete().in("id", modelIds);
  }
}

async function finishReport(reportDir: string, stats: ImportStats, status: string) {
  await writeFile(path.join(reportDir, "summary.json"), JSON.stringify({ status, ...stats }, null, 2));
  await writeFile(
    path.join(reportDir, "report.md"),
    [
      "# AROLAB model import",
      "",
      `Status: ${status}`,
      `Apply: ${stats.apply ? "yes" : "no"}`,
      `Spreadsheet profiles: ${stats.spreadsheetProfiles}`,
      `Site profiles: ${stats.siteProfiles}`,
      `Created models: ${stats.createdModels}`,
      `Updated models: ${stats.updatedModels}`,
      `Created media: ${stats.createdMedia}`,
      `Reused media: ${stats.reusedMedia}`,
      `Failed images: ${stats.failedImages.length}`,
      `Warnings: ${stats.warnings.length}`
    ].join("\n")
  );
}

function printSummary(stats: ImportStats, reportDir: string, backupDir: string, status: string) {
  console.log(status);
  console.log(`spreadsheetProfiles=${stats.spreadsheetProfiles}`);
  console.log(`siteProfiles=${stats.siteProfiles}`);
  console.log(`createdModels=${stats.createdModels}`);
  console.log(`updatedModels=${stats.updatedModels}`);
  console.log(`createdMedia=${stats.createdMedia}`);
  console.log(`reusedMedia=${stats.reusedMedia}`);
  console.log(`failedImages=${stats.failedImages.length}`);
  console.log(`warnings=${stats.warnings.length}`);
  console.log(`backupDir=${backupDir}`);
  console.log(`reportDir=${reportDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
