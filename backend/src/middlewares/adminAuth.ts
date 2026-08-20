import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "@/config/env";
import { ApiError } from "@/utils/ApiError";
import { AdminUserModel } from "@/models/AdminUser.model";

export interface AdminAuthPayload {
  sub: string;
  role: "owner" | "staff";
  /** Random per-login id — also the CSRF token's key material (see utils/csrf.ts). */
  jti: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminAuthPayload;
    }
  }
}

/**
 * Reads the session from the httpOnly `admin_token` cookie rather than an
 * `Authorization` header — the admin app never sees the raw JWT at all, so
 * there is nothing for an XSS on it (or anywhere else) to read out of
 * `localStorage`/`document.cookie` and exfiltrate.
 */
export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[env.adminCookie.name];
    if (!token) throw ApiError.unauthorized();

    const payload = jwt.verify(token, env.jwtSecret) as AdminAuthPayload;

    const admin = await AdminUserModel.findById(payload.sub).lean();
    if (!admin || !admin.isActive) throw ApiError.unauthorized("Tài khoản không còn hiệu lực");

    req.admin = payload;
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    next(ApiError.unauthorized("Phiên đăng nhập không hợp lệ hoặc đã hết hạn"));
  }
}

export function requireRole(...roles: Array<"owner" | "staff">) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.admin || !roles.includes(req.admin.role)) {
      return next(ApiError.forbidden());
    }
    next();
  };
}
