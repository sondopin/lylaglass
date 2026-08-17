import { EmailProvider, SendEmailInput } from "./EmailProvider";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Resend transactional email over its REST API — no SDK dependency needed,
 * Node's global fetch is enough.
 *
 * Docs: https://resend.com/docs/api-reference/emails/send-email
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly replyTo: string
  ) {}

  async send(input: SendEmailInput): Promise<{ id: string }> {
    if (!this.apiKey) throw new Error("EMAIL_API_KEY chưa được cấu hình");

    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(this.replyTo ? { reply_to: this.replyTo } : {}),
      }),
    });

    if (!response.ok) {
      // Body may carry provider diagnostics, but never the API key.
      const detail = await response.text().catch(() => "");
      throw new Error(`Resend trả về ${response.status}: ${detail.slice(0, 300)}`);
    }

    const body = (await response.json().catch(() => ({}))) as { id?: string };
    return { id: body.id ?? "" };
  }
}
