import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

/**
 * The cookie + CSRF auth flow, exercised over real HTTP against the real
 * Express app — not stubbed. Cookie attributes (`HttpOnly`, `SameSite`,
 * `Path`, `Max-Age`) are serialized by Express's own `res.cookie()`, so
 * asserting them faithfully means reading the actual `Set-Cookie` response
 * header rather than mocking `res`.
 *
 * This is the test that would have caught the very failure mode the whole
 * redesign exists to prevent: a JWT sitting somewhere `document.cookie` or
 * `localStorage` can reach.
 *
 * Skipped automatically when no replica set is reachable (same convention as
 * checkout.integration.test.ts); run `docker compose up -d mongo` to include it.
 */

const TEST_URI =
  process.env.MONGODB_TEST_URI ?? "mongodb://127.0.0.1:27017/lylaglass_test?replicaSet=rs0&directConnection=true";

// env.ts snapshots process.env at import time.
process.env.MONGODB_URI = TEST_URI;
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.CSRF_SECRET = "test-csrf-secret";
process.env.CORS_ORIGINS = "http://storefront.test,http://admin.test";
process.env.ADMIN_URL = "http://admin.test";
process.env.ADMIN_COOKIE_DOMAIN = "";
process.env.VIETQR_ACCOUNT_NUMBER = "0338123456789";
process.env.VIETQR_ACCOUNT_NAME = "LYLAGLASS TEST";
process.env.VIETQR_BANK_BIN = "970423";
process.env.EMAIL_PROVIDER = "log";
process.env.PAYMENT_TTL_MINUTES = "15";

async function replicaSetAvailable(): Promise<boolean> {
  try {
    const probe = await mongoose.createConnection(TEST_URI, { serverSelectionTimeoutMS: 2000 }).asPromise();
    const info = (await probe.db!.admin().command({ hello: 1 })) as { setName?: string };
    await probe.close();
    return Boolean(info.setName);
  } catch {
    return false;
  }
}

const available = await replicaSetAvailable();
const suite = available ? describe : describe.skip;
if (!available) {
  // eslint-disable-next-line no-console
  console.warn(`[skip] Không kết nối được replica set tại ${TEST_URI} — bỏ qua integration test.`);
}

/** Parses one `Set-Cookie` entry into its name, value and attribute map. */
function parseCookie(setCookieLine: string) {
  const [pair, ...attrParts] = setCookieLine.split(";").map((s) => s.trim());
  const [name, value] = pair.split("=");
  const attrs: Record<string, string | true> = {};
  for (const part of attrParts) {
    const [key, val] = part.split("=");
    attrs[key.toLowerCase()] = val ?? true;
  }
  return { name, value, attrs };
}

function findCookie(setCookieHeader: string[] | undefined, name: string) {
  const line = setCookieHeader?.find((c) => c.startsWith(`${name}=`));
  return line ? parseCookie(line) : undefined;
}

