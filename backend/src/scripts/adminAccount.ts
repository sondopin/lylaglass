/**
 * Admin account maintenance.
 *
 * Exists because `npm run seed` deliberately never touches an existing admin:
 * re-seeding must not silently reset a password that is already in use. That
 * makes changing `ADMIN_SEED_PASSWORD` after the first seed a no-op, which
 * looks exactly like "wrong email or password" at the login screen.
 *
 *   npm run admin              -> report what exists and whether the password
 *                                 in .env matches (checks only, changes nothing)
 *   npm run admin -- --reset   -> create the admin, or set its password to
 *                                 ADMIN_SEED_PASSWORD
 *
 * Optional overrides: `--email=<address>` and `--password=<value>`.
 * The password itself is never printed or logged.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectDatabase, disconnectDatabase, ensureCriticalIndexes } from "@/config/db";
import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { AdminUserModel } from "@/models/AdminUser.model";

const BCRYPT_ROUNDS = 10;

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const shouldReset = process.argv.includes("--reset");
  const email = (argValue("email") ?? env.adminSeedEmail).trim().toLowerCase();
  const password = argValue("password") ?? env.adminSeedPassword;

  if (!email) throw new Error("Thiếu email: đặt ADMIN_SEED_EMAIL hoặc truyền --email=<địa chỉ>");
  if (!password) throw new Error("Thiếu mật khẩu: đặt ADMIN_SEED_PASSWORD hoặc truyền --password=<mật khẩu>");

  await connectDatabase();
  await ensureCriticalIndexes();

  const existing = await AdminUserModel.findOne({ email });

  if (!existing) {
    if (!shouldReset) {
      logger.warn({ email }, "Chưa có tài khoản admin nào với email này. Chạy lại với --reset để tạo.");
      return;
    }

    await AdminUserModel.create({
      name: "LylaGlass Admin",
      email,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      role: "owner",
      isActive: true,
    });
    logger.info({ email }, "Đã TẠO tài khoản admin. Đăng nhập bằng mật khẩu trong ADMIN_SEED_PASSWORD.");
    return;
  }

  const matches = await bcrypt.compare(password, existing.passwordHash);

  if (!shouldReset) {
    logger.info(
      {
        email: existing.email,
        role: existing.role,
        isActive: existing.isActive,
        createdAt: existing.createdAt,
        passwordMatchesEnv: matches,
      },
      matches
        ? "Tài khoản admin tồn tại và mật khẩu trong .env là ĐÚNG."
        : "Tài khoản admin tồn tại nhưng mật khẩu trong .env KHÔNG khớp. Chạy lại với --reset để đặt lại."
    );
    return;
  }

  // An inactive account fails login before the password is even checked, so a
  // reset restores both together — otherwise "password reset" would appear to
  // do nothing.
  existing.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  existing.isActive = true;
  await existing.save();

  logger.info({ email: existing.email }, "Đã ĐẶT LẠI mật khẩu admin theo ADMIN_SEED_PASSWORD.");
}

main()
  .catch((err) => {
    logger.error({ err }, "Thao tác tài khoản admin thất bại");
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
