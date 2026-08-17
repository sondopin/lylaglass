import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { SePayBankNotificationProvider, parseSePayTransactionDate } from "@/payments/SePayBankNotificationProvider";

const SECRET = "test-webhook-secret";
const API_KEY = "test-api-key";

const PAYLOAD = {
  id: 92704,
  gateway: "TPBank",
  transactionDate: "2026-08-17 19:05:12",
  accountNumber: "0338123456789",
  subAccount: "",
  code: "LG8K3F2A",
  content: "LG8K3F2A chuyen tien",
  transferType: "in",
  description: "NGUYEN VAN A chuyen tien",
  transferAmount: 329000,
  accumulated: 1050000,
  referenceCode: "FT26012345678",
};

function hmacHeaders(body: Buffer, timestamp = Math.floor(Date.now() / 1000), secret = SECRET) {
  const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${body.toString("utf-8")}`).digest("hex");
  return {
    "x-sepay-signature": `sha256=${signature}`,
    "x-sepay-timestamp": String(timestamp),
  };
}

function hmacProvider() {
  return new SePayBankNotificationProvider({
    mode: "hmac",
    secret: SECRET,
    apiKey: "",
    timestampToleranceSeconds: 300,
  });
}

describe("SePayBankNotificationProvider — HMAC authentication", () => {
  it("accepts and normalises a correctly signed payload", async () => {
    const body = Buffer.from(JSON.stringify(PAYLOAD));
    const event = await hmacProvider().verifyAndParse(body, hmacHeaders(body));

    expect(event.transactionId).toBe("92704");
    expect(event.transferType).toBe("in");
    expect(event.transferAmount).toBe(329000);
    expect(event.code).toBe("LG8K3F2A");
    expect(event.accountNumber).toBe("0338123456789");
    expect(event.referenceCode).toBe("FT26012345678");
    // SePay timestamps are Vietnam local time (UTC+7).
    expect(event.transactionDate.toISOString()).toBe("2026-08-17T12:05:12.000Z");
  });

  it("rejects a payload signed with the wrong secret", async () => {
    const body = Buffer.from(JSON.stringify(PAYLOAD));
    const headers = hmacHeaders(body, Math.floor(Date.now() / 1000), "attacker-secret");
    await expect(hmacProvider().verifyAndParse(body, headers)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects a tampered body under a previously valid signature", async () => {
    const body = Buffer.from(JSON.stringify(PAYLOAD));
    const headers = hmacHeaders(body);
    const tampered = Buffer.from(JSON.stringify({ ...PAYLOAD, transferAmount: 1 }));
    await expect(hmacProvider().verifyAndParse(tampered, headers)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects a replayed request whose timestamp is outside the tolerance window", async () => {
    const body = Buffer.from(JSON.stringify(PAYLOAD));
    const stale = Math.floor(Date.now() / 1000) - 3600;
    await expect(hmacProvider().verifyAndParse(body, hmacHeaders(body, stale))).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("rejects a request with no signature headers at all", async () => {
    const body = Buffer.from(JSON.stringify(PAYLOAD));
    await expect(hmacProvider().verifyAndParse(body, {})).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe("SePayBankNotificationProvider — API key authentication", () => {
  const provider = new SePayBankNotificationProvider({
    mode: "apikey",
    secret: "",
    apiKey: API_KEY,
    timestampToleranceSeconds: 300,
  });

  it("accepts the documented `Authorization: Apikey <key>` header", async () => {
    const body = Buffer.from(JSON.stringify(PAYLOAD));
    const event = await provider.verifyAndParse(body, { authorization: `Apikey ${API_KEY}` });
    expect(event.transactionId).toBe("92704");
  });

  it("rejects a wrong key and a missing header", async () => {
    const body = Buffer.from(JSON.stringify(PAYLOAD));
    await expect(provider.verifyAndParse(body, { authorization: "Apikey nope" })).rejects.toMatchObject({
      statusCode: 401,
    });
    await expect(provider.verifyAndParse(body, {})).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe("SePayBankNotificationProvider — payload validation", () => {
  it("rejects a body that is not JSON", async () => {
    const body = Buffer.from("not json");
    await expect(hmacProvider().verifyAndParse(body, hmacHeaders(body))).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a payload missing required fields", async () => {
    const body = Buffer.from(JSON.stringify({ id: 1, transferType: "sideways" }));
    await expect(hmacProvider().verifyAndParse(body, hmacHeaders(body))).rejects.toMatchObject({ statusCode: 400 });
  });

  it("normalises null optional fields to empty strings", async () => {
    const body = Buffer.from(JSON.stringify({ ...PAYLOAD, code: null, referenceCode: null, subAccount: null }));
    const event = await hmacProvider().verifyAndParse(body, hmacHeaders(body));
    expect(event.code).toBe("");
    expect(event.referenceCode).toBe("");
    expect(event.subAccount).toBe("");
  });
});

describe("parseSePayTransactionDate", () => {
  it("treats the timestamp as Vietnam local time", () => {
    expect(parseSePayTransactionDate("2026-08-17 00:30:00").toISOString()).toBe("2026-08-16T17:30:00.000Z");
  });
});
