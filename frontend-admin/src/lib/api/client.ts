import { ApiFailure, ApiSuccess } from "./types";
import { getCsrfToken } from "@/lib/csrf";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

const MUTATING_METHODS = new Set(["POST", "PATCH", "DELETE", "PUT"]);

export class ApiClientError extends Error {
  details?: unknown;
  status: number;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Every request carries `credentials: "include"` — the httpOnly session
 * cookie rides along automatically on same-site requests, this app never
 * touches it directly. Mutating requests additionally get the CSRF header
 * the backend requires for exactly this reason: with auth on a cookie, the
 * browser attaches it to a same-site request regardless of which page
 * triggered that request, so the API needs a second signal that only *this*
 * app's own JavaScript could have produced.
 */
function buildRequestInit(method: string, options: RequestOptions): RequestInit {
  const { body, headers, ...rest } = options;
  const csrfToken = getCsrfToken();

  return {
    ...rest,
    method,
    credentials: "include",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(MUTATING_METHODS.has(method) && csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  };
}

async function request<T>(path: string, method: string, options: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, buildRequestInit(method, options));
  const json = (await res.json().catch(() => null)) as ApiSuccess<T> | ApiFailure | null;

  if (!res.ok || !json || !json.success) {
    const message = json && "error" in json ? json.error.message : `Yêu cầu thất bại (${res.status})`;
    const details = json && "error" in json ? json.error.details : undefined;
    throw new ApiClientError(message, res.status, details);
  }

  return json.data;
}

async function requestPaginated<T>(path: string, method: string, options: RequestOptions = {}): Promise<Paginated<T>> {
  const res = await fetch(`${API_URL}${path}`, buildRequestInit(method, options));
  const json = (await res.json().catch(() => null)) as
    | (ApiSuccess<T[]> & { pagination: NonNullable<ApiSuccess<T[]>["pagination"]> })
    | ApiFailure
    | null;

  if (!res.ok || !json || !json.success) {
    const message = json && "error" in json ? json.error.message : `Yêu cầu thất bại (${res.status})`;
    throw new ApiClientError(message, res.status);
  }

  return { items: json.data, ...json.pagination };
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, "GET", options),
  getPaginated: <T>(path: string, options?: RequestOptions) => requestPaginated<T>(path, "GET", options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, "POST", { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, "PATCH", { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, "DELETE", options),
};
