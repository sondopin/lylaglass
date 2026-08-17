import { describe, expect, it } from "vitest";
import { buildVietQrPayload, crc16 } from "@/payments/vietqrPayload";

/**
 * Reference vector from a published NAPAS 247 example: 120.000đ to VietinBank
 * (BIN 970415) account 0011001932418 with memo "ung ho lu lut". Matching it
 * byte-for-byte proves the TLV layout and the CRC-16/CCITT-FALSE parameters.
 */
const REFERENCE_PAYLOAD =
  "00020101021238570010A00000072701270006970415011300110019324180208QRIBFTTA530370454061200005802VN62170813ung ho lu lut6304C15C";

const TPBANK_BIN = "970423";

describe("crc16", () => {
  it("matches the CRC of the reference VietQR payload", () => {
    expect(crc16(REFERENCE_PAYLOAD.slice(0, -4))).toBe("C15C");
  });
});

describe("buildVietQrPayload", () => {
  it("reproduces the published reference payload exactly", () => {
    const payload = buildVietQrPayload({
      bankBin: "970415",
      accountNumber: "0011001932418",
      amount: 120000,
      description: "ung ho lu lut",
    });
    expect(payload).toBe(REFERENCE_PAYLOAD);
  });

  it("encodes the TPBank BIN, account number, exact amount and payment code", () => {
    const payload = buildVietQrPayload({
      bankBin: TPBANK_BIN,
      accountNumber: "0338123456789",
      amount: 329000,
      description: "LG8K3F2A",
    });

    // Bank + account live inside tag 38's beneficiary sub-template.
    expect(payload).toContain(`0006${TPBANK_BIN}`);
    expect(payload).toContain("01130338123456789");
    expect(payload).toContain("0208QRIBFTTA");
    // Amount: tag 54, length 06, value 329000 — no separators, no decimals.
    expect(payload).toContain("5406329000");
    // Payment code: tag 62 -> sub-tag 08.
    expect(payload).toContain("62120808LG8K3F2A");
    // Dynamic QR (amount fixed) and VND/VN.
    expect(payload.startsWith("000201010212")).toBe(true);
    expect(payload).toContain("5303704");
    expect(payload).toContain("5802VN");
  });

  it("is self-consistent: the trailing CRC validates against the rest", () => {
    const payload = buildVietQrPayload({
      bankBin: TPBANK_BIN,
      accountNumber: "0338123456789",
      amount: 1000,
      description: "LGABC123",
    });
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)));
  });

  it("changes the payload when the amount changes", () => {
    const base = { bankBin: TPBANK_BIN, accountNumber: "0338123456789", description: "LGABC123" };
    expect(buildVietQrPayload({ ...base, amount: 329000 })).not.toBe(
      buildVietQrPayload({ ...base, amount: 300000 })
    );
  });

  it("strips diacritics and unsupported characters from the memo", () => {
    const payload = buildVietQrPayload({
      bankBin: TPBANK_BIN,
      accountNumber: "0338123456789",
      amount: 1000,
      description: "Đơn hàng LG8K3F2A!",
    });
    expect(payload).toContain("Don hang LG8K3F2A");
  });

  it("rejects invalid bank/account/amount input instead of emitting a broken QR", () => {
    const valid = { bankBin: TPBANK_BIN, accountNumber: "0338123456789", amount: 1000, description: "LGABC123" };
    expect(() => buildVietQrPayload({ ...valid, bankBin: "97042" })).toThrow();
    expect(() => buildVietQrPayload({ ...valid, accountNumber: "abc" })).toThrow();
    expect(() => buildVietQrPayload({ ...valid, amount: 0 })).toThrow();
    expect(() => buildVietQrPayload({ ...valid, amount: 1000.5 })).toThrow();
  });
});
