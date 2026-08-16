import { ApiFailure, ApiSuccess } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

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
  token?: string;
  /** Forwarded to fetch's `cache` (server components); ignored on the client. */
  cache?: RequestCache;
  next?: { revalidate?: number | false; tags?: string[] };
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, token, headers, ...rest } = options;

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json().catch(() => null)) as ApiSuccess<T> | ApiFailure | null;

  if (!res.ok || !json || !json.success) {
    const message = json && "error" in json ? json.error.message : `Yêu cầu thất bại (${res.status})`;
    const details = json && "error" in json ? json.error.details : undefined;
    throw new ApiClientError(message, res.status, details);
  }

  return json.data;
}

async function requestPaginated<T>(path: string, options: RequestOptions = {}): Promise<Paginated<T>> {
  const { body, token, headers, ...rest } = options;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json().catch(() => null)) as (ApiSuccess<T[]> & { pagination: NonNullable<ApiSuccess<T[]>["pagination"]> }) | ApiFailure | null;

  if (!res.ok || !json || !json.success) {
    const message = json && "error" in json ? json.error.message : `Yêu cầu thất bại (${res.status})`;
    throw new ApiClientError(message, res.status);
  }

  return { items: json.data, ...json.pagination };
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
  getPaginated: <T>(path: string, options?: RequestOptions) => requestPaginated<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "DELETE" }),
};
