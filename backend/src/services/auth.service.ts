import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "@/config/env";
import { ApiError } from "@/utils/ApiError";
import { adminUserRepository } from "@/repositories/adminUser.repository";
import { computeCsrfToken } from "@/utils/csrf";

export interface AdminSession {
  token: string;
  csrfToken: string;
  admin: { id: unknown; name: string; email: string; role: "owner" | "staff" };
}

export async function loginAdmin(email: string, password: string): Promise<AdminSession> {
  const admin = await adminUserRepository.findByEmail(email);
  if (!admin || !admin.isActive) throw ApiError.unauthorized("Email hoặc mật khẩu không đúng");

  const isValid = await bcrypt.compare(password, admin.passwordHash);
  if (!isValid) throw ApiError.unauthorized("Email hoặc mật khẩu không đúng");

  // A random per-login id, independent of `iat` (which is only second-precision
  // and would collide between two logins in the same second) — this is what
  // the derived CSRF token is keyed on, so every login gets its own token.
  const jti = crypto.randomUUID();
  const sub = String(admin._id);

  const token = jwt.sign({ sub, role: admin.role, jti }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as SignOptions);

  await adminUserRepository.touchLastLogin(sub);

  return {
    token,
    csrfToken: computeCsrfToken({ sub, jti }),
    admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
  };
}
