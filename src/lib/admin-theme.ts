export const ADMIN_THEME_STORAGE_KEY = "aro-admin-theme";

export type AdminThemePreference = "system" | "light" | "dark";
export type ResolvedAdminTheme = Exclude<AdminThemePreference, "system">;

type AdminThemeStorage = Pick<Storage, "getItem" | "setItem">;
type AdminThemeMediaQuery = Pick<
  MediaQueryList,
  "matches" | "addEventListener" | "removeEventListener"
>;

export function isAdminThemePreference(value: string | null): value is AdminThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function resolveAdminTheme(
  preference: AdminThemePreference,
  prefersLight: boolean
): ResolvedAdminTheme {
  if (preference === "system") return prefersLight ? "light" : "dark";
  return preference;
}

export function readAdminThemePreference(
  storage: Pick<AdminThemeStorage, "getItem">
): AdminThemePreference {
  try {
    const storedTheme = storage.getItem(ADMIN_THEME_STORAGE_KEY);
    return isAdminThemePreference(storedTheme) ? storedTheme : "system";
  } catch {
    return "system";
  }
}

export function persistAdminThemePreference(
  storage: Pick<AdminThemeStorage, "setItem">,
  preference: AdminThemePreference
) {
  try {
    storage.setItem(ADMIN_THEME_STORAGE_KEY, preference);
    return true;
  } catch {
    return false;
  }
}

export function subscribeToSystemTheme(
  mediaQuery: AdminThemeMediaQuery,
  onChange: (theme: ResolvedAdminTheme) => void
) {
  const syncTheme = () => onChange(resolveAdminTheme("system", mediaQuery.matches));

  syncTheme();
  mediaQuery.addEventListener("change", syncTheme);

  return () => mediaQuery.removeEventListener("change", syncTheme);
}

export const ADMIN_THEME_BOOTSTRAP_SCRIPT = `(() => {
  const shell = document.currentScript?.parentElement;
  if (!shell) return;

  let preference = "system";
  try {
    const storedTheme = window.localStorage.getItem("${ADMIN_THEME_STORAGE_KEY}");
    if (storedTheme === "system" || storedTheme === "light" || storedTheme === "dark") {
      preference = storedTheme;
    }
  } catch {}

  const prefersLight =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: light)").matches;
  const resolvedTheme =
    preference === "system" ? (prefersLight ? "light" : "dark") : preference;

  shell.classList.remove("admin-v2-light", "admin-v2-dark");
  shell.classList.add("admin-v2-" + resolvedTheme);
  shell.dataset.themePreference = preference;
})();`;
