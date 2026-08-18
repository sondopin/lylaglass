import { logger } from "@/config/logger";
import { EmailProvider, SendEmailInput } from "./EmailProvider";
import { buildMimeMessage, toGmailRaw } from "./mime";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const SEND_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

/** Refresh a little before real expiry so an in-flight send never races it. */
const TOKEN_EXPIRY_SKEW_MS = 60_000;

export interface GmailCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** Mailbox the refresh token belongs to. */
  sender: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

/**
 * Sends transactional mail through the Gmail API using an OAuth2 refresh token.
 *
 * Why a refresh token rather than SMTP with a password: nothing reusable as a
 * login credential is ever stored, the grant is scoped to `gmail.send` alone
 * (it cannot read the mailbox), and revoking it in the Google account stops the
 * server sending immediately without touching a password.
 *
 * Access tokens live ~1 hour and are cached in memory, so a burst of orders
 * costs one token exchange rather than one per email.
 */
export class GmailEmailProvider implements EmailProvider {
  readonly name = "gmail";

  private token: CachedToken | null = null;
  /** In-flight refresh, shared so concurrent sends make one token request. */
  private pendingRefresh: Promise<string> | null = null;

  constructor(
    private readonly credentials: GmailCredentials,
    private readonly from: string,
    private readonly replyTo: string
  ) {}

  private get isConfigured(): boolean {
    const { clientId, clientSecret, refreshToken, sender } = this.credentials;
    return Boolean(clientId && clientSecret && refreshToken && sender);
  }

  /**
   * Returns a valid access token, exchanging the refresh token when the cached
   * one is missing or about to expire.
   */
  private async getAccessToken(): Promise<string> {
    const cached = this.token;
    if (cached && cached.expiresAt > Date.now()) return cached.accessToken;

    // Collapse concurrent refreshes: several emails sent at once (customer +
    // owner) would otherwise each hit the token endpoint.
    if (this.pendingRefresh) return this.pendingRefresh;

    this.pendingRefresh = this.refreshAccessToken().finally(() => {
      this.pendingRefresh = null;
    });
    return this.pendingRefresh;
  }

  private async refreshAccessToken(): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.credentials.clientId,
      client_secret: this.credentials.clientSecret,
      refresh_token: this.credentials.refreshToken,
      grant_type: "refresh_token",
    });

    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) {
      // Google returns `{ error, error_description }`. Safe to surface: it
      // describes the grant, and never echoes the client secret back.
      const detail = await response.text().catch(() => "");
      throw new Error(`Gmail OAuth trả về ${response.status}: ${detail.slice(0, 300)}`);
    }

    const payload = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!payload.access_token) throw new Error("Gmail OAuth không trả về access_token");

    const expiresInMs = (payload.expires_in ?? 3600) * 1000;
    this.token = {
      accessToken: payload.access_token,
      expiresAt: Date.now() + expiresInMs - TOKEN_EXPIRY_SKEW_MS,
    };
    logger.debug({ expiresInSeconds: payload.expires_in }, "Gmail access token refreshed");
    return payload.access_token;
  }

  async send(input: SendEmailInput): Promise<{ id: string }> {
    if (!this.isConfigured) {
      throw new Error(
        "Gmail chưa được cấu hình (cần GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER)"
      );
    }

    const recipients = (Array.isArray(input.to) ? input.to : [input.to]).map((address) => address.trim()).filter(Boolean);
    if (recipients.length === 0) throw new Error("Email không có người nhận hợp lệ");

    const message = buildMimeMessage({
      // Gmail rejects a From: that is neither the authenticated mailbox nor one
      // of its verified send-as aliases, so fall back to the mailbox itself
      // when EMAIL_FROM was left unset.
      from: this.from || this.credentials.sender,
      to: recipients,
      replyTo: this.replyTo || undefined,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    const accessToken = await this.getAccessToken();

    const response = await fetch(SEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: toGmailRaw(message) }),
    });

    if (response.status === 401) {
      // The cached token was rejected (revoked, or clock skew). Drop it so the
      // next attempt re-exchanges rather than replaying a dead token.
      this.token = null;
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Gmail API trả về ${response.status}: ${detail.slice(0, 300)}`);
    }

    const payload = (await response.json().catch(() => ({}))) as { id?: string };
    return { id: payload.id ?? "" };
  }
}
