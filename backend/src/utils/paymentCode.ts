import { customAlphabet } from "nanoid";

// Same confusable-free alphabet as order numbers: no 0/O/1/I, so a customer
// reading the code off the screen into their banking app cannot mistype it.
const nanoid = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 6);

/** Matches the payment codes we generate, for pulling one out of a transfer memo. */
export const PAYMENT_CODE_PATTERN = /LG[2-9A-HJ-NP-Z]{6}/g;

/**
 * Unique transfer memo for one payment, e.g. "LG8K3F2A".
 *
 * This is the only thing that ties an incoming bank transfer to an order, so it
 * is generated server-side and never accepted from the client. 32^6 ≈ 1.07e9
 * combinations, and a unique index on Payment.paymentCode is the real guarantee.
 */
export function generatePaymentCode(): string {
  return `LG${nanoid()}`;
}

/**
 * Extracts candidate payment codes from a bank transfer memo. Banks mangle
 * memos (case changes, added prefixes, collapsed spaces), so every match is
 * returned and the caller checks each against the database — a code is only
 * ever accepted because a Payment with exactly that code exists.
 */
export function extractPaymentCodes(...sources: Array<string | undefined>): string[] {
  const found = new Set<string>();
  for (const source of sources) {
    if (!source) continue;
    const matches = source.toUpperCase().match(PAYMENT_CODE_PATTERN);
    for (const match of matches ?? []) found.add(match);
  }
  return [...found];
}
