/**
 * Holds the CSRF token in memory only — never in `localStorage` or
 * `sessionStorage`, and never as a cookie. The backend hands it out exactly
 * twice: in the login response body, and in `GET /admin/auth/me` (used on
 * page load to recover it after a reload wipes this module's state, since
 * the session itself lives in an httpOnly cookie the token cannot be derived
 * from client-side).
 *
 * See `backend/src/utils/csrf.ts` for why this is a synchronizer token
 * rather than a cookie-readable double-submit token: the API and this app
 * are deliberately on separate origins, which is exactly the setup where a
 * cookie-based CSRF token cannot be made both readable by this app and
 * unreadable by the storefront at the same time.
 */

let currentToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  currentToken = token;
}

export function getCsrfToken(): string | null {
  return currentToken;
}
