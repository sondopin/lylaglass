import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EmailHeaderInjectionError,
  assertSafeHeaderValue,
  buildMimeMessage,
  encodeAddress,
  encodeHeaderValue,
  toGmailRaw,
} from "@/email/mime";

vi.mock("@/config/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { GmailEmailProvider } = await import("@/email/GmailEmailProvider");

const CREDENTIALS = {
  clientId: "client-id.apps.googleusercontent.com",
  clientSecret: "client-secret",
  refreshToken: "refresh-token",
  sender: "shop@lylaglass.vn",
};

/** Decodes a `=?UTF-8?B?…?=` header back to the string it represents. */
function decodeEncodedWords(header: string): string {
  return header
    .replace(/\r\n /g, "")
    .replace(/=\?UTF-8\?B\?([^?]*)\?=/g, (_match, b64) => Buffer.from(b64, "base64").toString("utf8"));
}

function partBody(message: string, contentType: string): string {
  const section = message.split(/--lylaglass_[0-9a-f]+/).find((part) => part.includes(contentType));
  if (!section) throw new Error(`Không tìm thấy phần ${contentType}`);
  const body = section.split("\r\n\r\n").slice(1).join("\r\n\r\n").trim();
  return Buffer.from(body.replace(/\r\n/g, ""), "base64").toString("utf8");
}

describe("MIME header encoding", () => {
  it("leaves plain ASCII headers untouched", () => {
    expect(encodeHeaderValue("Order LG20260817-K7M2XQ")).toBe("Order LG20260817-K7M2XQ");
  });

  it("round-trips Vietnamese subjects through RFC 2047 encoding", () => {
    const subject = "Thanh toán thành công - Đơn hàng LG20260817-K7M2XQ — 329.000đ";
    const encoded = encodeHeaderValue(subject);

    expect(encoded).toContain("=?UTF-8?B?");
    expect(decodeEncodedWords(encoded)).toBe(subject);
  });

  it("keeps every encoded word within the 75-character limit", () => {
    const long = "Đơn hàng mới đã thanh toán thành công cho khách hàng Nguyễn Văn Anh tại Thành phố Hồ Chí Minh";
    const encoded = encodeHeaderValue(long);

    for (const word of encoded.split("\r\n ")) {
      expect(word.length).toBeLessThanOrEqual(75);
    }
    expect(decodeEncodedWords(encoded)).toBe(long);
  });

  it("encodes only the display name of an address", () => {
    const encoded = encodeAddress("Cửa hàng LylaGlass <shop@lylaglass.vn>", "from");

    expect(encoded).toMatch(/^=\?UTF-8\?B\?.*\?= <shop@lylaglass\.vn>$/);
    expect(decodeEncodedWords(encoded)).toBe("Cửa hàng LylaGlass <shop@lylaglass.vn>");
  });

  it("passes a bare address through unchanged", () => {
    expect(encodeAddress("customer@example.com", "to")).toBe("customer@example.com");
  });
});

describe("MIME header injection", () => {
  it.each([
    ["newline", "Đơn hàng\nBcc: attacker@evil.test"],
    ["carriage return", "Đơn hàng\rBcc: attacker@evil.test"],
    ["CRLF", "Đơn hàng\r\nBcc: attacker@evil.test"],
    ["NUL", "Đơn hàng\0"],
  ])("rejects a %s in a header value", (_label, value) => {
    expect(() => assertSafeHeaderValue(value, "subject")).toThrow(EmailHeaderInjectionError);
  });

  it("refuses to build a message whose recipient smuggles a header", () => {
    expect(() =>
      buildMimeMessage({
        from: "shop@lylaglass.vn",
        to: ["customer@example.com\r\nBcc: attacker@evil.test"],
        subject: "Xin chào",
        html: "<p>hi</p>",
        text: "hi",
      })
    ).toThrow(EmailHeaderInjectionError);
  });

  it("refuses to build a message whose subject smuggles a header", () => {
    expect(() =>
      buildMimeMessage({
        from: "shop@lylaglass.vn",
        to: ["customer@example.com"],
        subject: "Đơn hàng\r\nBcc: attacker@evil.test",
        html: "<p>hi</p>",
        text: "hi",
      })
    ).toThrow(EmailHeaderInjectionError);
  });
});

describe("MIME message structure", () => {
  const message = buildMimeMessage({
    from: "LylaGlass <shop@lylaglass.vn>",
    to: ["customer@example.com", "second@example.com"],
    replyTo: "hello@lylaglass.vn",
    subject: "Thanh toán thành công",
    html: "<p>Cảm ơn bạn đã đặt hàng — 329.000đ</p>",
    text: "Cảm ơn bạn đã đặt hàng — 329.000đ",
  });

  it("addresses every recipient on one To header", () => {
    const to = message.split("\r\n").find((line) => line.startsWith("To: "));
    expect(to).toBe("To: customer@example.com, second@example.com");
  });

  it("carries a Reply-To when configured", () => {
    expect(message).toContain("Reply-To: hello@lylaglass.vn");
  });

  it("sends both a plain-text and an HTML alternative", () => {
    expect(message).toContain("Content-Type: multipart/alternative;");
    expect(partBody(message, 'text/plain; charset="UTF-8"')).toBe("Cảm ơn bạn đã đặt hàng — 329.000đ");
    expect(partBody(message, 'text/html; charset="UTF-8"')).toBe("<p>Cảm ơn bạn đã đặt hàng — 329.000đ</p>");
  });

  it("base64url-encodes the message for the Gmail API", () => {
    const raw = toGmailRaw(message);

    expect(raw).not.toMatch(/[+/=]/);
    expect(Buffer.from(raw, "base64url").toString("utf8")).toBe(message);
  });

  it("rejects a message with no recipient", () => {
    expect(() =>
      buildMimeMessage({ from: "shop@lylaglass.vn", to: [], subject: "x", html: "x", text: "x" })
    ).toThrow(/người nhận/);
  });
});

describe("GmailEmailProvider", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  function tokenResponse(accessToken = "access-token", expiresIn = 3600) {
    return new Response(JSON.stringify({ access_token: accessToken, expires_in: expiresIn }), { status: 200 });
  }

  function sendResponse(id = "gmail-message-id") {
    return new Response(JSON.stringify({ id }), { status: 200 });
  }

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  function newProvider(from = "LylaGlass <shop@lylaglass.vn>", replyTo = "") {
    return new GmailEmailProvider(CREDENTIALS, from, replyTo);
  }

  it("exchanges the refresh token, then sends the message", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(sendResponse());

    const result = await newProvider().send({
      to: "customer@example.com",
      subject: "Thanh toán thành công",
      html: "<p>hi</p>",
      text: "hi",
    });

    expect(result).toEqual({ id: "gmail-message-id" });

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0];
    expect(tokenUrl).toBe("https://oauth2.googleapis.com/token");
    expect(String(tokenInit.body)).toContain("grant_type=refresh_token");

    const [sendUrl, sendInit] = fetchMock.mock.calls[1];
    expect(sendUrl).toBe("https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    expect(sendInit.headers.Authorization).toBe("Bearer access-token");

    const raw = JSON.parse(String(sendInit.body)).raw as string;
    expect(Buffer.from(raw, "base64url").toString("utf8")).toContain("To: customer@example.com");
  });

  it("reuses a cached access token across sends", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(sendResponse("first"))
      .mockResolvedValueOnce(sendResponse("second"));

    const provider = newProvider();
    await provider.send({ to: "a@example.com", subject: "s", html: "h", text: "t" });
    await provider.send({ to: "b@example.com", subject: "s", html: "h", text: "t" });

    const tokenCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("oauth2"));
    expect(tokenCalls).toHaveLength(1);
  });

  it("makes one token request when two emails are sent concurrently", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes("oauth2") ? tokenResponse() : sendResponse()
    );

    const provider = newProvider();
    await Promise.all([
      provider.send({ to: "customer@example.com", subject: "s", html: "h", text: "t" }),
      provider.send({ to: "shop@lylaglass.vn", subject: "s", html: "h", text: "t" }),
    ]);

    const tokenCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("oauth2"));
    expect(tokenCalls).toHaveLength(1);
  });

  it("sends the shop alert to every configured recipient in one message", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(sendResponse());

    await newProvider().send({
      to: ["owner@lylaglass.vn", "ops@lylaglass.vn"],
      subject: "Đơn mới đã thanh toán",
      html: "<p>x</p>",
      text: "x",
    });

    const raw = JSON.parse(String(fetchMock.mock.calls[1][1].body)).raw as string;
    expect(Buffer.from(raw, "base64url").toString("utf8")).toContain(
      "To: owner@lylaglass.vn, ops@lylaglass.vn"
    );
  });

  it("drops the cached token when Gmail rejects it, so the next send re-authenticates", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse("stale-token"))
      .mockResolvedValueOnce(new Response("invalid credentials", { status: 401 }))
      .mockResolvedValueOnce(tokenResponse("fresh-token"))
      .mockResolvedValueOnce(sendResponse());

    const provider = newProvider();
    await expect(provider.send({ to: "a@example.com", subject: "s", html: "h", text: "t" })).rejects.toThrow(/401/);
    await provider.send({ to: "a@example.com", subject: "s", html: "h", text: "t" });

    const tokenCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("oauth2"));
    expect(tokenCalls).toHaveLength(2);
    expect(fetchMock.mock.calls[3][1].headers.Authorization).toBe("Bearer fresh-token");
  });

  it("throws — rather than silently doing nothing — when credentials are missing", async () => {
    const provider = new GmailEmailProvider({ ...CREDENTIALS, refreshToken: "" }, "shop@lylaglass.vn", "");

    await expect(provider.send({ to: "a@example.com", subject: "s", html: "h", text: "t" })).rejects.toThrow(
      /GMAIL_REFRESH_TOKEN/
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to the authenticated mailbox when EMAIL_FROM is unset", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(sendResponse());

    await newProvider("").send({ to: "a@example.com", subject: "s", html: "h", text: "t" });

    const raw = JSON.parse(String(fetchMock.mock.calls[1][1].body)).raw as string;
    expect(Buffer.from(raw, "base64url").toString("utf8")).toContain("From: shop@lylaglass.vn");
  });

  it("surfaces a Gmail API failure so the caller can record and retry it", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response("quota exceeded", { status: 429 }));

    await expect(
      newProvider().send({ to: "a@example.com", subject: "s", html: "h", text: "t" })
    ).rejects.toThrow(/429/);
  });
});
