import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // `/admin` dropped: the admin panel now lives on its own app/domain
        // entirely (frontend-admin/), which has its own robots.ts.
        allow: "/",
        disallow: ["/cart", "/checkout", "/orders", "/api"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
