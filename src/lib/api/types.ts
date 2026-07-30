export type ApiFieldErrors = Record<string, string[]>;

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export interface NormalizedApiError {
  status: number;
  message: string;
  fieldErrors?: ApiFieldErrors;
  raw?: unknown;
}
