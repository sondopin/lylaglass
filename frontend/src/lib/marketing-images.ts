// Curated, verified-working Unsplash photos used for static marketing
// sections (hero, about, gallery) that aren't tied to a specific Product
// record. Swap for real brand photography before production.
function img(id: string, w = 1600, h = 1600) {
  return `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&auto=format&q=80`;
}

export const MARKETING_IMAGES = {
  hero: img("1514651029128-173d2e6ea851", 2000, 1200),
  about: img("1615485736894-a2d2e6d4cd9a", 1400, 1400),
  faqSide: img("1548690592-791918298cce", 1200, 1400),
  gallery: [
    img("1602607203588-d6d0eda790e3", 800, 800),
    img("1512909006721-3d6018887383", 800, 800),
    img("1617111490936-07b47eafdcd4", 800, 800),
    img("1533616688419-b7a585564566", 800, 800),
    img("1612198526331-66fcc90d67da", 800, 800),
  ],
};
