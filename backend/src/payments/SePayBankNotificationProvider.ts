import crypto from "node:crypto";
import { ApiError } from "@/utils/ApiError";
import { logger } from "@/config/logger";
import { safeEqual } from "@/utils/safeEqual";
import { sePayWebhookSchema } from "@/validators/payment.validators";
import { BankNotificationProvider, BankTransactionEvent } from "./BankNotificationProvider";

export interface SePayAuthConfig {
  /** "hmac" (recommended) or "apikey". */
  mode: "hmac" | "apikey";
  /** Shared secret for HMAC-SHA256 mode. */
  secret: string;
  /** Key SePay sends as `Authorization: Apikey <key>` in apikey mode. */
  apiKey: string;
  /** Replay window for signed requests, in seconds. */
  timestampToleranceSeconds: number;
}

const SIGNATURE_HEADER = "x-sepay-signature";
const TIMESTAMP_HEADER = "x-sepay-timestamp";
const SIGNATURE_PREFIX = "sha256=";

function headerValue(headers: Record<string, string | string[] | undefined>, name: string): string {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0] ?? "";
  return raw ?? "";
}

/**
 * Parses SePay's "YYYY-MM-DD HH:mm:ss" timestamp, which is Vietnam local time
 * (UTC+7). Treating it as UTC would shift every transaction by 7 hours and
 * break expiry comparisons, so the offset is applied explicitly.
 */
export function parseSePayTransactionDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) return new Date();
  const [, y, mo, d, h, mi, s] = match;
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}+07:00`);
}

/**
 * SePay watches the shop's TPBank account and POSTs every balance change to us.
 * This class is the only place that trusts nothing: it authenticates the
 * request, validates the payload shape, and normalises it. Deciding whether the
 * transfer settles an order happens in payment.service.
 *
 * Docs: https://docs.sepay.vn/tich-hop-webhooks.html
 *       https://developer.sepay.vn/vi/sepay-webhooks/xac-thuc
 */
export class SePayBankNotificationProvider implements BankNotificationProvider {
  readonly name = "sepay";

  constructor(private readonly auth: SePayAuthConfig) {}

  async verifyAndParse(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>
  ): Promise<BankTransactionEvent> {
    this.authenticate(rawBody, headers);

    let json: unknown;
    try {
      json = JSON.parse(rawBody.toString("utf-8"));
    } catch {
      throw ApiError.badRequest("Payload webhook không phải JSON hợp lệ");
    }

    const parsed = sePayWebhookSchema.safeParse(json);
    if (!parsed.success) {
      logger.warn(
        { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
        "Bank webhook payload không đúng schema"
      );
      throw ApiError.badRequest("Payload webhook không đúng định dạng");
    }

    const data = parsed.data;
    return {
      transactionId: data.id,
      gateway: data.gateway,
      accountNumber: data.accountNumber,
      subAccount: data.subAccount,
      transferType: data.transferType,
      transferAmount: data.transferAmount,
      accumulated: data.accumulated,
      code: data.code,
      content: data.content,
      description: data.description,
      referenceCode: data.referenceCode,
      transactionDate: parseSePayTransactionDate(data.transactionDate),
      raw: data,
    };
  }

  /** Throws 401 unless the request proves it came from SePay. */
  private authenticate(rawBody: Buffer, headers: Record<string, string | string[] | undefined>) {
    if (this.auth.mode === "apikey") {
      if (!this.auth.apiKey) throw ApiError.internal("Webhook ngân hàng chưa được cấu hình khoá xác thực");
      // SePay sends: `Authorization: Apikey <key>`
      const authorization = headerValue(headers, "authorization");
      const [scheme, ...rest] = authorization.trim().split(/\s+/);
      const presented = rest.join(" ");
      if (scheme.toLowerCase() !== "apikey" || !safeEqual(presented, this.auth.apiKey)) {
        throw ApiError.unauthorized("Xác thực webhook thất bại");
      }
      return;
    }

    if (!this.auth.secret) throw ApiError.internal("Webhook ngân hàng chưa được cấu hình khoá xác thực");

    // SePay HMAC mode: `X-SePay-Signature: sha256=<hex>` over "<timestamp>.<rawBody>".
    const signature = headerValue(headers, SIGNATURE_HEADER);
    const timestamp = headerValue(headers, TIMESTAMP_HEADER);
    if (!signature || !timestamp) throw ApiError.unauthorized("Thiếu thông tin xác thực webhook");

    const timestampSeconds = Number(timestamp);
    if (!Number.isFinite(timestampSeconds)) throw ApiError.unauthorized("Xác thực webhook thất bại");

    // Replay protection: a captured request stops being accepted once the
    // tolerance window passes.
    const ageSeconds = Math.abs(Date.now() / 1000 - timestampSeconds);
    if (ageSeconds > this.auth.timestampToleranceSeconds) {
      throw ApiError.unauthorized("Webhook đã hết hiệu lực (timestamp ngoài khoảng cho phép)");
    }

    // Signed over the exact bytes received — never a re-serialised body.
    const expected =
      SIGNATURE_PREFIX +
      crypto.createHmac("sha256", this.auth.secret).update(`${timestamp}.${rawBody.toString("utf-8")}`).digest("hex");

    if (!safeEqual(signature.trim(), expected)) {
      throw ApiError.unauthorized("Chữ ký webhook không hợp lệ");
    }
  }
}
