import { env } from "@/config/env";
import { EmailProvider } from "./EmailProvider";
import { ResendEmailProvider } from "./ResendEmailProvider";
import { LogEmailProvider } from "./LogEmailProvider";

let provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (provider) return provider;

  switch (env.email.provider) {
    case "resend":
      provider = new ResendEmailProvider(env.email.apiKey, env.email.from, env.email.replyTo);
      break;
    case "log":
    default:
      provider = new LogEmailProvider();
  }
  return provider;
}

export * from "./EmailProvider";
