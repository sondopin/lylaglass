import crypto from "node:crypto";
import { env } from "@/config/env";
import { safeEqual } from "./safeEqual";

/**
 * Synchronizer-token CSRF defense — deliberately *not* the classic
 * double-submit-cookie pattern.
 *
 * Double-submit-cookie requires the browser to hand the token back to
 * JavaScript via a *readable* cookie, which only works cleanly when the SPA
 * and the API sit on the exact same origin (or a cookie is widened to a
 * shared parent domain). This project puts the admin app and the API on
 * separate origins on purpose, and widening the cookie to share it with the
 * storefront would let a storefront XSS read the CSRF token too — defeating
 * the entire reason for splitting the app out.
 *
 * Instead, the token is *derived* from data already inside the verified JWT
 * (`sub` + `jti`) via HMAC, using a secret the browser never sees. It is
 * handed to the client exactly twice — in the login response body and in
 * `GET /admin/auth/me` — both of which require the httpOnly session cookie
 * to already be attached and are only reachable, per CORS, from the admin
 * app's own whitelisted origin. A page on another origin can trigger a
 * request to these endpoints (the cookie rides along automatically), but the
 * browser will not let that page's script read the JSON response, so the
 * token itself never reaches an attacker. No server-side token storage is
 * needed: verifying a request is just recomputing the same HMAC and
 * comparing.
 *
 * `jti` (a random id generated once at sign time — see auth.service.ts) is
 * used rather than `iat`: `iat` is second-granularity, so two logins by the
 * same admin within the same second would derive the *same* CSRF token. That
 * is not a cross-user vulnerability (both sessions belong to the same
 * legitimate admin), but it is an easy-to-avoid footgun — a random `jti`
 * makes every login's token unique regardless of timing.
 */

export interface CsrfSubject {
  sub: string;
  /** Random per-login identifier — the JWT's own `jti` claim. */
  jti: string;
}

const CSRF_HEADER = "x-csrf-token";

export function computeCsrfToken({ sub, jti }: CsrfSubject): string {
  return crypto.createHmac("sha256", env.csrfSecret).update(`${sub}.${jti}`).digest("hex");
}

export function verifyCsrfToken(subject: CsrfSubject, presented: string | undefined): boolean {
  if (!presented) return false;
  return safeEqual(presented, computeCsrfToken(subject));
}

export function readCsrfHeader(headers: Record<string, string | string[] | undefined>): string | undefined {
  const raw = headers[CSRF_HEADER];
  return Array.isArray(raw) ? raw[0] : raw;
}
