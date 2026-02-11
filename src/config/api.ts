let _baseUrl: string | undefined;

export function getApiBaseUrl(): string {
  if (_baseUrl === undefined) {
    _baseUrl = globalThis.location.pathname.replace(/\/$/, "");
  }
  return _baseUrl;
}
