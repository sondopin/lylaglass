import { NextFunction, Request, Response } from "express";
import { ApiError } from "@/utils/ApiError";
import { readCsrfHeader, verifyCsrfToken } from "@/utils/csrf";

/**
 * Rejects a state-changing admin request unless it carries the CSRF token
 * derived from the caller's own session (see `utils/csrf.ts` for why this is
 * a synchronizer token rather than a double-submit cookie).
 *
 * Must run *after* `requireAdmin` — it reads `req.admin`, which is only
 * populated once the session cookie has been verified. Applied only to
 * mutating admin routes (POST/PATCH/DELETE): GET requests cannot be
 * meaningfully forged for state-changing effect, and gating them too would
 * only add friction with no protective value.
 */
export function requireCsrf(req: Request, _res: Response, next: NextFunction) {
  if (!req.admin) {
    // Programmer error (route wiring), not a client-facing case — requireAdmin
    // must run first for this check to mean anything.
    return next(ApiError.internal());
  }

  const presented = readCsrfHeader(req.headers);
  const valid = verifyCsrfToken({ sub: req.admin.sub, jti: req.admin.jti }, presented);
  if (!valid) {
    return next(ApiError.forbidden("Thiếu hoặc sai CSRF token, vui lòng tải lại trang và thử lại"));
  }
  next();
}
