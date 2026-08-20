import type { Metadata } from "next";
import { Playfair_Display, Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/app-shell";

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

export const metadata: Metadata = {
  title: { default: "LylaGlass Admin", template: "%s | LylaGlass Admin" },
  description: "Trang quản trị LylaGlass — không dành cho công cụ tìm kiếm.",
  // Belt-and-suspenders alongside robots.txt: an admin app has no public
  // content to index and every route here requires an authenticated session.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${playfair.variable} ${beVietnamPro.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <QueryProvider>
          <AppShell>{children}</AppShell>
          <Toaster position="bottom-center" richColors />
        </QueryProvider>
      </body>
    </html>
  );
}
