import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function file(path: string) {
  return readFile(path, "utf8");
}

test("admin select, date and month controls use hidden inputs and custom triggers", async () => {
  const controls = await file("src/components/admin/admin-controls.tsx");
  const ui = await file("src/components/admin/admin-ui.tsx");

  assert.match(controls, /AdminCustomSelect/);
  assert.match(controls, /AdminDateField/);
  assert.match(controls, /AdminMonthField/);
  assert.match(controls, /type="hidden"/);
  assert.match(controls, /className="admin-control-trigger"/);
  assert.match(controls, /role="listbox"/);
  assert.match(controls, /role="dialog"/);
  assert.match(controls, /event\.key === "Escape"/);
  assert.match(controls, /event\.key === "Enter"/);
  assert.doesNotMatch(ui, /<select/);
  assert.doesNotMatch(ui, /type="date"/);
});

test("models and accounting filters do not render native select date or month fields", async () => {
  const models = await file("src/app/admin/models/page.tsx");
  const accounting = await file("src/app/admin/accounting/page.tsx");

  assert.match(models, /AdminSelectField/);
  assert.match(accounting, /AdminMonthFilterField/);
  assert.match(accounting, /AdminDateField/);
  assert.doesNotMatch(models, /<select/);
  assert.doesNotMatch(accounting, /<select/);
  assert.doesNotMatch(accounting, /type="month"/);
  assert.doesNotMatch(accounting, /type="date"/);
});

test("admin typography tokens keep page titles and metrics compact", async () => {
  const css = await file("src/app/globals.css");

  assert.match(css, /--admin-font-page-title:\s*16px;/);
  assert.match(css, /--admin-font-section-title:\s*14px;/);
  assert.match(css, /--admin-font-body:\s*12px;/);
  assert.match(css, /--admin-font-label:\s*12px;/);
  assert.match(css, /--admin-font-button:\s*12px;/);
  assert.match(css, /--admin-font-table:\s*12px;/);
  assert.match(css, /--admin-font-metric:\s*16px;/);
  assert.match(
    css,
    new RegExp("\\.admin-v2 \\.admin-page :is\\(h1, h2\\)[^{]*\\{[^]*font-size: var\\(--admin-font-page-title\\) !important;")
  );
});

test("admin controls define no pure white field surfaces", async () => {
  const css = await file("src/app/globals.css");

  assert.match(css, /admin-control-trigger/);
  assert.match(css, /admin-control-popover/);
  assert.doesNotMatch(css, /admin-control-trigger[^}]*background:\s*(white|#fff|#ffffff)/i);
  assert.doesNotMatch(css, /admin-control-popover[^}]*background:\s*(white|#fff|#ffffff)/i);
});

test("admin appearance selector persists and resolves the device theme", async () => {
  const shell = await file("src/components/admin/admin-shell-v2.tsx");

  assert.match(shell, /const ADMIN_THEME_STORAGE_KEY = "aro-admin-theme"/);
  assert.match(shell, /window\.matchMedia\("\(prefers-color-scheme: light\)"\)/);
  assert.match(shell, /systemThemeQuery\.addEventListener\("change", syncSystemTheme\)/);
  assert.match(shell, /window\.localStorage\.getItem\(ADMIN_THEME_STORAGE_KEY\)/);
  assert.match(shell, /window\.localStorage\.setItem\(ADMIN_THEME_STORAGE_KEY, theme\)/);
  assert.match(shell, /theme === "system" \? systemTheme : theme/);
  assert.match(shell, /admin-v2-\$\{resolvedTheme\}/);
  for (const label of ["Sistema", "Claro", "Escuro"]) {
    assert.ok(shell.includes(`"${label}"`));
  }
});
