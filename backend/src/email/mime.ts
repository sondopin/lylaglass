import { randomUUID } from "node:crypto";

/**
 * RFC 2822 message construction for the Gmail API, which takes a fully-formed
 * message rather than structured fields.
 *
 * Two things this file exists to get right:
 *
 *  1. **Vietnamese text.** Header values are ASCII-only by specification, so
 *     anything non-ASCII (every order confirmation subject here) has to be
 *     encoded per RFC 2047, and bodies are sent base64 so no transport mangles
 *     the UTF-8.
 *
 *  2. **Header injection.** Recipient addresses and subjects are built from
 *     customer-supplied order data. A newline smuggled into any of them would
 *     let the sender append arbitrary headers — a `Bcc:` to an attacker, a
 *     forged `From:` — so every header value is validated, not escaped.
 */

/** Longest a single RFC 2047 encoded-word may be, including its delimiters. */
const MAX_ENCODED_WORD_LENGTH = 75;
const ENCODED_WORD_OVERHEAD = "=?UTF-8?B??=".length;
/** Base64 grows 4 chars per 3 bytes and must be split on 4-char boundaries. */
const MAX_BASE64_CHARS = Math.floor((MAX_ENCODED_WORD_LENGTH - ENCODED_WORD_OVERHEAD) / 4) * 4;
const MAX_BYTES_PER_WORD = (MAX_BASE64_CHARS / 4) * 3;

export class EmailHeaderInjectionError extends Error {
  constructor(field: string) {
    super(`Giá trị header email không hợp lệ: ${field}`);
    this.name = "EmailHeaderInjectionError";
  }
}

/**
 * Rejects any header value carrying a line break or NUL.
 *
 * Deliberately a rejection rather than a sanitisation: a value that contains a
 * newline is either a bug or an attack, and silently stripping it would send a
 * subtly wrong email instead of surfacing the problem.
 */
export function assertSafeHeaderValue(value: string, field: string): string {
  if (/[\r\n\0]/.test(value)) throw new EmailHeaderInjectionError(field);
  return value;
}

/**
 * Splits a string into chunks of at most `maxBytes` UTF-8 bytes without ever
 * cutting a character in half — which would corrupt Vietnamese diacritics.
 */
function chunkByUtf8Bytes(value: string, maxBytes: number): string[] {
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;

  // Iterating the string yields whole code points, so surrogate pairs stay intact.
  for (const char of value) {
    const size = Buffer.byteLength(char, "utf8");
    if (currentBytes + size > maxBytes && current !== "") {
      chunks.push(current);
      current = "";
      currentBytes = 0;
    }
    current += char;
    currentBytes += size;
  }

  if (current !== "") chunks.push(current);
  return chunks;
}

/**
 * Encodes a header value per RFC 2047 when it needs it, leaving plain ASCII
 * untouched so ordinary subjects stay readable in raw message dumps.
 */
export function encodeHeaderValue(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (!/[^\x00-\x7F]/.test(value)) return value;

  return chunkByUtf8Bytes(value, MAX_BYTES_PER_WORD)
    .map((chunk) => `=?UTF-8?B?${Buffer.from(chunk, "utf8").toString("base64")}?=`)
    // Folding whitespace between encoded words: a CRLF + space continuation is
    // how a long header is wrapped without changing its value.
    .join("\r\n ");
}

/**
 * Encodes the display-name part of an address, leaving the address itself
 * alone. `Cửa hàng <shop@example.com>` becomes `=?UTF-8?B?...?= <shop@…>`.
 */
export function encodeAddress(address: string, field: string): string {
  assertSafeHeaderValue(address, field);

  const match = address.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (!match) return address.trim();

  const [, displayName, mailbox] = match;
  if (!displayName) return `<${mailbox.trim()}>`;

  // A quoted display name still cannot hold raw non-ASCII, so encode it.
  const encoded = encodeHeaderValue(displayName.replace(/^"|"$/g, ""));
  return `${encoded} <${mailbox.trim()}>`;
}

/** Bodies go out base64 with CRLF line endings, wrapped at the 76-char limit. */
function base64Body(value: string): string {
  return (
    Buffer.from(value, "utf8")
      .toString("base64")
      .match(/.{1,76}/g) ?? []
  ).join("\r\n");
}

export interface MimeMessageInput {
  from: string;
  to: string[];
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Builds a `multipart/alternative` message: a plain-text part for clients that
 * cannot or will not render HTML, and the HTML part every modern client shows.
 */
export function buildMimeMessage(input: MimeMessageInput): string {
  if (input.to.length === 0) throw new Error("Email phải có ít nhất một người nhận");

  const boundary = `lylaglass_${randomUUID().replace(/-/g, "")}`;
  const to = input.to.map((address) => encodeAddress(address, "to")).join(", ");

  const headers = [
    `From: ${encodeAddress(input.from, "from")}`,
    `To: ${to}`,
    ...(input.replyTo ? [`Reply-To: ${encodeAddress(input.replyTo, "replyTo")}`] : []),
    `Subject: ${encodeHeaderValue(assertSafeHeaderValue(input.subject, "subject"))}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  return [
    ...headers,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Body(input.text),
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Body(input.html),
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

/** Gmail's `messages.send` takes the raw message base64url-encoded. */
export function toGmailRaw(message: string): string {
  return Buffer.from(message, "utf8").toString("base64url");
}
