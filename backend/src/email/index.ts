import { env } from "@/config/env";
import { EmailProvider } from "./EmailProvider";
import { GmailEmailProvider } from "./GmailEmailProvider";
import { LogEmailProvider } from "./LogEmailProvider";

let provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (provider) return provider;

  switch (env.email.provider) {
    case "gmail":
      provider = new GmailEmailProvider(
        {
          clientId: env.email.gmail.clientId,
          clientSecret: env.email.gmail.clientSecret,
          refreshToken: env.email.gmail.refreshToken,
          sender: env.email.gmail.sender,
        },
        env.email.from,
        env.email.replyTo
      );
      break;
    case "log":
    default:
      provider = new LogEmailProvider();
  }
  return provider;
}

/** Test seam: forces the next `getEmailProvider()` to rebuild from config. */
export function resetEmailProvider() {
  provider = null;
}

export * from "./EmailProvider";
