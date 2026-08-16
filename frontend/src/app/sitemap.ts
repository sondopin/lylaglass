import type { MetadataRoute } from "next";
import { categoriesApi } from "@/lib/api/categories";
import { productsApi } from "@/lib/api/products";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/san-pham",
    "/gioi-thieu",
    "/lien-he",
    "/cau-hoi-thuong-gap",
    "/tra-cuu-don-hang",
  ].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));

  const [categories, products] = await Promise.all([
    categoriesApi.list().catch(() => []),
    productsApi.list({ limit: 100 }).catch(() => ({ items: [] })),
  ]);

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${SITE_URL}/danh-muc/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const productRoutes: MetadataRoute.Sitemap = products.items.map((p) => ({
    url: `${SITE_URL}/san-pham/${p.slug}`,
    lastModified: new Date(p.updatedAt),
    changeFrequency: "weekly",
    priority: 0.9,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
