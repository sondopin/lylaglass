import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { CartDrawer } from "@/components/layout/cart-drawer";
import { categoriesApi } from "@/lib/api/categories";
import { settingsApi } from "@/lib/api/settings";
import { Category, Settings } from "@/lib/api/types";

const FALLBACK_SETTINGS: Settings = {
  freeShippingThreshold: 490_000,
  flatShippingFee: 30_000,
  storeName: "LylaGlass",
  supportEmail: "hello@lylaglass.vn",
  supportPhone: "0333 971 738",
};

async function getLayoutData(): Promise<{ categories: Category[]; settings: Settings }> {
  try {
    const [categories, settings] = await Promise.all([categoriesApi.list(), settingsApi.get()]);
    return { categories, settings };
  } catch {
    return { categories: [], settings: FALLBACK_SETTINGS };
  }
}

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const { categories, settings } = await getLayoutData();

  return (
    <>
      <AnnouncementBar freeShippingThreshold={settings.freeShippingThreshold} />
      <Header categories={categories} />
      <main className="flex-1">{children}</main>
      <Footer categories={categories} settings={settings} />
      <CartDrawer />
    </>
  );
}
