/**
 * VietQR (NAPAS 247 / EMVCo QRCPS) payload builder.
 *
 * The QR is generated entirely from server-side data — bank BIN, account
 * number, order total and payment code — so the client can never influence
 * what a customer is asked to transfer.
 *
 * Structure (TLV: 2-digit id + 2-digit length + value):
 *   00  Payload format indicator            "01"
 *   01  Point of initiation method          "11" static / "12" dynamic (amount fixed)
 *   38  Merchant account information
 *       00  GUID                            "A000000727" (NAPAS)
 *       01  Beneficiary organization
 *           00  Acquirer id (bank BIN)      e.g. "970423" for TPBank
 *           01  Beneficiary account number
 *       02  Service code                    "QRIBFTTA" (transfer to account)
 *   53  Transaction currency                "704" (VND, ISO 4217)
 *   54  Transaction amount                  whole VND, no separators
 *   58  Country code                        "VN"
 *   62  Additional data
 *       08  Purpose of transaction          transfer memo = payment code
 *   63  CRC                                 CRC-16/CCITT-FALSE over the whole
 *                                           payload *including* the "6304" tag
 */

const ID_PAYLOAD_FORMAT = "00";
const ID_POINT_OF_INITIATION = "01";
const ID_MERCHANT_ACCOUNT_INFO = "38";
const ID_CURRENCY = "53";
const ID_AMOUNT = "54";
const ID_COUNTRY = "58";
const ID_ADDITIONAL_DATA = "62";
const ID_CRC = "63";

const NAPAS_GUID = "A000000727";
const SERVICE_CODE_TO_ACCOUNT = "QRIBFTTA";
const CURRENCY_VND = "704";
const COUNTRY_VN = "VN";

const SUB_ID_GUID = "00";
const SUB_ID_BENEFICIARY = "01";
const SUB_ID_SERVICE_CODE = "02";
const SUB_ID_ACQUIRER_BIN = "00";
const SUB_ID_ACCOUNT_NUMBER = "01";
const SUB_ID_PURPOSE = "08";

export interface VietQrPayloadInput {
  /** NAPAS BIN of the beneficiary bank (TPBank = 970423). */
  bankBin: string;
  accountNumber: string;
  /** Whole VND. Decimals are not used for VND. */
  amount: number;
  /** Transfer memo — the unique payment code used to reconcile the transfer. */
  description: string;
}

function tlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

/**
 * CRC-16/CCITT-FALSE: polynomial 0x1021, initial value 0xFFFF, no input or
 * output reflection, no final XOR. Returned as 4 uppercase hex digits.
 */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Banks reject/garble non-ASCII memos, so the transfer memo is normalised to
 * plain ASCII letters, digits and spaces (our payment codes already are).
 * "\u0111"/"\u0110" have no NFD decomposition, so they are mapped explicitly \u2014 otherwise
 * they would be stripped instead of transliterated.
 */
function normalizeDescription(description: string): string {
  return description
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 25);
}

export function buildVietQrPayload(input: VietQrPayloadInput): string {
  if (!/^\d{6}$/.test(input.bankBin)) {
    throw new Error(`BIN ngân hàng không hợp lệ: ${input.bankBin}`);
  }
  if (!/^\d{4,19}$/.test(input.accountNumber)) {
    throw new Error("Số tài khoản ngân hàng không hợp lệ");
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("Số tiền VietQR phải là số nguyên dương");
  }

  const beneficiary =
    tlv(SUB_ID_ACQUIRER_BIN, input.bankBin) + tlv(SUB_ID_ACCOUNT_NUMBER, input.accountNumber);

  const merchantAccountInfo =
    tlv(SUB_ID_GUID, NAPAS_GUID) +
    tlv(SUB_ID_BENEFICIARY, beneficiary) +
    tlv(SUB_ID_SERVICE_CODE, SERVICE_CODE_TO_ACCOUNT);

  const body =
    tlv(ID_PAYLOAD_FORMAT, "01") +
    tlv(ID_POINT_OF_INITIATION, "12") +
    tlv(ID_MERCHANT_ACCOUNT_INFO, merchantAccountInfo) +
    tlv(ID_CURRENCY, CURRENCY_VND) +
    tlv(ID_AMOUNT, String(input.amount)) +
    tlv(ID_COUNTRY, COUNTRY_VN) +
    tlv(ID_ADDITIONAL_DATA, tlv(SUB_ID_PURPOSE, normalizeDescription(input.description)));

  // The CRC covers the payload plus the CRC tag id and length ("6304").
  const withCrcTag = `${body}${ID_CRC}04`;
  return `${withCrcTag}${crc16(withCrcTag)}`;
}
