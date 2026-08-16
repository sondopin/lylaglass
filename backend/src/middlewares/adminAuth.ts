import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "@/config/env";
import { ApiError } from "@/utils/ApiError";
import { AdminUserModel } from "@/models/AdminUser.model";

export interface AdminAuthPayload {
  sub: string;
  role: "owner" | "staff";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminAuthPayload;
    }
  }
}

export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw ApiError.unauthorized();

    const token = header.slice("Bearer ".length);
    const payload = jwt.verify(token, env.jwtSecret) as AdminAuthPayload;

    const admin = await AdminUserModel.findById(payload.sub).lean();
    if (!admin || !admin.isActive) throw ApiError.unauthorized("Tài khoản không còn hiệu lực");

    req.admin = payload;
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    next(ApiError.unauthorized("Token không hợp lệ hoặc đã hết hạn"));
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
