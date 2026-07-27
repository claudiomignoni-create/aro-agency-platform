import { NextResponse } from "next/server";
import { isMissingSchemaError } from "@/lib/accounting-schema";
import { requireRole } from "@/lib/auth";
import { operationalTimeZone } from "@/lib/calendar";
import { isMissingInternationalSeasonsSchemaError } from "@/lib/international-seasons";
import { createClient } from "@/lib/supabase/server";

type AlertItem = {
  href: string;
  id: string;
  priority: "low" | "medium" | "high";
  title: string;
  description: string;
  timeLabel: string;
  type: "contract" | "payment" | "flight" | "travel" | "job" | "casting" | "document" | "model_update" | "message";
};

function nowInSaoPaulo() {
  return new Date();
}

function hoursFromNow(value: string | null | undefined) {
  if (!value) return null;
  return (new Date(value).getTime() - nowInSaoPaulo().getTime()) / 36e5;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: operationalTimeZone
  }).format(new Date(value));
}

function priorityForHours(hours: number | null) {
  if (hours === null) return "low";
  if (hours <= 6) return "high";
  if (hours <= 24) return "medium";
  return "low";
}

export async function GET() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const now = nowInSaoPaulo();
  const in48Hours = new Date(now.getTime() + 48 * 36e5).toISOString();
  const isoNow = now.toISOString();

  const [jobsResult, financeResult, flightsResult, seasonAlertsResult, documentsResult, updatesResult] =
    await Promise.allSettled([
      supabase
        .from("jobs")
        .select("id, project_name, brand_name, type, status, start_at, city, country")
        .gte("start_at", isoNow)
        .lte("start_at", in48Hours)
        .not("status", "in", "(canceled,declined,completed)")
        .order("start_at", { ascending: true })
        .limit(8),
      supabase
        .from("financial_job_entries")
        .select("id, title, client_payment_status, client_amount_due, currency, start_at")
        .in("client_payment_status", ["pending", "partially_received"])
        .limit(8),
      supabase
        .from("travel_flight_segments")
        .select("id, trip_id, airline_code, flight_number, departure_at, departure_iata, arrival_iata, status")
        .gte("departure_at", isoNow)
        .lte("departure_at", in48Hours)
        .order("departure_at", { ascending: true })
        .limit(8),
      supabase
        .from("international_season_alerts")
        .select("id, season_id, alert_type, due_on, priority, title, description, link_path, status")
        .gte("due_on", isoNow.slice(0, 10))
        .lte("due_on", new Date(now.getTime() + 120 * 24 * 36e5).toISOString().slice(0, 10))
        .in("status", ["scheduled", "active"])
        .order("due_on", { ascending: true })
        .limit(10),
      supabase
        .from("model_media")
        .select("id, model_id, title, valid_until, media_type")
        .not("valid_until", "is", null)
        .gte("valid_until", isoNow.slice(0, 10))
        .lte("valid_until", new Date(now.getTime() + 30 * 24 * 36e5).toISOString().slice(0, 10))
        .order("valid_until", { ascending: true })
        .limit(6),
      supabase
        .from("models")
        .select("id, display_name, stage_name, last_profile_update_at, last_media_update_at, status")
        .eq("status", "pending_review")
        .order("updated_at", { ascending: false })
        .limit(6)
    ]);

  const alerts: AlertItem[] = [];

  if (jobsResult.status === "fulfilled" && !jobsResult.value.error) {
    for (const job of jobsResult.value.data ?? []) {
      const hours = hoursFromNow(job.start_at);
      alerts.push({
        description: [job.city, job.country, formatDateTime(job.start_at)].filter(Boolean).join(" · "),
        href: `/admin/calendar/${job.id}`,
        id: `job:${job.id}`,
        priority: priorityForHours(hours),
        timeLabel: formatDateTime(job.start_at),
        title: job.project_name || job.brand_name || "Job proximo",
        type: job.type === "casting" ? "casting" : "job"
      });
    }
  }

  if (financeResult.status === "fulfilled" && !financeResult.value.error) {
    for (const item of financeResult.value.data ?? []) {
      alerts.push({
        description: `${item.currency} ${Number(item.client_amount_due ?? 0).toLocaleString("pt-BR")}`,
        href: `/admin/accounting/${item.id}`,
        id: `payment:${item.id}`,
        priority: "medium",
        timeLabel: item.start_at ? formatDateTime(item.start_at) : "Pendente",
        title: item.title || "Pagamento pendente",
        type: "payment"
      });
    }
  } else if (
    financeResult.status === "fulfilled" &&
    financeResult.value.error &&
    !isMissingSchemaError(financeResult.value.error)
  ) {
    throw financeResult.value.error;
  }

  if (flightsResult.status === "fulfilled" && !flightsResult.value.error) {
    for (const flight of flightsResult.value.data ?? []) {
      const hours = hoursFromNow(flight.departure_at);
      alerts.push({
        description: [flight.departure_iata, flight.arrival_iata, formatDateTime(flight.departure_at)]
          .filter(Boolean)
          .join(" · "),
        href: `/admin/travel/${flight.trip_id}`,
        id: `flight:${flight.id}`,
        priority: priorityForHours(hours),
        timeLabel: formatDateTime(flight.departure_at),
        title: [flight.airline_code, flight.flight_number].filter(Boolean).join(" ") || "Voo proximo",
        type: "flight"
      });
    }
  } else if (
    flightsResult.status === "fulfilled" &&
    flightsResult.value.error &&
    !isMissingSchemaError(flightsResult.value.error)
  ) {
    throw flightsResult.value.error;
  }

  if (seasonAlertsResult.status === "fulfilled" && !seasonAlertsResult.value.error) {
    for (const alert of seasonAlertsResult.value.data ?? []) {
      alerts.push({
        description: alert.description ?? "Temporada internacional",
        href: alert.link_path || `/admin/travel`,
        id: `season-alert:${alert.id}`,
        priority: alert.priority,
        timeLabel: alert.due_on,
        title: alert.title,
        type: alert.alert_type.includes("payment") ? "payment" : "contract"
      });
    }
  } else if (
    seasonAlertsResult.status === "fulfilled" &&
    seasonAlertsResult.value.error &&
    !isMissingInternationalSeasonsSchemaError(seasonAlertsResult.value.error)
  ) {
    throw seasonAlertsResult.value.error;
  }

  if (documentsResult.status === "fulfilled" && !documentsResult.value.error) {
    for (const document of documentsResult.value.data ?? []) {
      alerts.push({
        description: [document.media_type, document.valid_until].filter(Boolean).join(" · "),
        href: `/admin/models/${document.model_id}/edit?tab=documents`,
        id: `document:${document.id}`,
        priority: "medium",
        timeLabel: document.valid_until ?? "",
        title: document.title || "Documento proximo do vencimento",
        type: "document"
      });
    }
  }

  if (updatesResult.status === "fulfilled" && !updatesResult.value.error) {
    for (const model of updatesResult.value.data ?? []) {
      alerts.push({
        description: "Cadastro aguardando revisao administrativa.",
        href: `/admin/models/${model.id}/edit`,
        id: `model-update:${model.id}`,
        priority: "low",
        timeLabel: "Pendente",
        title: model.stage_name || model.display_name,
        type: "model_update"
      });
    }
  }

  return NextResponse.json({
    alerts: alerts
      .sort((left, right) => {
        const weight = { high: 0, medium: 1, low: 2 };
        return weight[left.priority] - weight[right.priority];
      })
      .slice(0, 16)
  });
}
