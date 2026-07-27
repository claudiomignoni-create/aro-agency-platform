import { isMissingSchemaError } from "@/lib/accounting-schema";
import { requireRole } from "@/lib/auth";
import {
  currentDateKey,
  currentMonthKey,
  generateMonthDays,
  monthTitlePtBr,
  nextMonthKey,
  operationalTimeZone
} from "@/lib/calendar";
import {
  type AccountingCurrency,
  accountingCurrencies,
  defaultAccountingCurrency,
  formatMoney
} from "@/lib/finance-calculations";
import {
  createModelMainImageUrls
} from "@/lib/models";
import { createClient } from "@/lib/supabase/server";
import {
  flightStatusLabel,
  getTravelSchemaStatus,
  isMissingTravelSchemaError,
  listTravelTrips,
  tripStatusLabel
} from "@/lib/travel";
import type { JobStatus, JobType, Model, TripStatus } from "@/types/database";

type DashboardModel = Pick<
  Model,
  | "id"
  | "display_name"
  | "stage_name"
  | "current_city"
  | "current_country"
  | "base_city"
  | "base_country"
  | "categories"
  | "main_image_path"
  | "height_cm"
  | "bust_cm"
  | "waist_cm"
  | "hips_cm"
  | "created_at"
  | "updated_at"
  | "last_profile_update_at"
  | "last_media_update_at"
>;

type DashboardJob = {
  brand_name: string | null;
  city: string | null;
  country: string | null;
  id: string;
  location_name: string | null;
  project_name: string | null;
  start_at: string;
  status: JobStatus;
  type: JobType;
  job_models: Array<{
    model: Pick<Model, "id" | "display_name" | "stage_name" | "main_image_path"> | null;
  }>;
};

type RecentAccountingEntry = {
  amount: string | number;
  currency: AccountingCurrency;
  id: string;
  occurred_on: string;
  title: string;
  model: { display_name: string; stage_name: string | null } | null;
};

type FinancialJobEntry = {
  client: { company_name: string } | null;
  client_amount_due: string | number | null;
  client_payment_status: string;
  currency: AccountingCurrency;
  id: string;
  title: string | null;
};

export type DashboardCommandCenterData = {
  accountingReady: boolean;
  activeModels: number;
  calendar: {
    days: ReturnType<typeof generateMonthDays>;
    monthKey: string;
    title: string;
    eventDates: string[];
  };
  failedWidgets: string[];
  financial: {
    pendingByCurrency: Array<{ currency: AccountingCurrency; formatted: string; value: number }>;
    recentEntries: RecentAccountingEntry[];
    recentTotals: Array<{ currency: AccountingCurrency; formatted: string; value: number }>;
  };
  imageUrls: Record<string, string>;
  internationalSeasonCount: number | null;
  latestModels: DashboardModel[];
  modelsTravelingNow: Array<{
    destination: string;
    flightStatus: string | null;
    href: string;
    id: string;
    modelName: string;
    origin: string;
    route: string;
    status: string;
  }>;
  paymentsPendingPrimary: string;
  paymentsPendingSecondary: string | null;
  recentModels: DashboardModel[];
  upcomingJobs: DashboardJob[];
  openJobs: number;
  travelMapPoints: Array<{
    agency: string | null;
    city: string;
    country: string;
    href: string;
    id: string;
    lat: number;
    lng: number;
    modelName: string;
    period: string;
    status: string;
  }>;
  travelReady: boolean;
};

const activeJobStatuses: JobStatus[] = [
  "client_requested",
  "booker_review",
  "quote_requested",
  "agency_approved",
  "waiting_model",
  "model_accepted",
  "confirmed"
];

const activeTripStatuses: TripStatus[] = ["booked", "in_transit", "arrived", "hosted"];
const officialBoards = ["Desenvolvimento", "New Face", "Mainboard", "Image"];

export function modelDisplayName(model: Pick<Model, "display_name" | "stage_name"> | null) {
  return model?.stage_name || model?.display_name || "Modelo";
}

export function modelBoard(model: Pick<Model, "categories">) {
  return officialBoards.find((board) => model.categories?.includes(board)) ?? "Desenvolvimento";
}

export function formatDashboardDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: operationalTimeZone
  }).format(new Date(value));
}

export function formatRelativeDate(value: string | null | undefined) {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const days = Math.max(0, Math.floor(diff / 86400000));
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  return `${days} dias atras`;
}

