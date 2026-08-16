import type { Metadata } from "next";
import { Playfair_Display, Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "@/components/ui/sonner";

const playfair = Playfair_Display({
  subsets: ["latin", "vietnamese"],
  variable: "--font-playfair",
  display: "swap",
});

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-be-vietnam",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "LylaGlass — Ly thủy tinh cho mọi khoảnh khắc", template: "%s | LylaGlass" },
  description:
    "LylaGlass tuyển chọn ly thủy tinh đẹp, bền, phù hợp làm quà tặng, trang trí theo mùa và dùng mỗi ngày. Giao hàng toàn quốc, đổi trả trong 7 ngày.",
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "LylaGlass",
    title: "LylaGlass — Ly thủy tinh cho mọi khoảnh khắc",
    description: "Ly thủy tinh tuyển chọn cho quà tặng, mùa lễ hội và những ngày thường.",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${playfair.variable} ${beVietnamPro.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <QueryProvider>
          {children}
          <Toaster position="bottom-center" richColors />
        </QueryProvider>
      </body>
    </html>
  );
}
