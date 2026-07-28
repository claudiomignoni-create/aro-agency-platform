import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  emptyEmailCenterDashboard,
  resolveEmailCenterPeriod
} from "../src/lib/communications/email-center";

async function file(path: string) {
  return readFile(path, "utf8");
}

test("email center period defaults to the current Sao Paulo month", () => {
  const period = resolveEmailCenterPeriod({}, new Date("2026-07-28T12:00:00Z"));

  assert.equal(period.key, "month");
  assert.equal(period.startDate, "2026-07-01");
  assert.equal(period.endDate, "2026-07-31");
  assert.equal(period.start, "2026-07-01T03:00:00.000Z");
  assert.equal(period.end, "2026-08-01T03:00:00.000Z");
});

test("email center custom period validates and includes the final day", () => {
  const period = resolveEmailCenterPeriod(
    { end: "2026-07-12", period: "custom", start: "2026-07-08" },
    new Date("2026-07-28T12:00:00Z")
  );

  assert.equal(period.startDate, "2026-07-08");
  assert.equal(period.endDate, "2026-07-12");
  assert.equal(period.end, "2026-07-13T03:00:00.000Z");
});

test("empty email dashboard never fabricates activity or response metrics", () => {
  const dashboard = emptyEmailCenterDashboard();

  assert.equal(dashboard.metrics.emails_sent.current, 0);
  assert.equal(dashboard.metrics.models_presented.current, 0);
  assert.equal(dashboard.metrics.presentations_sent.current, 0);
  assert.equal(dashboard.metrics.responses.available, false);
  assert.equal(dashboard.metrics.responses.current, null);
  assert.deepEqual(dashboard.activity, []);
  assert.equal(dashboard.featured, null);
});

test("email dashboard RPC is admin-only and aggregates sent presentation data", async () => {
  const sql = await file("supabase/migrations/025_email_presentations_model_portal.sql");

  assert.match(sql, /get_email_center_dashboard/);
  assert.match(sql, /public\.current_user_role\(\) <> 'admin'/);
  assert.match(sql, /status = 'sent'/);
  assert.match(sql, /count\(distinct coalesce\(model_id, model_name\)\)/);
  assert.match(sql, /count\(distinct presentation_id\)/);
  assert.match(sql, /'available', false/);
  assert.match(sql, /'ARO — Código de verificação'/);
  assert.match(sql, /'sender', recent\.sender/);
  assert.match(sql, /a\.metadata->>'share_link_id'/);
  assert.match(sql, /email_templates_active_default_unique/);
  assert.match(sql, /grant execute on function public\.get_email_center_dashboard\(timestamptz, timestamptz\) to authenticated/);
  assert.doesNotMatch(sql, /grant execute on function public\.get_email_center_dashboard\([^)]*\) to anon/);
  assert.doesNotMatch(sql, /grant execute on function public\.get_email_center_dashboard\([^)]*\) to model/);
});

test("email dashboard source excludes sensitive fields and fictional reference data", async () => {
  const paths = [
    "src/app/admin/email/page.tsx",
    "src/components/admin/email-center/email-dashboard.tsx",
    "src/lib/communications/email-center.ts"
  ];
  const source = (await Promise.all(paths.map(file))).join("\n");

  for (const forbidden of [
    "1.248",
    "Williams & Co.",
    "Next London",
    "IMG Models",
    "Premier Model Management",
    "Elite Paris",
    "passport",
    "banking",
    "cpf",
    "public_token_hash",
    "code_hash",
    "encrypted_payload"
  ]) {
    assert.equal(source.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
  }
});

test("email dashboard uses accessible SVG analytics and real semantic links", async () => {
  const dashboard = await file("src/components/admin/email-center/email-dashboard.tsx");
  const page = await file("src/app/admin/email/page.tsx");

  assert.match(dashboard, /role="img"/);
  assert.match(dashboard, /aria-label=/);
  assert.match(dashboard, /Considerado aberto quando o destinatário acessa o link seguro/);
  assert.match(dashboard, /href="\/admin\/email\/activity"/);
  assert.match(dashboard, /href="\/admin\/email\/reports"/);
  assert.match(page, /EmailPeriodFilter/);
  assert.match(page, /EmailResponsesMetricCard/);
});

test("email center routes are full pages instead of placeholder wrappers", async () => {
  const routes = [
    "src/app/admin/email/page.tsx",
    "src/app/admin/email/compose/page.tsx",
    "src/app/admin/email/activity/page.tsx",
    "src/app/admin/email/drafts/page.tsx",
    "src/app/admin/email/sent/page.tsx",
    "src/app/admin/email/queue/page.tsx",
    "src/app/admin/email/templates/page.tsx",
    "src/app/admin/email/reports/page.tsx",
    "src/app/admin/email/settings/page.tsx",
    "src/app/admin/email/[id]/page.tsx"
  ];
  const contents = await Promise.all(routes.map(file));

  for (const [index, content] of contents.entries()) {
    assert.ok(content.length > 300, `${routes[index]} is still a placeholder`);
  }
});

test("email visual system covers status tokens, light theme and responsive breakpoints", async () => {
  const css = await file("src/app/admin/email/email-center.css");

  for (const token of [
    "--email-status-sent",
    "--email-status-opened",
    "--email-status-replied",
    "--email-status-viewed",
    "--email-status-scheduled",
    "--email-status-draft",
    "--email-status-failed",
    "--email-status-pending"
  ]) {
    assert.match(css, new RegExp(token));
  }
  assert.match(css, /\.admin-v2-light \.email-center/);
  assert.match(css, /@media \(max-width: 1220px\)/);
  assert.match(css, /@media \(max-width: 960px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(max-width: 410px\)/);
  assert.doesNotMatch(css, /background(?:-color)?:\s*(?:white|#fff(?:fff)?)(?:;|\s)/i);
});

test("email operations do not resend sent messages or reuse idempotency keys", async () => {
  const actions = await file("src/app/admin/email/actions.ts");

  assert.match(actions, /\.in\("status", \["draft", "scheduled", "queued", "retry_pending"\]\)/);
  assert.match(actions, /idempotency_key: randomToken\(24\)/);
  assert.match(actions, /mode: "system_draft"/);
  assert.match(actions, /status: "draft"/);
  assert.match(actions, /source\.subject === "ARO — Código de verificação"/);
  assert.doesNotMatch(actions, /\.eq\("status", "sent"\)[^]*\.update/);
});

test("email sidebar order keeps one Email Center entry and no duplicate shell", async () => {
  const shell = await file("src/components/admin/admin-shell-v2.tsx");
  const labels = [
    "Dashboard",
    "Models",
    "Presentations",
    "Clients",
    "Agencies",
    "Jobs",
    "Accounting",
    "Travel",
    "Calendar",
    "Email Center",
    "Settings"
  ];
  let lastIndex = -1;
  for (const label of labels) {
    const index = shell.indexOf(`label: "${label}"`);
    assert.ok(index > lastIndex, `${label} is out of order`);
    lastIndex = index;
  }
  assert.equal(shell.match(/label: "Email Center"/g)?.length, 1);
});
