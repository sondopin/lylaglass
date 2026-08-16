import { Hero } from "@/components/home/hero";
import { MarqueeTicker } from "@/components/home/marquee-ticker";
import { CategoryGrid } from "@/components/home/category-grid";
import { ProductSection } from "@/components/home/product-section";
import { AboutSplit } from "@/components/home/about-split";
import { FaqSection } from "@/components/home/faq-section";
import { ContactFormSection } from "@/components/home/contact-form-section";
import { NewsletterSignup } from "@/components/home/newsletter-signup";
import { categoriesApi } from "@/lib/api/categories";
import { productsApi } from "@/lib/api/products";

export default async function HomePage() {
  const [categories, newArrivals, bestsellers] = await Promise.all([
    categoriesApi.list().catch(() => []),
    productsApi.list({ sort: "newest", limit: 8 }).catch(() => ({ items: [] })),
    productsApi.list({ sort: "bestselling", limit: 8 }).catch(() => ({ items: [] })),
  ]);

  return (
    <>
      <Hero />
      <MarqueeTicker />
      <CategoryGrid categories={categories} />
      <ProductSection
        heading="Hàng mới về"
        subheading="Những thiết kế mới thắp sáng ngày của bạn"
        products={newArrivals.items}
        viewMoreHref="/san-pham?sort=newest"
      />
      <AboutSplit />
      <ProductSection
        heading="Bán chạy nhất"
        subheading="Được yêu thích nhất bởi khách hàng LylaGlass"
        products={bestsellers.items}
        viewMoreHref="/san-pham?sort=bestselling"
      />
      <FaqSection />
      <ContactFormSection />
      <NewsletterSignup />
    </>
  );
}
