import crypto from "node:crypto";

/**
 * Length-independent constant-time string compare.
 *
 * `crypto.timingSafeEqual` throws on mismatched buffer lengths rather than
 * returning false, so a naive `if (a.length !== b.length) return false` would
 * leak the correct length through response timing. The equal-length branch
 * below still runs a real comparison (against itself) on a mismatch, so the
 * two code paths take statistically indistinguishable time.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}
