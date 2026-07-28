import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import {
  ADMIN_THEME_BOOTSTRAP_SCRIPT,
  persistAdminThemePreference,
  readAdminThemePreference,
  resolveAdminTheme,
  subscribeToSystemTheme
} from "../src/lib/admin-theme";

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

test("admin system theme resolves both light and dark preferences", () => {
  assert.equal(resolveAdminTheme("system", true), "light");
  assert.equal(resolveAdminTheme("system", false), "dark");
  assert.equal(resolveAdminTheme("light", false), "light");
  assert.equal(resolveAdminTheme("dark", true), "dark");
});

test("admin theme bootstrap applies a validated preference before the shell content", async () => {
  const shell = await file("src/components/admin/admin-shell-v2.tsx");

  assert.match(shell, /suppressHydrationWarning/);
  assert.match(shell, /dangerouslySetInnerHTML=\{\{ __html: ADMIN_THEME_BOOTSTRAP_SCRIPT \}\}/);
  assert.ok(
    shell.indexOf("ADMIN_THEME_BOOTSTRAP_SCRIPT }}") < shell.indexOf('className="admin-v2-orb one"')
  );
  for (const label of ["Sistema", "Claro", "Escuro"]) {
    assert.ok(shell.includes(`"${label}"`));
  }
});

test("admin theme bootstrap handles stored, system and protected storage modes", () => {
  function runBootstrap(
    storedTheme: string | null,
    prefersLight: boolean,
    storageThrows = false
  ) {
    const classes = new Set(["admin-v2", "admin-v2-dark"]);
    const shell = {
      classList: {
        add: (...tokens: string[]) => tokens.forEach((token) => classes.add(token)),
        remove: (...tokens: string[]) => tokens.forEach((token) => classes.delete(token))
      },
      dataset: { themePreference: "system" }
    };

    vm.runInNewContext(ADMIN_THEME_BOOTSTRAP_SCRIPT, {
      document: { currentScript: { parentElement: shell } },
      window: {
        localStorage: {
          getItem: () => {
            if (storageThrows) throw new Error("storage blocked");
            return storedTheme;
          }
        },
        matchMedia: () => ({ matches: prefersLight })
      }
    });

    return { classes, preference: shell.dataset.themePreference };
  }

  const storedLight = runBootstrap("light", false);
  assert.equal(storedLight.classes.has("admin-v2-light"), true);
  assert.equal(storedLight.preference, "light");

  const systemDark = runBootstrap("system", false);
  assert.equal(systemDark.classes.has("admin-v2-dark"), true);
  assert.equal(systemDark.preference, "system");

  const systemLight = runBootstrap("system", true);
  assert.equal(systemLight.classes.has("admin-v2-light"), true);

  const invalidPreference = runBootstrap("purple", true);
  assert.equal(invalidPreference.classes.has("admin-v2-light"), true);
  assert.equal(invalidPreference.preference, "system");

  const protectedStorage = runBootstrap(null, false, true);
  assert.equal(protectedStorage.classes.has("admin-v2-dark"), true);
  assert.equal(protectedStorage.preference, "system");
});

test("admin theme storage remains protected and persistent", () => {
  let storedValue: string | null = null;
  const storage = {
    getItem: () => storedValue,
    setItem: (_key: string, value: string) => {
      storedValue = value;
    }
  };

  assert.equal(persistAdminThemePreference(storage, "light"), true);
  assert.equal(readAdminThemePreference(storage), "light");
  assert.equal(
    readAdminThemePreference({
      getItem: () => {
        throw new Error("storage blocked");
      }
    }),
    "system"
  );
  assert.equal(
    persistAdminThemePreference(
      {
        setItem: () => {
          throw new Error("storage blocked");
        }
      },
      "dark"
    ),
    false
  );
});

test("admin system theme listener reacts and removes the registered callback", () => {
  let prefersLight = false;
  const listeners: {
    registered?: (event: MediaQueryListEvent) => void;
    removed?: (event: MediaQueryListEvent) => void;
  } = {};
  const mediaQuery = {
    get matches() {
      return prefersLight;
    },
    addEventListener: (_type: "change", listener: (event: MediaQueryListEvent) => void) => {
      listeners.registered = listener;
    },
    removeEventListener: (_type: "change", listener: (event: MediaQueryListEvent) => void) => {
      listeners.removed = listener;
    }
  } as unknown as Parameters<typeof subscribeToSystemTheme>[0];
  const receivedThemes: string[] = [];

  const cleanup = subscribeToSystemTheme(mediaQuery, (theme) => receivedThemes.push(theme));
  assert.deepEqual(receivedThemes, ["dark"]);

  prefersLight = true;
  const registeredListener = listeners.registered;
  assert.ok(registeredListener);
  registeredListener({ matches: true } as MediaQueryListEvent);
  assert.deepEqual(receivedThemes, ["dark", "light"]);

  cleanup();
  assert.equal(listeners.removed, registeredListener);
});
