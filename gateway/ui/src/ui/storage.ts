/**
 * Local Storage for UI Settings
 */

export type UiSettings = {
  gatewayUrl: string;
  token: string;
  sessionKey: string;
  theme: "dark" | "light" | "system";
};

const STORAGE_KEY = "gsv-ui-settings";

const DEFAULT_SETTINGS: UiSettings = {
  gatewayUrl: "ws://localhost:8787/ws",
  token: "",
  sessionKey: "agent:main:web:dm:local",
  theme: "dark",
};

export function loadSettings(): UiSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: Partial<UiSettings>): void {
  try {
    const current = loadSettings();
    const next = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
}

export function applyTheme(theme: UiSettings["theme"]): void {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const effectiveTheme = theme === "system" ? (prefersDark ? "dark" : "light") : theme;
  document.documentElement.setAttribute("data-theme", effectiveTheme);
}