function emptyDashboardData(monthKey = currentMonthKey()): DashboardCommandCenterData {
  return {
    accountingReady: false,
    activeModels: 0,
    calendar: {
      days: generateMonthDays(`${monthKey}-01`),
      eventDates: [],
      monthKey,
      title: monthTitlePtBr(`${monthKey}-01`)
    },
    failedWidgets: [],
    financial: { pendingByCurrency: [], recentEntries: [], recentTotals: [] },
    imageUrls: {},
    internationalSeasonCount: null,
    latestModels: [],
    modelsTravelingNow: [],
    openJobs: 0,
    paymentsPendingPrimary: "—",
    paymentsPendingSecondary: "Accounting ainda não ativado",
    recentModels: [],
    travelMapPoints: [],
    travelReady: false,
    upcomingJobs: []
  };
}

function sumByCurrency<T extends { currency: AccountingCurrency }>(
  rows: T[],
  getValue: (row: T) => number
) {
  return accountingCurrencies
    .map((currency) => {
      const value = rows
        .filter((row) => row.currency === currency)
        .reduce((total, row) => total + getValue(row), 0);
      return { currency, formatted: formatMoney(value, currency), value };
    })
    .filter((row) => row.value > 0);
}

export async function getDashboardCommandCenterData(monthKey = currentMonthKey()) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const today = currentDateKey();
  const nowIso = new Date().toISOString();
  const in90Days = new Date(Date.now() + 90 * 86400000).toISOString();
  const last30Days = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const data = emptyDashboardData(monthKey);

  const [
    activeModelsResult,
    openJobsResult,
    upcomingJobsResult,
    monthJobsResult,
    latestModelsResult,
    recentModelsResult,
    accountingStatusResult,
    travelStatusResult
  ] = await Promise.allSettled([
    supabase
      .from("models")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .eq("is_published", true),
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .in("status", activeJobStatuses),
    supabase
      .from("jobs")
      .select(
        `
          id,
          project_name,
          brand_name,
          type,
          status,
          start_at,
          location_name,
          city,
          country,
          job_models (
            model:models (
              id,
              display_name,
              stage_name,
              main_image_path
            )
          )
        `
      )
      .gte("start_at", nowIso)
      .in("status", activeJobStatuses)
      .order("start_at", { ascending: true })
      .limit(4),
    supabase
      .from("jobs")
      .select("start_at")
      .gte("start_at", `${monthKey}-01T00:00:00.000Z`)
      .lt("start_at", `${nextMonthKey(monthKey)}-01T00:00:00.000Z`)
      .limit(120),
    supabase
      .from("models")
      .select(
        "id, display_name, stage_name, current_city, current_country, base_city, base_country, categories, main_image_path, height_cm, bust_cm, waist_cm, hips_cm, created_at, updated_at, last_profile_update_at, last_media_update_at"
      )
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("models")
      .select(
        "id, display_name, stage_name, current_city, current_country, base_city, base_country, categories, main_image_path, height_cm, bust_cm, waist_cm, hips_cm, created_at, updated_at, last_profile_update_at, last_media_update_at"
      )
      .order("updated_at", { ascending: false })
      .limit(5),
    import("@/lib/accounting-schema").then(({ getAccountingSchemaStatus }) =>
      getAccountingSchemaStatus()
    ),
    getTravelSchemaStatus()
  ]);

  if (activeModelsResult.status === "fulfilled" && !activeModelsResult.value.error) {
    data.activeModels = activeModelsResult.value.count ?? 0;
  } else {
    data.failedWidgets.push("Modelos Ativos");
  }

  if (openJobsResult.status === "fulfilled" && !openJobsResult.value.error) {
    data.openJobs = openJobsResult.value.count ?? 0;
  } else if (
    openJobsResult.status === "fulfilled" &&
    openJobsResult.value.error &&
    !isMissingSchemaError(openJobsResult.value.error)
  ) {
    data.failedWidgets.push("Jobs Abertos");
  }

  if (upcomingJobsResult.status === "fulfilled" && !upcomingJobsResult.value.error) {
    data.upcomingJobs = (upcomingJobsResult.value.data ?? []) as unknown as DashboardJob[];
  } else {
    data.failedWidgets.push("Proximos Trabalhos");
  }

  if (monthJobsResult.status === "fulfilled" && !monthJobsResult.value.error) {
    data.calendar.eventDates = Array.from(
      new Set((monthJobsResult.value.data ?? []).map((job) => job.start_at.slice(0, 10)))
    );
  }

  if (latestModelsResult.status === "fulfilled" && !latestModelsResult.value.error) {
    data.latestModels = (latestModelsResult.value.data ?? []) as DashboardModel[];
  } else {
    data.failedWidgets.push("Ultimos Modelos");
  }

  if (recentModelsResult.status === "fulfilled" && !recentModelsResult.value.error) {
    data.recentModels = (recentModelsResult.value.data ?? []) as DashboardModel[];
  } else {
    data.failedWidgets.push("Modelos Atualizados");
  }

  data.accountingReady =
    accountingStatusResult.status === "fulfilled" && accountingStatusResult.value.ready;

  if (data.accountingReady) {
    const [pendingResult, entriesResult] = await Promise.allSettled([
      supabase
        .from("financial_job_entries")
        .select("id, title, currency, client_amount_due, client_payment_status, client:clients(company_name)")
        .in("client_payment_status", ["pending", "partially_received"])
        .limit(120),
      supabase
        .from("model_accounting_entries")
        .select("id, title, amount, currency, occurred_on, model:models(display_name, stage_name)")
        .eq("status", "posted")
        .gte("occurred_on", last30Days)
        .order("occurred_on", { ascending: false })
        .limit(12)
    ]);

    const pendingRows =
      pendingResult.status === "fulfilled" && !pendingResult.value.error
        ? ((pendingResult.value.data ?? []) as unknown as FinancialJobEntry[])
        : [];
    const pendingByCurrency = sumByCurrency(pendingRows, (row) =>
      Number(row.client_amount_due ?? 0)
    );
    const primary =
      pendingByCurrency.find((row) => row.currency === defaultAccountingCurrency) ??
      pendingByCurrency[0];
    data.financial.pendingByCurrency = pendingByCurrency;
    data.paymentsPendingPrimary = primary?.formatted ?? formatMoney(0, defaultAccountingCurrency);
    data.paymentsPendingSecondary =
      pendingByCurrency
        .filter((row) => row.currency !== primary?.currency)
        .map((row) => row.formatted)
        .join(" · ") || null;

    if (entriesResult.status === "fulfilled" && !entriesResult.value.error) {
      data.financial.recentEntries = (entriesResult.value.data ?? []) as unknown as RecentAccountingEntry[];
      data.financial.recentTotals = sumByCurrency(data.financial.recentEntries, (row) =>
        Number(row.amount ?? 0)
      );
    } else {
      data.failedWidgets.push("Entradas Financeiras");
    }
  }

  data.travelReady =
    travelStatusResult.status === "fulfilled" && travelStatusResult.value.ready;

  if (data.travelReady) {
    const trips = await listTravelTrips({ dateFrom: today });
    const activeTrips = trips.filter((trip) => activeTripStatuses.includes(trip.status));
    const internationalTrips = activeTrips.filter((trip) =>
      [
        trip.reason === "international_season",
        Boolean(trip.destination_country && trip.destination_country !== "Brasil"),
        Boolean(trip.destination_country && trip.destination_country !== "Brazil")
      ].some(Boolean)
    );
    data.internationalSeasonCount = internationalTrips.length;
    data.travelMapPoints = internationalTrips
      .filter(
        (trip) =>
          trip.destination_latitude !== null &&
          trip.destination_longitude !== null &&
          trip.destination_city &&
          trip.destination_country
      )
      .slice(0, 12)
      .map((trip) => ({
        agency: trip.agency_name,
        city: trip.destination_city!,
        country: trip.destination_country!,
        href: `/admin/travel/${trip.id}`,
        id: trip.id,
        lat: Number(trip.destination_latitude),
        lng: Number(trip.destination_longitude),
        modelName: modelDisplayName(trip.model),
        period: [trip.starts_on, trip.ends_on].filter(Boolean).join(" a "),
        status: tripStatusLabel(trip.status)
      }));

    data.modelsTravelingNow = activeTrips.slice(0, 6).map((trip) => {
      const firstSegment = trip.flight_segments?.[0] ?? null;
      return {
        destination: [trip.destination_city, trip.destination_country].filter(Boolean).join(", "),
        flightStatus: firstSegment ? flightStatusLabel(firstSegment.status) : null,
        href: `/admin/travel/${trip.id}`,
        id: trip.id,
        modelName: modelDisplayName(trip.model),
        origin: [trip.origin_city, trip.origin_country].filter(Boolean).join(", "),
        route: [firstSegment?.departure_iata, firstSegment?.arrival_iata].filter(Boolean).join(" → "),
        status: tripStatusLabel(trip.status)
      };
    });
  } else {
    data.internationalSeasonCount = null;
  }

  const modelsForImages = [
    ...data.latestModels,
    ...data.recentModels,
    ...data.upcomingJobs.flatMap((job) => job.job_models.map((jobModel) => jobModel.model))
  ].filter((model): model is DashboardModel => Boolean(model));

  data.imageUrls = await createModelMainImageUrls(modelsForImages);

  return data;
}

export { activeJobStatuses };
