// Curated pool of verified-working Unsplash photo IDs, grouped by subject.
// Swap these for real product photography before going to production —
// see IMAGE_CREDITS.md in the repo root.
function img(id: string, w = 1200, h = 1200) {
  return `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&auto=format&q=80`;
}

export const IMAGES = {
  glass: [
    img("1514651029128-173d2e6ea851"),
    img("1598908314732-07113901949e"),
    img("1615485736894-a2d2e6d4cd9a"),
    img("1485808191679-5f86510681a2"),
    img("1458819714733-e5ab3d536722"),
    img("1610821165540-80c084d50fd3"),
    img("1614887065001-06c958a7cddd"),
    img("1514228742587-6b1558fcca3d"),
    img("1560228022-f1a3298022e9"),
    img("1616241673111-508b4662c707"),
    img("1608322368442-2db3b4090724"),
    img("1487357911997-0785d96c024f"),
    img("1606033123014-5392e7556a4b"),
    img("1604743221611-3686f3308024"),
    img("1535154866965-69bee7bc036c"),
    img("1480455550638-f32e7af53106"),
    img("1514362545857-3bc16c4c7d1b"),
    img("1599070638900-e42081062e08"),
    img("1549124785-1c1c62a24388"),
    img("1592992326905-7f6e70d566d1"),
    img("1548690592-791918298cce"),
  ],
  gifting: [
    img("1512909006721-3d6018887383"),
    img("1513201099705-a9746e1e201f"),
    img("1608755728617-aefab37d2edd"),
    img("1575384043001-f37f48835528"),
    img("1510284876186-b1a84b94418f"),
    img("1545470941-1630430ba8c9"),
  ],
  seasonal: [
    img("1602607203588-d6d0eda790e3"),
    img("1612198526331-66fcc90d67da"),
    img("1696426678240-3e4700dd9487"),
  ],
  home: [
    img("1617111490936-07b47eafdcd4"),
    img("1533616688419-b7a585564566"),
    img("1587317996237-eddd7e834d84"),
    img("1603178455924-ef33372953bb"),
    img("1594644465539-783d6f6bb37d"),
    img("1529079091004-2b0ed179f9f2"),
  ],
};
