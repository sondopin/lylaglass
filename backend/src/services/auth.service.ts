import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "@/config/env";
import { ApiError } from "@/utils/ApiError";
import { adminUserRepository } from "@/repositories/adminUser.repository";

export async function loginAdmin(email: string, password: string) {
  const admin = await adminUserRepository.findByEmail(email);
  if (!admin || !admin.isActive) throw ApiError.unauthorized("Email hoặc mật khẩu không đúng");

  const isValid = await bcrypt.compare(password, admin.passwordHash);
  if (!isValid) throw ApiError.unauthorized("Email hoặc mật khẩu không đúng");

  const token = jwt.sign({ sub: String(admin._id), role: admin.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as SignOptions);

  await adminUserRepository.touchLastLogin(String(admin._id));

  return {
    token,
    admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
  };
}
