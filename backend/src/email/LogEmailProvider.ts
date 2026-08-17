import { logger } from "@/config/logger";
import { EmailProvider, SendEmailInput } from "./EmailProvider";

/**
 * Development transport: writes the email to the log instead of sending it, so
 * the full payment flow can be exercised locally without an email account.
 * Selected by EMAIL_PROVIDER=log (the default outside production).
 */
export class LogEmailProvider implements EmailProvider {
  readonly name = "log";

  async send(input: SendEmailInput): Promise<{ id: string }> {
    logger.info({ to: input.to, subject: input.subject, text: input.text }, "Email (log provider, không gửi thật)");
    return { id: `log_${Date.now()}` };
  }
}
