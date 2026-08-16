import type { Metadata } from "next";
import { ContactFormSection } from "@/components/home/contact-form-section";
import { settingsApi } from "@/lib/api/settings";

export const metadata: Metadata = {
  title: "Liên hệ",
  description: "Liên hệ với LylaGlass để được tư vấn sản phẩm, đơn hàng và các câu hỏi khác.",
  alternates: { canonical: "/lien-he" },
};

export default async function ContactPage() {
  const settings = await settingsApi.get().catch(() => null);

  return (
    <div>
      <div className="bg-mint py-14 text-center sm:py-16">
        <h1 className="font-heading text-3xl font-medium sm:text-4xl">Liên hệ với LylaGlass</h1>
        {settings && (
          <p className="mt-2 text-sm text-foreground/80">
            {settings.supportEmail} · {settings.supportPhone}
          </p>
        )}
      </div>
      <ContactFormSection />
    </div>
  );
}