suite("admin auth: cookie + CSRF over real HTTP", async () => {
  const { connectDatabase, disconnectDatabase, ensureCriticalIndexes } = await import("@/config/db");
  const { createApp } = await import("@/app");
  const { AdminUserModel } = await import("@/models/AdminUser.model");
  const { CouponModel } = await import("@/models/Coupon.model");

  const ADMIN_EMAIL = "owner@lylaglass.test";
  const ADMIN_PASSWORD = "correct horse battery staple";
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    await connectDatabase();
    await ensureCriticalIndexes();
    app = createApp();

    await AdminUserModel.deleteMany({ email: ADMIN_EMAIL });
    await AdminUserModel.create({
      name: "Test Owner",
      email: ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 4),
      role: "owner",
      isActive: true,
    });
  });

  afterEach(async () => {
    await CouponModel.deleteMany({});
  });

  afterAll(async () => {
    await AdminUserModel.deleteMany({ email: ADMIN_EMAIL });
    await disconnectDatabase();
  });

  /** Logs in and returns everything a browser would have after that response. */
  async function login() {
    const res = await request(app).post("/api/admin/auth/login").send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    const cookie = findCookie(res.headers["set-cookie"], "admin_token");
    return { res, cookie, cookieHeader: `admin_token=${cookie?.value}`, csrfToken: res.body.data.csrfToken as string };
  }

  describe("login", () => {
    it("never puts the JWT in the response body", async () => {
      const { res } = await login();

      expect(res.status).toBe(200);
      expect(res.body.data).not.toHaveProperty("token");
      expect(JSON.stringify(res.body)).not.toContain(".ey"); // no JWT-shaped substring anywhere
    });

    it("sets the session cookie as HttpOnly, SameSite=Lax, Path=/, with no wide Domain", async () => {
      const { cookie } = await login();

      expect(cookie).toBeTruthy();
      expect(cookie!.attrs.httponly).toBe(true);
      expect(String(cookie!.attrs.samesite).toLowerCase()).toBe("lax");
      expect(cookie!.attrs.path).toBe("/");
      // Host-only by default in this test env (ADMIN_COOKIE_DOMAIN unset) —
      // this is exactly the property that keeps the storefront from ever
      // being able to read it, even via document.cookie.
      expect(cookie!.attrs.domain).toBeUndefined();
    });

    it("sets Max-Age matching JWT_EXPIRES_IN, not left at the http-cookie default (session cookie)", async () => {
      const { cookie } = await login();
      const maxAge = Number(cookie!.attrs["max-age"]);

      // Default JWT_EXPIRES_IN is 7d = 604800s; allow slack for test runtime.
      expect(maxAge).toBeGreaterThan(604_000);
      expect(maxAge).toBeLessThanOrEqual(604_800);
    });

    it("rejects a wrong password without setting any cookie", async () => {
      const res = await request(app)
        .post("/api/admin/auth/login")
        .send({ email: ADMIN_EMAIL, password: "wrong password entirely" });

      expect(res.status).toBe(401);
      expect(res.headers["set-cookie"]).toBeUndefined();
    });

    it("returns a CSRF token the client can hold in memory", async () => {
      const { res } = await login();
      expect(typeof res.body.data.csrfToken).toBe("string");
      expect(res.body.data.csrfToken.length).toBeGreaterThan(10);
    });
  });

  describe("GET /me — session check on page load", () => {
    it("rejects a request with no cookie at all", async () => {
      const res = await request(app).get("/api/admin/auth/me");
      expect(res.status).toBe(401);
    });

    it("rejects a garbage cookie value the same as no cookie", async () => {
      const res = await request(app).get("/api/admin/auth/me").set("Cookie", "admin_token=not-a-real-jwt");
      expect(res.status).toBe(401);
    });

    it("accepts the cookie from login and re-issues a (usable) CSRF token", async () => {
      const { cookieHeader } = await login();
      const res = await request(app).get("/api/admin/auth/me").set("Cookie", cookieHeader);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(ADMIN_EMAIL);
      expect(typeof res.body.data.csrfToken).toBe("string");
    });
  });

  describe("CSRF protection on state-changing admin routes", () => {
    it("rejects a mutating request that has the valid session cookie but no CSRF header", async () => {
      const { cookieHeader } = await login();

      const res = await request(app)
        .post("/api/coupons/admin")
        .set("Cookie", cookieHeader)
        .send({ code: "NOCSRF", type: "fixed", value: 10_000 });

      expect(res.status).toBe(403);
      expect(await CouponModel.countDocuments({ code: "NOCSRF" })).toBe(0);
    });

    it("rejects a mutating request with a well-formed but wrong CSRF token", async () => {
      const { cookieHeader } = await login();

      const res = await request(app)
        .post("/api/coupons/admin")
        .set("Cookie", cookieHeader)
        .set("X-CSRF-Token", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd")
        .send({ code: "BADCSRF", type: "fixed", value: 10_000 });

      expect(res.status).toBe(403);
      expect(await CouponModel.countDocuments({ code: "BADCSRF" })).toBe(0);
    });

    it("accepts a mutating request that carries both the cookie and the matching CSRF token", async () => {
      const { cookieHeader, csrfToken } = await login();

      const res = await request(app)
        .post("/api/coupons/admin")
        .set("Cookie", cookieHeader)
        .set("X-CSRF-Token", csrfToken)
        .send({ code: "GOODCSRF", type: "fixed", value: 10_000 });

      expect(res.status).toBe(201);
      expect(await CouponModel.countDocuments({ code: "GOODCSRF" })).toBe(1);
    });

    it("a CSRF token from a DIFFERENT session cannot authorize this one (proves the token is bound to the session, not a global secret)", async () => {
      const { cookieHeader: cookieA } = await login();
      const { csrfToken: csrfTokenB } = await login(); // a second, independent login

      const res = await request(app)
        .post("/api/coupons/admin")
        .set("Cookie", cookieA)
        .set("X-CSRF-Token", csrfTokenB)
        .send({ code: "CROSSSESSION", type: "fixed", value: 10_000 });

      // Two logins for the same admin get different `jti`, hence different
      // derived tokens — so this must fail even though both are "genuine"
      // tokens the same user legitimately received at some point.
      expect(res.status).toBe(403);
    });

    it("still rejects with no cookie at all, regardless of CSRF header", async () => {
      const res = await request(app)
        .post("/api/coupons/admin")
        .set("X-CSRF-Token", "irrelevant")
        .send({ code: "NOCOOKIE", type: "fixed", value: 10_000 });

      // requireAdmin runs first — no session means no CSRF check is even reached.
      expect(res.status).toBe(401);
    });
  });

  describe("logout", () => {
    it("clears the cookie (Expires in the past) with matching attributes", async () => {
      const res = await request(app).post("/api/admin/auth/logout");
      const cookie = findCookie(res.headers["set-cookie"], "admin_token");

      // Express's res.clearCookie() clears via `Expires` in the past, not
      // `Max-Age=0` — both achieve the same browser behaviour, but asserting
      // the attribute Express actually sends is what proves the real header.
      expect(cookie).toBeTruthy();
      expect(new Date(String(cookie!.attrs.expires)).getTime()).toBeLessThan(Date.now());
      expect(cookie!.attrs.httponly).toBe(true);
      expect(String(cookie!.attrs.samesite).toLowerCase()).toBe("lax");
    });

    it("works even when called with no session (idempotent, never errors)", async () => {
      const res = await request(app).post("/api/admin/auth/logout");
      expect(res.status).toBe(200);
    });
  });

  describe("CORS", () => {
    it("reflects the admin app's origin and allows credentials", async () => {
      const res = await request(app).get("/api/categories").set("Origin", "http://admin.test");

      expect(res.headers["access-control-allow-origin"]).toBe("http://admin.test");
      expect(res.headers["access-control-allow-credentials"]).toBe("true");
    });

    it("reflects the storefront's origin but grants it NO credentials", async () => {
      // Regression test for a real bug caught with a live browser: a single
      // `cors()` instance with one static `credentials: true` for every
      // whitelisted origin let storefront-origin JavaScript read authenticated
      // admin responses too, because `credentials` cannot vary per origin
      // within one `cors` middleware call. The storefront is whitelisted for
      // plain reads (its own product/category calls carry no cookie), but it
      // must never be told `Access-Control-Allow-Credentials: true` — that
      // header is what a browser checks before exposing a credentialed
      // response's body to the calling page's script.
      const res = await request(app).get("/api/categories").set("Origin", "http://storefront.test");

      expect(res.headers["access-control-allow-origin"]).toBe("http://storefront.test");
      expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
    });

    it("does not reflect an origin outside the whitelist", async () => {
      const res = await request(app).get("/api/categories").set("Origin", "http://evil.test");

      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
      expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
    });

    it("does not require an Origin header at all for a same-machine / server-to-server call (the bank webhook's case)", async () => {
      // No .set("Origin", ...) — mirrors how SePay calls the webhook: no browser involved.
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
    });
  });

  describe("guest/storefront routes are unaffected", () => {
    it("public product listing works with no cookie and no CSRF header", async () => {
      const res = await request(app).get("/api/products");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("coupon validation (used at checkout) is not gated by CSRF", async () => {
      await CouponModel.create({ code: "PUBLICOK", type: "fixed", value: 5000, isActive: true });
      const res = await request(app).post("/api/coupons/validate").send({ code: "PUBLICOK", subtotal: 100_000 });
      expect(res.status).toBe(200);
    });
  });
});
