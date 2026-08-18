export interface SendEmailInput {
  /** One or more recipients — the shop alert may go to several people. */
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}

/**
 * Transactional email transport. Kept behind an interface for the same reason
 * payments are: swapping Gmail for SES/Postmark/SMTP must not touch any
 * business logic, only a registration in email/index.ts.
 */
export interface EmailProvider {
  readonly name: string;
  /** Throws on delivery failure so the caller can record it and retry later. */
  send(input: SendEmailInput): Promise<{ id: string }>;
}
