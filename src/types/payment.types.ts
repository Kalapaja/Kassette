// ─── API Wrapper ───

export interface ApiError {
  category: string;
  code: string;
  message: string;
  details?: unknown;
}

export type ApiResponse<T> = { result: T } | { error: ApiError };
