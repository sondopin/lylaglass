import { CookieOptions, Request, Response } from "express";
import { env } from "@/config/env";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/apiResponse";
import { computeCsrfToken } from "@/utils/csrf";
import { loginAdmin } from "@/services/auth.service";
import { adminUserRepository } from "@/repositories/adminUser.repository";
import { ApiError } from "@/utils/ApiError";

/**
 * Shared between setting and clearing the cookie: `res.clearCookie` only
 * actually removes the cookie in the browser if every attribute besides
 * `Max-Age`/`Expires` matches what it was set with, so both call sites must
 * stay in lock-step. `secure` is forced on outside development because
 * `SameSite=Lax` cross-site cookies (needed for the admin-app-to-API split)
 * require it — browsers ignore `SameSite` on an insecure cookie's context.
 */
function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? "none" : "lax",
    path: "/",
    ...(env.adminCookie.domain ? { domain: env.adminCookie.domain } : {}),
  };
}

export const adminLogin = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const { token, csrfToken, admin } = await loginAdmin(email, password);

  res.cookie(env.adminCookie.name, token, {
    ...cookieOptions(),
    maxAge: env.jwtExpiresInSeconds * 1000,
  });

  // The JWT itself never appears in the response body — only the cookie
  // carries it, so there is nothing here for admin-side JS to read and store.
  sendSuccess(res, { admin, csrfToken });
});

export const adminLogout = asyncHandler(async (_req: Request, res: Response) => {
  // Not gated behind requireAdmin: a browser with an already-expired or
  // corrupted cookie must still be able to clear it. Worst case if this is
  // called without a valid session is a harmless no-op clear.
  res.clearCookie(env.adminCookie.name, cookieOptions());
  sendSuccess(res, { loggedOut: true });
});

export const getCurrentAdmin = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized();
  const admin = await adminUserRepository.findById(req.admin.sub);
  if (!admin) throw ApiError.unauthorized();

  // Re-issued here too: a page reload wipes the admin app's in-memory copy of
  // the CSRF token (it is deliberately never persisted to localStorage), so
  // this is how it gets the token back without a fresh login.
  const csrfToken = computeCsrfToken({ sub: req.admin.sub, jti: req.admin.jti });

  sendSuccess(res, { id: admin._id, name: admin.name, email: admin.email, role: admin.role, csrfToken });
});
