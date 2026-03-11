/** Runtime config injected by backend into window.__APP_CONFIG__ */
interface AppConfig {
  merchantName?: string;
  merchantLogoUrl?: string;
  projectId?: string;
  ankrApiToken?: string;
}

declare global {
  interface Window {
    __APP_CONFIG__?: AppConfig;
  }
}

/**
 * Returns a runtime config value from window.__APP_CONFIG__.
 * Values that look like unresolved placeholders (%...%) are treated as empty.
 */
function fromAppConfig<K extends keyof AppConfig>(key: K): string {
  const value = window.__APP_CONFIG__?.[key];
  if (typeof value === "string" && value && !value.startsWith("%")) {
    return value;
  }
  return "";
}

/**
 * Resolve config value: window.__APP_CONFIG__ (backend) → import.meta.env (build-time) → ''
 */
export function runtimeConfig(
  appConfigKey: keyof AppConfig,
  envValue: string = "",
): string {
  return fromAppConfig(appConfigKey) || envValue || "";
}
