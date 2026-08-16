# REFERENCE_ANALYSIS.md
### Reverse-engineering website tham chiếu: https://wulihome.ca/
Ngày phân tích: 2026-08-16
Phạm vi: Desktop (viewport ~1536–1568px). Mobile được suy luận từ breakpoint CSS thực tế + bằng chứng DOM (không chụp được screenshot mobile thật trong phiên này — xem mục 9 "Những điểm chưa xác định").

> **Ghi chú nền tảng phát hiện được**: Wuli Home chạy trên **Shopify**, dùng theme thuộc họ **Dawn** (bản fork/tuỳ biến, tên nội bộ gần với "Toyo" — nhận diện qua class CSS `menu-drawer`, `header__icon--menu`, biến CSS `--color-base-*`, `--product-card-*`, cấu trúc `main-product`, v.v.). Checkout dùng **Shopify hosted Checkout** (domain `shopify.com/checkouts/...`), và đăng nhập khách hàng dùng **Shopify Customer Accounts** (redirect sang `shopify.com/authentication/...`). Đây là các thành phần **độc quyền của Shopify**, không thể và không nên copy — khi rebuild, ta sẽ tự thiết kế flow tương đương (checkout riêng nếu build custom platform, hoặc dùng Shopify Checkout mặc định nếu chính website mới cũng build trên Shopify).

---

## 1. INFORMATION ARCHITECTURE

### 1.1 Danh sách trang / route

| # | Trang | Route pattern (Shopify) | Ghi chú |
|---|-------|--------------------------|---------|
| 1 | Homepage | `/` | Trang chủ, nhiều section marketing |
| 2 | Collection (Category / PLP) | `/collections/{handle}` | vd: `/collections/bowls`, `/collections/dinnerware-set` |
| 3 | All Products | `/pages/shop-all` (custom page) hoặc `/collections/all` | Nút "Shop Now" ở Hero trỏ tới `/pages/shop-all` |
| 4 | Sale Collection | `/collections/sale-up-to-70-off` | Collection đặc biệt, có badge giảm giá |
| 5 | Search Results | `/search?q={query}` | Dùng lại layout PLP |
| 6 | Product Detail (PDP) | `/products/{handle}` | Có thể truy cập qua `/collections/{handle}/products/{handle}` |
| 7 | Cart | `/cart` | Trang giỏ hàng đầy đủ (song song với Cart Drawer) |
| 8 | Checkout | `/checkouts/cn/{token}` (Shopify hosted, subdomain riêng) | Multi-step: Contact → Delivery → Shipping method → Payment |
| 9 | Order confirmation | `/checkouts/.../thank_you` (Shopify hosted) | Không truy cập trực tiếp được (cần hoàn tất đơn) |
| 10 | About Us | `/pages/about-us` | Nội dung thương hiệu |
| 11 | Contact Us | `/pages/contact` | Có form liên hệ (cũng nhúng lại ở homepage) |
| 12 | FAQ | `/pages/frequently-asked-questions` | Accordion Q&A |
| 13 | Gift Ideas | `/pages/gift-ideas` | Landing page cho mục Gift trong mega-menu |
| 14 | Customer Login | `shopify.com/authentication/{shop_id}/login` | External — Shopify Customer Accounts (OAuth) |
| 15 | Shipping Policy | `/policies/shipping-policy` | Footer link |
| 16 | Privacy Policy | `/policies/privacy-policy` | Footer link |
| 17 | Return & Refund Policy | `/policies/refund-policy` | Footer link |
| 18 | Terms of Service | `/policies/terms-of-service` | Footer link |

Danh sách collection con quan sát được (từ mega-menu, dùng làm taxonomy category):
- **Shop By**: New Arrivals, Bestsellers, Popular Restocks
- **Kitchen & Dining**: Dinnerware Set, Bowls, Plates, Kitchen Accessories, Cutlery & Utensils
- **Home Essentials**: Home Accessories, Home Storage, Bath Mat & Rugs, Doormat
- **Drinkware**: Glassware, Ceramic Mug
- **Gift Ideas**: Gift set, Gift under $15 / $30 / $50

### 1.2 Navigation giữa các trang

- **Header (sticky, luôn hiển thị mọi trang)**: Logo → Home. Nav: Home, "Shop All" (mega-menu dropdown click), About us, Contact us, FAQ, SALE. Icon phải: Search (mở overlay), Account (redirect Shopify auth), Cart (mở Cart Drawer, không điều hướng trang), Currency selector (dropdown).
- **Mega-menu "Shop All"**: click mở dropdown full-width bên dưới header, chứa 5 nhóm cột liên kết tới các collection, kèm 1 ảnh minh hoạ bo tròn hữu cơ bên phải.
- **Từ Homepage** → click category card / product card / "Shop Now" / "Shop All" → Collection hoặc PDP.
- **Từ Collection (PLP)** → click card → PDP. Có Filter (drawer trái) + Sort (dropdown) + Pagination (số trang) không rời trang (AJAX, giữ nguyên URL query `?page=`).
- **Từ PDP** → "Add To Cart" mở Cart Drawer (không điều hướng); breadcrumb không quan sát thấy (theme không có breadcrumb hiển thị); related "You May Also Like" và "Recently Viewed" điều hướng sang PDP khác.
- **Cart Drawer → "View Cart"** → `/cart`. **Cart Drawer/Cart page → "Check Out"** → chuyển sang subdomain checkout riêng của Shopify (rời khỏi theme, giao diện checkout khác hẳn theme chính).
- **Checkout hoàn tất** → Order confirmation (thank-you) page (Shopify hosted, không tuỳ biến theo theme).
- **Footer**: 4 cột link (Home / Shop / About Us / Contact Us) + policy links + currency selector + "Follow on Shop" + payment icons + "Powered by Shopify".

---

## 2. HOMEPAGE — phân tích chi tiết từng section

Thứ tự section từ trên xuống dưới:

### 2.1 Announcement bar (2 tầng, trên cùng)
- **Vị trí**: trên cùng, phía trên Header, full-width, không sticky (cuộn mất theo trang, Header mới sticky).
- **Tầng 1**: nền hồng đất/dusty rose (~`#E6C9BE` xấp xỉ RGB 236,198,190), chữ nâu đậm, text: "Free shipping over $49 in Canada & the USA", canh giữa, 1 dòng.
- **Tầng 2**: nền kem nhạt (gần trắng, RGB ~250,250,247), text: "🎉 4th Anniversary · Free Gift with Every Order" kèm emoji, canh giữa.
- **Chiều cao**: mỗi tầng ước lượng ~34–36px (estimated).
- **Interaction**: tĩnh, không thấy carousel nhiều message luân phiên trong phiên quan sát (có thể có nhiều message xoay vòng — estimated, chưa xác nhận được).

### 2.2 Header
- **Vị trí**: sticky top, dưới announcement bar; khi cuộn, announcement bar biến mất, Header dính lại đầu trang.
- **Bố cục 3 cụm** (desktop): Logo (trái) — Nav chính (giữa) — Icon cluster (phải: Search, Account, Cart, Currency).
- **Logo**: wordmark "wuli" chữ thường, font khác biệt (geometric sans, đậm, có chấm trên chữ "i" cách điệu), màu đen/nâu đậm, không phải Yrsa/Red Hat Text — có thể là font logo tuỳ biến hoặc SVG.
- **Nav links**: Home, "Shop All" (có caret ▾, click mở mega-menu), About us, Contact us, FAQ, SALE. Active/current page có gạch chân (underline) — quan sát thấy ở "Shop All" khi hover.
- **Search icon**: click → thanh search full-width thả xuống ngay trong header (không phải modal center), viền bo tròn, icon kính lúp trái, nút X đóng bên phải thanh header.
- **Account icon**: click → điều hướng ra ngoài tới Shopify Customer Accounts (external OAuth login), không phải trang login theme riêng.
- **Cart icon**: hình giỏ hàng, badge số lượng tròn nhỏ góc trên phải khi có sản phẩm; click → mở Cart Drawer (trượt từ phải).
- **Currency selector**: cờ quốc gia + mã tiền tệ (vd "🇨🇦 CAD $") + caret, dropdown đổi currency.
- **Background**: kem nhạt đồng nhất với section background chính (RGB ~249,245,236).
- **Padding/spacing**: header height ước lượng ~64–72px (estimated), khoảng cách giữa các nav item ~32px (estimated).

### 2.3 Mega-menu dropdown ("Shop All")
- **Vị trí**: full-width, xuất hiện ngay dưới header, đè lên nội dung trang (overlay), nền trắng kem.
- **Bố cục**: 5 cột — "Shop By" | "Kitchen & Dining" | "Home Essentials" | "Drinkware" | "Gift Ideas", mỗi cột có heading (font heading, có gạch chân mảnh dưới heading) + danh sách link dọc. Bên phải cùng: 1 ảnh sản phẩm hình tròn/oval với viền outline mảnh lệch tâm trang trí (motif lặp lại nhiều nơi trên site).
- **Spacing**: padding container lớn, khoảng cách giữa cột đều nhau (grid).
- **Interaction**: click để mở/đóng (không phải chỉ hover — xác nhận qua thao tác thực tế), có animation fade/slide nhẹ.

### 2.4 Hero section
- **Vị trí**: ngay dưới Header, full-width, full-bleed (không container), cao gần full-viewport (~560–650px desktop, estimated).
- **Nội dung**: 1 ảnh minh hoạ digital-illustration phong cách "cozy" (phòng khách/bếp với gấu bông, gấu trúc hoạt hình) làm nền toàn bộ hero.
- **Text overlay** (canh giữa, màu trắng, đổ bóng nhẹ để nổi trên ảnh):
  - Heading lớn (serif, Yrsa): "Creating cozy moments in every corner"
  - Dòng phụ: "Bowls · Plates · Mugs · Gifts · Home Decor" (danh mục, cách nhau bằng dấu ·)
  - Text nhỏ: "Welcome to Wuli Home"
  - Button chính: "Shop Now" — pill/rounded-full, nền hồng đất (button color mặc định theme), chữ trắng kem.
- **Image ratio**: gần như ảnh landscape rộng, tỉ lệ ước lượng ~2.2:1 (estimated, do full-bleed + responsive crop).
- **Responsive**: (estimated) ảnh giữ full-bleed, text scale nhỏ lại, có thể giảm chiều cao hero trên mobile.

### 2.5 Marquee ticker (banner chạy chữ)
- **Vị trí**: ngay dưới Hero, dải ngang mỏng.
- **Nội dung**: text lặp lại liên tục cuộn ngang (marquee/infinite scroll): "✨ FREE GIFT WRAPPING – Mark it as a gift before adding to cart✨"
- **Background**: xanh mint nhạt (RGB ~211,230,223 hoặc ~239,248,245).
- **Interaction**: auto-scroll ngang liên tục, tốc độ chậm, không dừng khi hover (chưa xác nhận pause-on-hover).

### 2.6 "Shop by Category" section
- **Heading**: "Shop by Category", serif, canh giữa, cỡ lớn (H2).
- **Grid**: 4 cột × 2 hàng (desktop) = 8 category tile: Bestsellers, Popular Restocks, Bowls, Plates, Ceramic Mugs, Cute Glassware, Home Storage, Home Accessories.
- **Card structure**: ảnh **hình tròn** (circle mask, không phải vuông/bo góc), label text canh giữa bên dưới ảnh (không có background/border quanh label).
- **Image ratio**: 1:1 crop tròn.
- **Spacing**: gap đều giữa các tile theo lưới (ước lượng gap ~30px ngang theo biến `--grid-desktop-horizontal-spacing: 30px`, dọc `10px` — giá trị **xác nhận từ CSS**).
- **Hover**: có khả năng scale nhẹ ảnh khi hover (estimated, phổ biến với theme này).
- **Background**: nền kem chính của trang.

### 2.7 "New Arrivals" — Product grid section
- **Heading**: "New Arrivals" (H2, serif) + subheading italic "New pieces to brighten your day".
- **Grid**: 4 cột × 2 hàng = 8 sản phẩm (desktop).
- **Product card structure** (chi tiết ở mục 3), gồm: ảnh sản phẩm (bo góc ~16px), overlay "Add To Cart" pill khi hover, badge giảm giá góc trái trên nếu sale, tên sản phẩm (link, gạch chân khi hover), vendor "WULI HOME" (uppercase, nhỏ, xám), giá (regular hoặc sale+strikethrough hoặc "From $X").
- **CTA cuối section**: nút "View More" (pill, outline hoặc nền nhạt) canh giữa bên dưới grid.

### 2.8 "About Wuli Home" section
- **Bố cục**: 2 cột (desktop) — trái là text block, phải là ảnh.
- **Background**: xanh mint (RGB ~211,230,223).
- **Cột trái**: heading "About Wuli Home" (serif) → dòng nhỏ "Since 2022" (label, letter-spacing rộng, uppercase-ish) → đoạn văn mô tả thương hiệu → button "Shop All" (pill, outline hoặc nền nhạt).
- **Cột phải**: ảnh sản phẩm với **mask hình oval/hữu cơ bất đối xứng** có viền outline mảnh lệch tâm bao quanh — đây là **motif hình ảnh đặc trưng lặp lại nhiều nơi trên site** (mega-menu, about section...). Cần custom SVG clip-path hoặc mask image để tái tạo chính xác.
- **Image ratio**: ảnh gần vuông/hơi ngang, crop theo mask hữu cơ (estimated tỉ lệ khung chứa ~4:3).

### 2.9 Reviews carousel ("Reviews from Our Wuli Family")
- **Rating summary**: badge tròn "✓ 4.9" + 5 sao đầy + text "4.9 out of 5 stars based on 845 reviews" + "Verified ✓" (icon check màu xanh mint).
- **Heading**: "Reviews from Our Wuli Family" (serif, canh giữa) + dòng phụ nhỏ "We hope to bring joy to your table ✓".
- **Carousel**: hiển thị 3 review card cùng lúc (desktop), mỗi card: ảnh vuông bo góc nhẹ bên trái + (sao rating, đoạn review ngắn, tên reviewer, tên sản phẩm dạng link) bên phải.
- **Interaction**: **auto-rotate** (xác nhận: nội dung tự đổi giữa 2 lần chụp màn hình cách nhau vài giây), có nút mũi tên trái/phải (‹ ›) 2 bên để điều hướng thủ công.
- **Animation**: có fade-in khi section vào viewport (quan sát thấy trạng thái low-opacity transitioning khi cuộn tới).
- **Background**: kem nhạt.

### 2.10 "Wuli Home on Instagram"
- **Heading**: "📸 Wuli Home on Instagram" (có icon camera).
- **Background**: xanh mint.
- **Carousel ảnh**: 5 ảnh vuông cùng lúc hiển thị (desktop), bo góc nhẹ, có nút mũi tên trái/phải điều hướng thủ công. Nội dung: ảnh behind-the-scenes đóng gói đơn hàng.
- **Interaction**: carousel kéo/click mũi tên (chưa xác nhận autoplay cho phần này, khác với Reviews).

### 2.11 "Popular Restocks" — Product grid section 2
- Cấu trúc y hệt "New Arrivals" (4×2 grid, "View More" CTA), heading "Popular Restocks" + subheading "Your favorites are back - limited stock available".
- Có sản phẩm badge sale (vd "32% Off").

### 2.12 FAQ section (Homepage)
- **Background**: hồng đất/dusty rose (RGB ~236,198,190) — cùng tông với announcement bar tầng 1.
- **Heading**: "Frequently Asked Question" (chú ý: số ít — nguyên văn trên site), serif, italic, canh giữa.
- **Accordion**: 4 câu hỏi dạng thanh ngang bo góc lớn (pill-like rectangle), nền kem sáng nổi trên nền hồng, mỗi item có nút tròn "+" bên phải (đổi thành "–" khi mở, xác nhận qua trang PDP dùng cùng icon).
- **Câu hỏi liệt kê**: "What are the shipping cost?", "What are the estimated delivery times for orders?", "How can I contact customer service?", "How do I redeem my welcome promotion?"

### 2.13 Contact form section (Homepage)
- **Heading**: "Contact Us" (serif, bold, canh giữa) + subheading "Got questions? Fill out the form below."
- **Form** (canh giữa, max-width hẹp ~500px estimated): Name*, Email*, Phone Number (không bắt buộc), "Leave a Message" label + Comment* (textarea).
- **Input style**: border mảnh, bo góc nhỏ (không phải pill — khác với button), background trong suốt/kem.
- **Button**: "Send" — pill, nền hồng đất (button màu mặc định theme).
- **Text xác nhận** dưới form: "We'll reply in 12 hours – thanks for reaching out!"

### 2.14 Newsletter signup ("Join the Wuli Home Fam!")
- **Background**: xanh mint.
- **Heading**: "Join the Wuli Home Fam!" (serif, canh giữa).
- **Subheading**: "SIGN UP FOR FUN NEWS, EXCLUSIVE DEALS, AND EVERYTHING YOU'LL LOVE!" (uppercase, letter-spacing rộng).
- **Form inline**: input email (bo góc nhẹ, khá rộng) + button "Subscribe" (pill, liền kề bên phải input, cùng hàng).

### 2.15 Footer
- **Cột liên kết (4 cột)**: HOME (All Collections, FAQ, Privacy Policy), SHOP (Bestsellers, New Arrivals, Popular Restock), ABOUT US (Our Story, Gift Wrapping, Privacy Policy), CONTACT US (Customer Service, Refund Policy, Shipping Policy). Heading cột: uppercase, letter-spacing rộng, nhỏ, đậm.
- **Cột phải**: Currency selector (dropdown, cùng style header) + button "Follow on shop" (nền tím Shop Pay, icon trái tim, bo góc pill).
- **Payment icons row**: Amex, Apple Pay, Diners, Discover, Google Pay, JCB, Maestro, Mastercard, PayPal, Shop Pay, UnionPay, Visa — hiển thị dạng icon thẻ nhỏ, 2 hàng.
- **Bottom bar**: "Powered By Shopify" (trái) + policy links ngang hàng (phải): Search, About Us, Contact Us, Shipping Policy, Privacy Policy, Return&Refund Policy, Terms of Service.
- **Background**: kem nhạt (khác nền mint phía trên).

### 2.16 Floating elements toàn site
- **Nút "Get 10% OFF"**: tab dọc cố định (fixed) cạnh trái màn hình, xoay 90°, nền hồng đất, click mở lại popup email signup. Có nút X nhỏ để ẩn tab.
- **Popup email signup** (hiện tự động khi vào trang lần đầu, sau vài giây hoặc dựa trên session): modal canh giữa màn hình, ảnh sản phẩm bên trái, form bên phải: logo, heading "Welcome to Wuli Home", subheading "Join our little Wuli club and enjoy 10% off your first purchase.", input Email address, button "GET MY 10% OFF" (pill, nền hồng), link text "No, thanks", disclaimer nhỏ về unsubscribe. Nút X đóng góc trên phải modal.
- **Nút Scroll-to-top**: nút tròn nổi (floating action button) góc dưới phải, nền hồng nhạt, icon mũi tên lên, xuất hiện sau khi cuộn xuống một đoạn.

---

## 3. PRODUCT LISTING (Collection / Category page)

### 3.1 Banner đầu trang collection
- **Bố cục**: 2 cột — trái là heading tên collection (H1, serif, to) + mô tả collection (1-2 câu), phải là 1 ảnh đại diện bo góc lớn.
- **Background**: màu theo từng collection (vd Bowls & Sale dùng hồng đất; có thể đổi theo section background token của theme).
- **Đáy section** có đường cong (wave/blob shape) phân cách với nền trang bên dưới — chi tiết trang trí lặp lại.

### 3.2 Toolbar (Filter / Sort / đếm sản phẩm)
- **Hàng công cụ**: trái có "Filter" (icon slider ngang) + số lượng sản phẩm ("90 items") + 3 icon đổi mật độ lưới (3 cột nhỏ / 4 cột / 2 cột lớn — dạng icon toggle). Phải có "Sort By:" dropdown.
- **Sort options**: Featured (mặc định), Most relevant, Best selling, Alphabetically A-Z/Z-A, Price low→high/high→low, Date old→new/new→old.
- **Filter**: click mở **drawer trượt từ trái**, có nhóm filter dạng accordion: Availability, Price (input From/To dạng number, kèm "The highest price is $X" hint), + filter theo thuộc tính riêng của collection (vd "Bowl type", "Product type"). Footer drawer: "Remove All" (text link) + "Apply" (button pill).

### 3.3 Product Grid
- **Số cột mỗi hàng (desktop)**: mặc định **3 cột**; user có thể chuyển sang 4 cột (dày hơn) hoặc 2 cột (thưa hơn) qua icon toggle mật độ.
- **Card structure** (từ ngoài vào trong):
  1. Ảnh sản phẩm — bo góc `border-radius: 1.0rem` (16px, **xác nhận từ CSS `--product-card-corner-radius`**), tỉ lệ gần vuông 1:1 (estimated, ảnh thực tế đa dạng do là ảnh lifestyle chụp tay cầm sản phẩm).
  2. Badge giảm giá — pill nhỏ góc trên-trái ảnh, nền đỏ san hô (~coral/red), chữ trắng, vd "27% Off", "32% Off".
  3. Badge khác: "Bestseller" (text nhỏ phía trên tên sản phẩm ở 1 số listing), "Sold Out" (thay thế nút Add to Cart, disabled).
  4. **Hover overlay**: nút "Add To Cart" pill xuất hiện đè giữa ảnh khi hover (desktop) — với sản phẩm có nhiều biến thể, nút đổi thành "Choose Options" (mở quick-add hoặc điều hướng PDP).
  5. Tên sản phẩm — link, 2 dòng tối đa, hover có gạch chân.
  6. Vendor — "WULI HOME", uppercase, cỡ chữ nhỏ, màu xám nhạt.
  7. Giá — Regular: "$11.99 CAD". Sale: "$10.99 CAD" + "$14.99 CAD" gạch ngang (sale trước, gốc gạch sau). Có biến thể: "From $12.00 CAD" khi sản phẩm có nhiều mức giá theo variant.
- **Rating**: **không quan sát thấy rating/sao hiển thị trực tiếp trên card** ở PLP (rating chỉ xuất hiện trên PDP).
- **Quick add**: nút "Add To Cart" hover-overlay thêm thẳng vào giỏ (sản phẩm 1 variant); sản phẩm nhiều variant hiện "Choose Options" thay vì add trực tiếp.
- **Pagination**: dạng **số trang** (1 2 3 … 8), không phải infinite scroll, không phải "Load More" — click số trang tải lại danh sách (có thể AJAX, cần xác minh thêm — estimated là full reload vì đổi URL `?page=`).

### 3.4 Nội dung SEO bên dưới grid (đặc trưng của theme)
Sau product grid + pagination, còn có:
- "About Our [Category]" — đoạn văn mô tả SEO.
- "Find Your Perfect [Category]" — sub-category card links (ảnh + label, 3 cột).
- "[Category] Questions & Care" — FAQ accordion riêng cho collection đó.
- Newsletter signup lặp lại.

### 3.5 Search Results page
- Dùng chung layout PLP, thay banner heading/description bằng 1 ô **Search input** to (căn giữa, trong banner màu hồng đất) hiển thị lại từ khoá đã tìm + nút X xoá + icon search.
- Tiêu đề trang (browser tab): "Search: {N} results found for "{query}"".
- Có Suggestions (gợi ý từ khoá liên quan) + Products preview (tối đa 4 sản phẩm với ảnh/tên/giá) trong dropdown gõ tìm kiếm real-time trước khi Enter.

---

## 4. PRODUCT DETAIL (PDP)

### 4.1 Bố cục tổng thể
2 cột desktop: **trái** = Gallery (thumbnail dọc + ảnh chính), **phải** = thông tin mua hàng (sticky khi cuộn — cần xác nhận thêm, estimated có sticky vì layout 2 cột không đều chiều cao). Bên dưới full-width: accordion chi tiết → Reviews → About Wuli Home (4 cột trust) → Recently Viewed → Newsletter.

### 4.2 Image Gallery
- **Thumbnail**: cột dọc bên trái ảnh chính, 4 thumbnail vuông bo góc nhẹ hiển thị cùng lúc (có thể cuộn nếu nhiều hơn).
- **Main image**: lớn, bo góc, có mũi tên trái/phải nhỏ overlay để chuyển ảnh (quan sát icon "‹" góc phải ảnh chính).
- Khi đổi **variant** (vd Style: Set of 5 → Set of 9), toàn bộ gallery (thumbnail + ảnh chính) **cập nhật theo variant** — xác nhận qua thao tác thực tế.
- Click ảnh → có thể mở gallery view lớn hơn (text ẩn "Image 8 is now available in gallery view" xuất hiện trong DOM khi tương tác — gợi ý có lightbox/zoom, chưa chụp được UI trực tiếp).

### 4.3 Product Info (cột phải)
Thứ tự quan sát được (lưu ý: với sản phẩm có variant, **variant selector nằm TRÊN CÙNG**, trước cả tên sản phẩm — thứ tự khác thường, cần lưu ý khi rebuild):
1. **Variant selector** (nếu có nhiều variant) — label "Style" (hoặc tên option khác), các option hiển thị dạng **button/pill outline**, option đang chọn có viền đậm nổi bật. Chọn variant → cập nhật ảnh, giá, URL (`?variant=...`) theo kiểu client-side, không reload trang.
2. **Tên sản phẩm** (H1, serif, bold).
3. **Giá** — "Regular price" label nhỏ phía trên, giá lớn bên dưới.
4. **Trạng thái tồn kho**: chấm tròn xanh lá + text "In stock" (hoặc trạng thái khác khi hết hàng — chưa quan sát trực tiếp, estimated "Sold out"/nút disabled).
5. **Rating sao + số lượng review** (chỉ hiện nếu có review, vd "★★★★★ 3 reviews") — nằm dưới stock status, không phải ngay dưới tên.
6. **Nút Add To Cart** — outline (viền, nền trong suốt), pill, full-width cột phải.
7. **Nút "Buy with Shop"** — nền tím Shop Pay, full-width, ngay dưới Add To Cart.
8. **"More payment options"** — text link canh giữa, mở thêm các nút thanh toán nhanh khác (Google Pay, PayPal...).
9. **Toggle "Add Gift Wrapping"** — switch on/off, kèm caption "Gift wrapping may take an additional 1–2 business days for processing."
10. **"Expected delivery date: Aug 20 - Aug 26"** — ước tính ngày giao hàng động (tính theo ngày hiện tại).
11. **Trust badges 3 dòng** (icon + text): "Refund for damaged items", "Top-quality products guaranteed", "Free shipping on orders over $49".
12. **"Share:"** + icon: generic share, Facebook, X (Twitter), Pinterest.
- **Quantity selector**: **không xuất hiện trên PDP chính** (mua mặc định số lượng 1; điều chỉnh số lượng được thực hiện sau đó trong Cart Drawer/Cart page bằng stepper − / +). Đây là điểm khác biệt cần lưu ý.

### 4.4 Accordion chi tiết (dưới gallery, full-width)
5 mục accordion, dùng icon trái tim (♡) bên trái tiêu đề + nút tròn "+"/"–" bên phải:
- **DETAILS** — thường mở sẵn mặc định, chứa thông số kích thước/dung tích dạng bullet đơn giản (text thuần, cách nhau bằng " | ").
- **FEATURES**
- **MATERIALS**
- **CARE INSTRCTION** (nguyên văn — có lỗi chính tả trên site gốc, "INSTRCTION" thay vì "INSTRUCTION"; khi rebuild nên sửa lỗi chính tả này thay vì giữ nguyên).
- **SHIPPING & RETURN**

### 4.5 Customer Reviews
- Nếu chưa có review: "Be the first to write a review" + 5 sao rỗng.
- Nếu có review: tổng quan "X.XX out of 5 — Based on N reviews" + biểu đồ phân bố sao (5→1 sao, dạng thanh ngang số lượng mỗi mức — quan sát qua text "3 / 0 / 0 / 0 / 0"). Sort dropdown: Most Recent, Highest/Lowest Rating, Only Pictures, Pictures First, Videos First, Most Helpful. Mỗi review: thời gian tương đối ("1 year ago"), tên, nội dung.

### 4.6 "About Wuli Home" trust section (lặp lại trên PDP)
4 cột: Brand Story / Customer First / Thoughtful Design / Sustainability — mỗi cột heading nhỏ + đoạn mô tả ngắn.

### 4.7 Related & Recently Viewed
- **"You May Also Like"** — grid 4 cột sản phẩm liên quan, cùng structure card như PLP.
- **"Recently Viewed"** — danh sách sản phẩm vừa xem (lưu client-side, có thể localStorage/cookie), hiển thị tên + giá, không có ảnh trong bản text-extract (cần xác minh có ảnh thumbnail hay không — estimated có ảnh, giống pattern card khác).

### 4.8 Sticky elements / Mobile behavior
- **Không xác nhận được** hành vi sticky add-to-cart bar khi cuộn (phổ biến trong theme Dawn-based nhưng chưa quan sát trực tiếp trong phiên này) — đánh dấu **estimated**.
- Mobile gallery/behavior: **chưa xác nhận được bằng screenshot thực** (xem mục 9). Theo pattern chuẩn của theme Dawn-family: gallery chuyển thành swipe carousel ngang, cột phải xếp xuống dưới gallery full-width.

---

## 5. CART FLOW

### 5.1 Add to Cart
- Từ PLP: hover card → click "Add To Cart" overlay → thêm thẳng (không mở PDP), mở Cart Drawer.
- Từ PDP: click "Add To Cart" → nút chuyển trạng thái loading (nền đổi màu nhạt hơn, disabled) → Cart Drawer tự động trượt mở từ phải.

### 5.2 Cart Drawer (slide-over từ phải)
- **Header**: "Your Cart" + badge số lượng item, nút đóng "×" góc phải.
- **Banner tiến độ free-shipping**: "Free Shipping On Orders Above $49" (nền mint, hiện cố định phía trên danh sách item — có thể là progress bar động khi gần đạt ngưỡng, chưa xác nhận có thanh progress trực quan hay chỉ text tĩnh).
- **Line item**: ảnh thumbnail vuông bo góc, vendor "WULI HOME", tên sản phẩm (bold), giá đơn vị, dòng variant ("Style: Set of 9"), dòng "Gift Wrapping: Yes/No", quantity stepper (− / số / +), link "Remove", giá thành tiền bên phải (căn phải theo hàng).
- **"Add Order Note"** — accordion mở rộng thêm textarea ghi chú đơn hàng.
- **Nút "View Cart (N)"** — outline, dẫn tới `/cart`.
- **Nút "Check Out - $XX.XX CAD"** — pill, nền hồng đậm (primary), full-width.
- **Text phụ**: "Taxes and shipping calculated at checkout" (chữ "shipping" là link).
- **"Continue Shopping"** — text link + icon mũi tên, canh phải dưới cùng, đóng drawer.

### 5.3 Cơ chế Gift-With-Purchase (GWP) theo tầng — **tính năng đặc trưng quan trọng**
- Khi giỏ hàng đạt ngưỡng chi tiêu nhất định (theo chương trình "4th Anniversary"), hệ thống **tự động thêm 1 sản phẩm quà tặng miễn phí vào giỏ** (giá gốc hiển thị gạch ngang, giá bán = $0.00, nhãn "4th Anniversary Special Gift").
- Cart hiển thị thông báo tiến độ: "Anniversary Gifts Added! 🎉" (banner có thể mở/thu gọn — quan sát icon chevron) và gợi ý mốc tiếp theo dạng "{Tên quà} — ${còn thiếu} away to unlock!" để khuyến khích mua thêm.
- Quà tặng có thể **tăng/giảm số lượng hoặc bị xoá** như item thường (có nút −/+/Remove), nhưng về nguyên tắc là logic tự động add/remove theo subtotal (cần app riêng hoặc Shopify Functions / script để tái tạo — **không phải tính năng cơ bản của theme**).

### 5.4 Trang Cart đầy đủ (`/cart`)
- **Heading**: "Your Cart" (to, canh giữa, trên nền hồng đất, có hiệu ứng đường cong đáy giống banner collection) + "Continue Shopping" link.
- **Bảng 3 cột**: "Items | Quantity | Total" (header bảng, chữ nhỏ uppercase-ish).
- Mỗi dòng: ảnh + vendor + tên + giá đơn vị (+ dòng variant nếu có) ở cột Items; stepper −/số/+ + icon thùng rác (delete) ở cột Quantity; thành tiền ở cột Total (gạch ngang giá gốc nếu là item giảm giá/miễn phí).
- **"You Might Also Like"** — cross-sell grid sản phẩm ngay dưới bảng giỏ hàng (cùng card structure PLP, Add To Cart/Choose Options).
- **"Add Order Note"** — accordion.
- **Subtotal / Total** — hiển thị 2 dòng (giống nhau nếu chưa tính thuế/ship, vì "Taxes and shipping calculated at checkout").
- **"Delivery Time: 2-8 Days (Varies by Location)"** — text thông tin giao hàng.
- **Banner GWP** — "Free Shipping On All Orders Above $49" + chi tiết quà tặng đã mở khoá / mốc tiếp theo (như mục 5.3), có thể expand/collapse ("Anniversary Gifts Added! 🎉" với chevron).
- **Nút "Check Out"** — pill, full-width, primary.
- **Express checkout buttons**: Shop Pay (tím) / PayPal (vàng) / Google Pay (đen) — 3 nút lớn ngang hàng ngay dưới Check Out.
- **Payment icons row** — dàn 2 hàng nhỏ bên dưới (Amex, Apple Pay, Diners, Discover, Google Pay, JCB, Maestro, Mastercard, PayPal, Shop, UnionPay, Visa).
- Newsletter signup lặp lại cuối trang.

### 5.5 Quantity update / Remove
- Stepper − / + cập nhật **AJAX**, không reload trang; số lượng và tổng tiền cập nhật gần như tức thời (có delay loading ngắn quan sát được).
- "Remove"/icon thùng rác xoá item khỏi giỏ ngay lập tức (AJAX).

### 5.6 Coupon
- **Không có ô nhập coupon trong Cart Drawer hay trang Cart** — mã giảm giá chỉ nhập được ở **bước Checkout** (ô "Discount code or gift card" + nút "Apply").

---

## 6. CHECKOUT

> Đây là **Shopify hosted Checkout** — giao diện độc lập với theme, được Shopify kiểm soát hoàn toàn (không tuỳ biến layout được ngoài màu sắc/logo cơ bản qua Shopify Admin). Khi rebuild website mới, nếu **không dùng Shopify**, cần tự thiết kế checkout riêng theo flow tương đương dưới đây; nếu **dùng Shopify**, checkout mặc định của Shopify sẽ tự động thay thế phần này và không cần/không nên cố pixel-match.

### 6.1 Loại checkout
- **Guest checkout được hỗ trợ đầy đủ** — không bắt buộc tạo tài khoản. Có link "Sign in" ở góc phải mục Contact (tuỳ chọn, không bắt buộc).
- Có thể tạo tài khoản sau khi checkout xong (pattern chuẩn Shopify), hoặc đăng nhập trước qua Shopify Customer Accounts (external OAuth).

### 6.2 Bố cục
2 cột: **trái** = form nhập liệu theo từng bước, **phải** = order summary (sticky).

### 6.3 Các bước / section quan sát được (bước 1 — Information)
1. **Express checkout** — hàng nút Shop Pay / (2 nút khác, có thể PayPal/Google Pay) ở trên cùng, rồi dòng chữ "OR" phân cách.
2. **Contact** — Email hoặc số điện thoại (1 input dùng chung), checkbox "Email me with news and offers", link "Sign in" góc phải heading.
3. **Delivery**:
   - Country/Region (dropdown, mặc định Canada)
   - First name / Last name (2 input cùng hàng)
   - Company (optional)
   - Address (có icon search/autocomplete địa chỉ)
   - Apartment, suite, etc. (optional)
   - City / Province (dropdown) / Postal code (3 input cùng hàng)
   - Phone (có icon info/tooltip)
4. (Chưa quan sát trực tiếp do dừng lại để tránh nhập dữ liệu cá nhân thật — theo chuẩn Shopify, các bước tiếp theo là) **Shipping method** (chọn hãng/tốc độ vận chuyển, hiển thị giá từng option) → **Payment** (card number/expiry/CVC hoặc ví điện tử, cùng "Billing address" chọn giống/khác shipping) → **Review & Pay**.

### 6.4 Order summary (cột phải, sticky)
- Danh sách line items thu nhỏ (ảnh + badge số lượng + tên + variant + giá), gồm cả item quà tặng GWP (giá $0.00, nhãn "4TH ANNIVERSARY SPECIAL GIFT (-$3.00)").
- Ô **"Discount code or gift card"** + nút "Apply".
- **Subtotal · N items**, **Shipping** ("Enter shipping address" placeholder trước khi nhập), **Estimated taxes**.
- **Total** (to, nổi bật, kèm mã tiền tệ "CAD").
- **"TOTAL SAVINGS $X.XX"** — tổng tiết kiệm được từ giảm giá/quà tặng (icon tag).

### 6.5 Validation / Error / Success states
- **Chưa quan sát trực tiếp** (không submit form với dữ liệu thật). Theo chuẩn Shopify Checkout: validate realtime từng field khi blur, hiển thị message đỏ dưới field lỗi, border field chuyển đỏ; nút submit disable khi form invalid; success dẫn tới trang "Thank you" (order confirmation) hiển thị order number, summary, và (nếu áp dụng) tuỳ chọn tạo tài khoản.

---

## 7. VISUAL DESIGN — Design System

> Toàn bộ giá trị dưới đây được **trích trực tiếp từ CSS Custom Properties (`:root`) và computed style** của site — không phải ước lượng, trừ khi ghi chú "estimated".

### 7.1 Typography
| Token | Giá trị |
|---|---|
| Heading font-family | `Yrsa, serif` (Google Font, serif có chân, phong cách ấm/vintage nhẹ) |
| Body font-family | `"Red Hat Text", sans-serif` (Google Font, sans-serif hiện đại, dễ đọc) |
| H1 | 40px / weight 400 / màu `rgb(92,84,84)` |
| H2 | 26px / weight 700 / line-height 31.2px |
| H3 | 26px / weight 400 / line-height 31.2px |
| Body (base) | 14px / weight 400 / line-height 19.6px |
| Body large | 1.8rem (~28.8px, biến `--body-font-large`) |
| Body medium | 1.4rem (~22.4px) |
| Body small | 1.3rem (~20.8px) |
| Heading weight variants | 400 (regular) / 500 (medium) / 600 (semi-bold) / 700 (bold) |
| Button font-size | 1.6rem (~25.6px desktop & mobile — giống nhau) |
| Button font-weight | 400 |
| Text màu chính (base text & heading) | `rgb(92,84,84)` — nâu xám ấm |
| Text phụ (secondary) | `rgb(249,245,236)` (dùng trên nền tối) |
| Heading phụ (secondary heading) | `rgb(236,198,190)` |

*Ghi chú*: Không quan sát trực tiếp được H4-H6, letter-spacing cụ thể cho uppercase label (vd "WULI HOME" vendor text) — **estimated**: letter-spacing ~0.05em, font-size ~11-12px, weight 500.

### 7.2 Color Palette
| Tên | RGB | Vai trò |
|---|---|---|
| Cream / Background chính | `rgb(249,245,236)` | Nền toàn site mặc định |
| Background section 1 | `rgb(250,250,247)` | Nền phụ gần trắng (announcement bar tầng 2) |
| Background section 2 (Mint) | `rgb(211,230,223)` | About, Instagram, Newsletter section |
| Background section 3 (Mint nhạt) | `rgb(239,248,245)` | Marquee ticker |
| Background section 4 (Dusty rose) | `rgb(236,198,190)` | Announcement bar tầng 1, FAQ section, Collection banner, Button chính |
| Background section 5 | `rgb(0,0,0)` | (dự phòng — không quan sát thấy dùng rõ ràng) |
| Text / Heading chính | `rgb(92,84,84)` | Nâu xám ấm — dùng cho toàn bộ text |
| Button background | `rgb(236,198,190)` | Nền nút chính (pill) |
| Button text | `rgb(250,250,247)` | Chữ trên nút chính |
| Button hover bg | `rgb(236,198,190)` (không đổi) | Hover chỉ đổi màu chữ |
| Button hover text | `rgb(92,84,84)` | Đổi từ trắng → nâu khi hover |
| Badge giảm giá | Đỏ san hô/coral (estimated hex `#E4635C`–`#E86B5F`, cần đo lại chính xác) | Nền badge "% Off" |
| Rating/Verified icon | Xanh mint đậm hơn nền (estimated `#7FAE9E` vùng) | Icon check "Verified" |

### 7.3 Buttons
- **Border-radius**: `40px` (pill hoàn toàn — biến `--buttons-radius` / `--buttons-border-radius`).
- **Border-size**: `1px`.
- **2 biến thể quan sát được**: Solid (nền hồng đất, chữ kem — dùng cho CTA chính "Shop Now", "Send", "Check Out") và Outline (viền mảnh, nền trong suốt, chữ nâu — dùng cho "Add To Cart" trên PDP, "View Cart").
- **Shop Pay button**: nền tím đặc trưng thương hiệu Shop Pay (không tuỳ biến theo theme, giữ nguyên brand color `#5A31F4` hoặc tương đương).

### 7.4 Inputs
- **Border-radius**: `0` (input vuông góc — khác hẳn button bo tròn hoàn toàn — biến `--inputs-radius: 0`). *(Lưu ý: quan sát thực tế trên form Contact thấy input có bo góc nhẹ chứ không hoàn toàn vuông — có thể input field áp dụng thêm class riêng khác biến gốc; **cần xác nhận thêm**, estimated bo góc nhẹ ~4-6px thực tế dù biến CSS khai báo 0.)*
- **Border**: mảnh, màu nâu nhạt/xám.

### 7.5 Product Card
- **Corner radius**: `1.0rem` (16px, biến `--product-card-corner-radius`).
- **Image padding**: `0px` (ảnh full-bleed trong khung card, không có padding trắng quanh ảnh).
- **Border-width**: `0px` (không viền).
- **Shadow**: mặc định **tắt** (`--product-card-shadow-visible: 0`), nhưng có token sẵn (offset-v 0.4rem, blur 0.5rem) — có thể bật ở 1 số biến thể card.
- **Text alignment**: left (căn trái toàn bộ text trong card, kể cả khi ảnh canh giữa).

### 7.6 Media / Ảnh nói chung
- **Media border-radius mặc định**: `8px`.
- **Border-width**: `0px`.
- Motif đặc trưng: **mask hình tròn** (category tile) và **mask hình oval/hữu cơ bất đối xứng có viền outline mảnh lệch tâm** (about section, mega-menu) — 2 kiểu crop khác biệt dùng ở 2 ngữ cảnh khác nhau, không phải bo góc chữ nhật thông thường.

### 7.7 Layout / Grid
- **Container width chính** (`--page-width` / `--header-width`): `120rem` (~1920px ở root font-size 16px — tức site cho phép container rất rộng trên màn hình lớn).
- **Grid spacing desktop**: horizontal `30px`, vertical `10px` (biến `--grid-desktop-horizontal-spacing` / `-vertical-spacing`).
- **Grid spacing mobile**: horizontal `20px`, vertical `6.67px`.
- **Số cột grid mặc định**: Homepage category/product sections = 4 cột desktop; PLP mặc định 3 cột (đổi được 2/3/4 qua toggle).

### 7.8 Shadow
- `--color-shadow: rgb(92,84,84)` — màu shadow dùng chung (dựa trên màu text), độ mờ/opacity cụ thể **chưa xác nhận** (estimated alpha thấp ~0.08–0.15, blur nhẹ, dùng cho hover card nếu có).

---

## 8. RESPONSIVE DESIGN

> **Quan trọng**: Trong phiên phân tích này, công cụ resize viewport trình duyệt không hoạt động ổn định (bị giới hạn bởi môi trường sandbox), nên **không chụp được screenshot mobile thực tế**. Các breakpoint dưới đây được xác nhận qua **CSS media query thực tế của theme** (đáng tin cậy), còn hành vi layout mobile cụ thể là **suy luận (estimated)** dựa trên: (1) bằng chứng DOM cho thấy theme dùng cấu trúc `menu-drawer` / `header__icon--menu` chuẩn của họ theme Dawn, (2) biến CSS mobile riêng biệt đã trích xuất được, (3) hành vi tiêu chuẩn phổ biến của các theme Shopify cùng họ.

### 8.1 Breakpoints (xác nhận từ CSS)
| Breakpoint | Giá trị | Vai trò |
|---|---|---|
| Mobile / Small | `< 750px` (`max-width: 749px`) | Layout mobile — 1 cột, menu hamburger |
| Medium / Tablet | `750px – 989px` | Layout tablet — có thể 2 cột |
| Large / Desktop | `990px – 1199px` | Desktop chuẩn |
| Extra large | `≥ 1200px` | Desktop rộng, container tối đa `120rem` |

### 8.2 Column changes (estimated, theo chuẩn theme)
- Category grid & Product grid: 4 cột (desktop) → 2 cột (mobile), giữ 2-3 cột ở tablet.
- Reviews carousel: 3 card (desktop) → 1 card (mobile, swipe).
- About section 2 cột → xếp chồng dọc (ảnh trên/dưới text) trên mobile.
- Footer 4 cột → accordion xếp dọc hoặc 2 cột trên mobile (estimated).

### 8.3 Typography changes
- `--buttons-font-size-mobile` **giống hệt** desktop (1.6rem) — nút không giảm cỡ chữ trên mobile (xác nhận từ CSS, khác thường so với đa số theme).
- Heading (H1/H2) nhiều khả năng giảm cỡ trên mobile (estimated, chưa có biến riêng xác nhận).

### 8.4 Navigation changes
- Header desktop: nav ngang đầy đủ. Mobile: **hamburger icon** (xác nhận qua DOM class `header__icon--menu`) mở **menu-drawer** (trượt, có class `dropdown color-bg-1`) chứa toàn bộ nav + mega-menu dạng accordion lồng nhau (estimated cấu trúc accordion do mega-menu desktop có nhiều cấp).
- Search: trên mobile thường icon riêng mở full-screen overlay thay vì thanh dropdown trong header (estimated).

### 8.5 Image behavior
- Ảnh full-bleed hero: giữ full-bleed, có thể đổi tỉ lệ khung hình qua `<picture>`/art-direction hoặc chỉ crop qua CSS object-fit (estimated).
- Category circle & organic-mask images: giữ nguyên tỉ lệ mask, chỉ scale kích thước.

### 8.6 Card behavior
- Product card: ảnh + info giữ nguyên cấu trúc, chỉ giảm số cột/tăng chiều rộng từng card.
- Hover overlay "Add To Cart": trên mobile (không có hover thật) — có khả năng **luôn hiển thị** nút hoặc yêu cầu tap ảnh trước rồi tap nút (estimated — cần xác nhận thêm khi test thiết bị thật).

### 8.7 Sticky elements
- Header sticky vẫn giữ trên mobile (phổ biến, estimated).
- Nút scroll-to-top và tab "Get 10% OFF" — giữ vị trí fixed, có thể thu nhỏ (estimated).

### 8.8 Mobile checkout
- Order summary chuyển từ cột phải (sticky) → **accordion thu gọn phía trên form** (pattern chuẩn Shopify Checkout mobile: "Show order summary ▾" tổng tiền tóm tắt, bấm để mở rộng). Đây là hành vi chuẩn của Shopify hosted checkout, độ tin cậy cao dù chưa test trực tiếp trên site này.

---

## 9. INTERACTIONS

| Interaction | Mô tả |
|---|---|
| **Hover (card)** | Overlay "Add To Cart"/"Choose Options" fade-in giữa ảnh sản phẩm; tên sản phẩm gạch chân. |
| **Hover (button)** | Đổi màu chữ (nền giữ nguyên) theo cặp biến `*-hover` trong CSS. |
| **Click (mega-menu)** | "Shop All" click → mở dropdown full-width; click lần nữa hoặc click nơi khác → đóng. |
| **Dropdown (Sort, Currency, Province)** | Dropdown chuẩn native/custom-styled. |
| **Modal (email popup)** | Xuất hiện tự động khi load trang (delay vài giây hoặc lần đầu ghé), đóng bằng nút X hoặc "No, thanks"; có thể mở lại qua tab "Get 10% OFF". |
| **Drawer (Cart)** | Trượt từ phải, overlay tối nền phía sau, đóng bằng X, click ngoài overlay, hoặc "Continue Shopping". |
| **Drawer (Filter)** | Trượt từ trái trên trang Collection. |
| **Drawer (Menu mobile)** | Trượt (hướng chưa xác nhận, estimated từ trái hoặc phải), chứa nav đầy đủ dạng accordion. |
| **Tabs** | Không quan sát thấy pattern "tabs" ngang truyền thống trên PDP (theme dùng accordion thay vì tabs cho Details/Features/Materials...). |
| **Accordion** | Dùng nhiều nơi: FAQ (trang chủ + PDP + collection), Product details, Add Order Note (cart), variant "About" sections. Icon "+"/"−" hoặc chevron. |
| **Carousel** | Reviews (auto-rotate + arrow nav), Instagram feed (arrow nav, chưa xác nhận autoplay), Product image gallery (arrow nav trên ảnh chính). |
| **Sticky header** | Header dính khi cuộn xuống, announcement bar cuộn mất. |
| **Scroll behavior** | Fade-in animation khi section vào viewport (quan sát rõ ở Reviews section — nội dung "mờ dần hiện ra"); marquee ticker auto-scroll ngang liên tục vô hạn. |
| **Loading state** | Nút Add To Cart chuyển nền nhạt hơn + có vẻ disabled trong lúc xử lý AJAX; số lượng trong Cart Drawer có độ trễ ngắn trước khi tổng tiền cập nhật. |
| **Transitions/Animations** | Fade + slight slide cho dropdown/drawer/modal; carousel dùng transition trượt ngang mượt. |
| **Variant switching** | Đổi ảnh gallery + giá + URL query `?variant=` theo thời gian thực, không reload trang (client-side JS, chuẩn Shopify AJAX API). |
| **GWP auto-add** | Khi đạt ngưỡng subtotal, hệ thống tự thêm sản phẩm quà tặng vào giỏ (server-side cart logic hoặc app/script, không phải hành động người dùng chủ động). |

---

## 10. USER FLOWS

**Flow A — Duyệt & mua từ Homepage**
`Homepage → (hover/click Product Card ở section "New Arrivals"/"Popular Restocks") → PDP → chọn variant (nếu có) → "Add To Cart" → Cart Drawer tự mở → "View Cart" (hoặc "Check Out" trực tiếp từ drawer) → /cart → điều chỉnh qty nếu cần → "Check Out" → Shopify Checkout (Contact → Delivery → Shipping method → Payment) → Order Confirmation`

**Flow B — Tìm kiếm sản phẩm**
`Homepage → click icon Search → gõ từ khoá → xem gợi ý real-time (Suggestions + tối đa 4 Products preview) → Enter / click "Search for '{query}'" → trang /search (layout PLP) → Filter/Sort nếu cần → click Product Card → PDP → Add To Cart → ... → Checkout`

**Flow C — Duyệt theo danh mục**
`Homepage → hover "Shop All" → mega-menu → click 1 category (vd "Bowls") → /collections/bowls → dùng Filter (Availability/Price/thuộc tính) và/hoặc Sort → duyệt qua các trang (pagination) → click Product Card → PDP → Add To Cart → Cart → Checkout`

**Flow D — Checkout → Thanh toán → Xác nhận đơn**
`Cart (/cart, có thể đã có quà GWP tự động) → "Check Out" → [Shopify hosted checkout] Contact (email/phone, tuỳ chọn Sign in) → Delivery (địa chỉ giao hàng) → chọn Shipping method → nhập Payment (card/ví điện tử) hoặc Express checkout (Shop Pay/PayPal/Google Pay) ngay từ đầu → Review đơn hàng (order summary có mã giảm giá, tổng tiền, thuế) → Submit/Pay → Order Confirmation (thank-you page, có thể kèm tạo tài khoản)`

**Flow phụ — Quick-add từ PLP (không qua PDP)**
`Collection/Search/Homepage grid → hover card → click "Add To Cart" overlay (chỉ với sản phẩm 1 variant) → Cart Drawer mở ngay, không rời trang hiện tại. Với sản phẩm nhiều variant: overlay hiện "Choose Options" → điều hướng sang PDP để chọn variant trước khi add.`

---

## 11. COMPONENT ARCHITECTURE (đề xuất)

```
App
├── Layout
│   ├── AnnouncementBar (2 dòng luân phiên/tĩnh)
│   ├── Header
│   │   ├── Logo
│   │   ├── NavMenu
│   │   │   └── MegaMenuDropdown (5 cột link + ảnh)
│   │   ├── SearchToggle
│   │   │   └── SearchOverlay (input + Suggestions + ProductPreview[])
│   │   ├── AccountLink
│   │   ├── CartToggle (badge count)
│   │   └── CurrencySelector
│   ├── CartDrawer
│   │   ├── FreeShippingProgressBar
│   │   ├── CartLineItem[] (image, title, variant, qty stepper, remove, price)
│   │   ├── GiftWithPurchaseBanner
│   │   ├── OrderNoteAccordion
│   │   └── CartFooter (ViewCartButton, CheckoutButton, taxNote)
│   ├── PromoPopupModal (email capture, delay-triggered)
│   ├── FloatingDiscountTab
│   ├── ScrollToTopButton
│   └── Footer
│       ├── FooterLinkColumn[]
│       ├── CurrencySelector
│       ├── PaymentIcons
│       └── LegalLinksBar
│
├── HomePage
│   ├── Hero (image, heading, subheading, CTAButton)
│   ├── MarqueeTicker
│   ├── CategoryGrid (CategoryTile[] — circle image + label)
│   ├── ProductSection (heading, subheading, ProductGrid, ViewMoreButton) — dùng lại cho "New Arrivals" & "Popular Restocks"
│   ├── AboutSplitSection (text block + organic-mask image)
│   ├── ReviewCarousel (RatingSummary, ReviewCard[])
│   ├── InstagramCarousel (ImageTile[])
│   ├── FAQAccordion
│   ├── ContactFormSection
│   └── NewsletterSignup
│
├── CollectionPage (PLP)
│   ├── CollectionBanner (title, description, image)
│   ├── Toolbar (FilterToggle, ItemCount, GridDensityToggle, SortDropdown)
│   ├── FilterDrawer (FilterGroup[]: Availability, Price, Attribute...)
│   ├── ProductGrid
│   │   └── ProductCard (image, DiscountBadge?, BestsellerBadge?, hoverAddToCart, title, vendor, price)
│   ├── Pagination
│   ├── CollectionSEOContent (description, SubCategoryLinks, CollectionFAQ)
│   └── NewsletterSignup
│
├── SearchResultsPage (tái sử dụng CollectionPage layout + SearchBanner)
│
├── ProductPage (PDP)
│   ├── ProductGallery (ThumbnailList, MainImage, ArrowNav)
│   ├── ProductInfo
│   │   ├── VariantSelector (option buttons/pills)
│   │   ├── ProductTitle
│   │   ├── PriceBlock (regular/sale/from)
│   │   ├── StockStatus
│   │   ├── RatingSummary
│   │   ├── AddToCartButton
│   │   ├── ShopPayButton / MorePaymentOptionsLink
│   │   ├── GiftWrappingToggle
│   │   ├── DeliveryEstimate
│   │   ├── TrustBadgeList
│   │   └── ShareLinks
│   ├── ProductAccordion (Details, Features, Materials, Care, Shipping&Return)
│   ├── ReviewsSection (RatingBreakdown, SortDropdown, ReviewList)
│   ├── BrandTrustGrid (4 cột)
│   ├── RelatedProductsGrid ("You May Also Like")
│   └── RecentlyViewedList
│
├── CartPage
│   ├── CartTable (Items | Quantity | Total)
│   ├── CrossSellGrid ("You Might Also Like")
│   ├── OrderNoteAccordion
│   ├── CartSummary (Subtotal, Total, DeliveryTimeNote)
│   ├── GiftProgressBanner
│   ├── CheckoutButton
│   └── ExpressCheckoutButtons (ShopPay, PayPal, GooglePay)
│
└── CheckoutFlow (nếu tự build; nếu dùng Shopify thì bỏ qua — dùng Shopify Checkout)
    ├── ExpressCheckoutRow
    ├── ContactStep
    ├── DeliveryStep
    ├── ShippingMethodStep
    ├── PaymentStep
    ├── OrderSummarySidebar (line items, discount code, totals)
    └── OrderConfirmationPage
```

*Không tạo thêm component nhỏ lẻ ngoài danh sách trên (vd không tách riêng "PriceLabel" khỏi "PriceBlock" nếu không có logic tái sử dụng thực sự khác biệt).*

---

## 12. DATA REQUIREMENTS (Data Model)

| Entity | Thuộc tính chính |
|---|---|
| **Product** | id, handle/slug, title, description(html), vendor, productType, tags[], images[] (url, alt, position), status(active/draft), createdAt, ratingAverage, reviewCount, seoTitle, seoDescription |
| **Variant** | id, productId, title (vd "Set of 5"), optionValues{Style: "Set of 5"}, price, compareAtPrice, sku, inventoryQty, inventoryPolicy(deny/continue), imageId, weight |
| **VariantOption** | name (vd "Style", "Color", "Size"), values[] |
| **Category / Collection** | id, handle, title, description, image, parentGroup (vd "Kitchen & Dining"), sortOrder, seo fields |
| **Cart** | id/token, lineItems[], subtotal, estimatedTax, estimatedShipping, total, currency, discountCode?, note?, giftItemsAutoApplied[] |
| **CartLineItem** | productId, variantId, quantity, priceAtAdd, giftWrappingSelected(bool), isGift(bool), isFreeGift(bool) |
| **Order** | id, orderNumber, customerId?(nullable cho guest), email, phone, lineItems[], shippingAddress, billingAddress, shippingMethod, subtotal, tax, shippingCost, discountTotal, total, currency, paymentStatus, fulfillmentStatus, createdAt |
| **Customer** | id, email, firstName, lastName, phone, acceptsMarketing(bool), defaultAddressId, addresses[], authProvider (guest/account) |
| **Address** | firstName, lastName, company?, address1, address2?, city, province/state, postalCode, country, phone |
| **Coupon/Discount** | code, type(percentage/fixed/freeShipping/giftItem), value, minimumSubtotal?, appliesTo(all/collection/product), startsAt, endsAt |
| **GiftWithPurchaseRule** | id, thresholdAmount, giftProductId, giftVariantId, campaignName ("4th Anniversary"), active(bool), maxPerOrder |
| **Payment** | method(card/shopPay/paypal/googlePay/applePay), status, transactionId, last4?(nếu card) |
| **Review** | id, productId, rating(1-5), authorName, body, createdAt, images[]?, helpfulCount?, verifiedPurchase(bool) |
| **Inventory** | variantId, quantityAvailable, policy(deny/continue selling), locationId? |
| **WishlistItem** (nếu áp dụng — không quan sát thấy tính năng wishlist trên site gốc) | — không có, đánh dấu **không cần** trừ khi yêu cầu thêm |

---

## 13. UI BEHAVIOR — tóm tắt các quy tắc quan trọng cần lập trình đúng

1. Quick-add trên card: sản phẩm 1 variant → add thẳng vào giỏ; sản phẩm nhiều variant → bắt buộc vào PDP hoặc quick-view để chọn variant trước ("Choose Options").
2. Đổi variant trên PDP phải đồng bộ: ảnh gallery, giá hiển thị, URL, trạng thái tồn kho — không reload trang.
3. Số lượng mua chọn ở PDP mặc định = 1 (không có input số lượng ở PDP); điều chỉnh số lượng thực hiện ở Cart.
4. Giỏ hàng có logic **tự động thêm/gỡ quà tặng miễn phí** theo ngưỡng subtotal — đây là business logic cần cấu hình được (ngưỡng, sản phẩm quà, số lượng tối đa), không hardcode.
5. Mã giảm giá chỉ nhập ở Checkout, không có ở Cart.
6. Card sản phẩm hiển thị giá theo 3 dạng: giá cố định, giá sale (kèm gạch ngang giá gốc), hoặc "From $X" khi các variant có giá khác nhau — logic tính "From" = giá variant thấp nhất.
7. Badge giảm giá % tính động = round((compareAtPrice − price) / compareAtPrice × 100).
8. Toàn site dùng button pill bo tròn hoàn toàn (radius 40px) nhưng input lại vuông/bo nhẹ — 2 hệ số bo góc khác nhau có chủ đích, không dùng chung 1 token.
9. Card ảnh sản phẩm bo góc 16px, ảnh category tile bo tròn 100% (circle), ảnh trang trí (about/mega-menu) dùng organic mask — 3 kiểu xử lý ảnh khác nhau tuỳ ngữ cảnh.

---

## 14. IMPORTANT IMPLEMENTATION NOTES

- **Nền tảng gốc là Shopify** — nếu website mới **không** build trên Shopify, các phần sau cần thiết kế lại hoàn toàn (không thể "sao chép" vì là hạ tầng độc quyền): Checkout, Customer Accounts/Login, Shop Pay button, Cart AJAX API, Variant/Inventory engine. Cần thay bằng: cổng thanh toán riêng (Stripe/PayPal...), hệ thống tài khoản riêng, cart state riêng (session/DB), inventory engine riêng.
- **Font Yrsa & Red Hat Text** đều là Google Fonts miễn phí, public — dùng lại được hợp pháp và giữ đúng cảm giác thương hiệu mà không vi phạm bản quyền.
- **Ảnh sản phẩm/lifestyle/illustration trên site gốc là proprietary** — không được tải/dùng lại. Cần chụp ảnh sản phẩm mới hoặc dùng ảnh minh hoạ/illustration tự thiết kế theo cùng phong cách "kawaii/cozy pastel" nếu muốn giữ trải nghiệm tương đương.
- **Toàn bộ copy text** (heading, mô tả, review...) trên site gốc là nội dung của Wuli Home — khi rebuild cho một thương hiệu khác, cần viết lại nội dung gốc, chỉ giữ **cấu trúc/pattern** (vd: có announcement bar 2 tầng, có FAQ 4 câu, có About với "Since {year}"...).
- **Cơ chế Gift-With-Purchase theo tầng** là điểm khác biệt hoá quan trọng của site này — nên xây dựng như 1 module cấu hình được (rule engine: ngưỡng $ → sản phẩm quà), không hardcode 1 khuyến mãi cố định, để dễ tái sử dụng cho các campaign sau.
- **Toyo/Dawn theme family**: cấu trúc HTML/CSS thực tế của theme là mã nguồn độc quyền của Shopify Theme Store — khi rebuild, viết lại từ đầu bằng framework lựa chọn của nhóm phát triển (Next.js/Remix/Nuxt/v.v.), chỉ tái tạo **hành vi và giao diện quan sát được**, không copy CSS/JS gốc.

---

## 15. CÁC ĐIỂM CHƯA XÁC ĐỊNH ĐƯỢC (unknowns)

- **Mobile viewport thực tế**: không chụp được screenshot mobile do giới hạn công cụ trong phiên làm việc này (resize trình duyệt không phản hồi đúng). Mọi mô tả mobile ở mục 8 là suy luận từ CSS breakpoint + kiến thức chuẩn về theme Dawn-family, **cần kiểm tra lại bằng thiết bị/DevTools thật trước khi thiết kế pixel-perfect**.
- Hành vi chính xác của accordion mega-menu trên mobile (thứ tự, có mở nhiều cấp cùng lúc hay không).
- Có sticky "Add to Cart" bar khi cuộn trên PDP hay không (phổ biến ở theme cùng họ nhưng chưa quan sát trực tiếp).
- Trạng thái "Sold Out" hiển thị nút gì thay "Add To Cart" trên PDP (chỉ quan sát được trên PLP: nút "Sold Out" disabled).
- Validation/error state cụ thể của Checkout (không submit form thật để kiểm tra, tránh gửi dữ liệu không cần thiết).
- Có infinite-scroll/AJAX pagination hay full page reload khi chuyển trang PLP (URL có đổi `?page=` nhưng chưa xác nhận cơ chế tải).
- Opacity/blur chính xác của shadow (`--color-shadow`) — chỉ biết màu gốc, chưa rõ alpha/blur/spread.
- Border-radius input thực tế (biến CSS khai báo `0` nhưng quan sát UI có vẻ bo nhẹ — có thể có class ghi đè riêng).
- Behavior "pause on hover" của marquee ticker và autoplay của Instagram carousel.
- Chính xác tỉ lệ khung hình (aspect-ratio) chuẩn hoá cho ảnh sản phẩm trên PLP (ảnh thực tế không đồng nhất 1:1 tuyệt đối, có thể theme dùng `object-fit: cover` trên khung cố định — cần đo thêm nhiều sản phẩm).
- Rating có hiển thị trên PLP card hay không ở các theme setting khác (site gốc hiện KHÔNG hiển thị, nhưng có thể là setting có thể bật/tắt).

---

## 16. TỔNG KẾT — Phân loại mức độ tái tạo

### ✅ Những gì CẦN clone chính xác (giữ nguyên trải nghiệm/pattern)
- Cấu trúc thông tin & luồng điều hướng (IA ở mục 1).
- Thứ tự và nội dung-loại của các section Homepage (Hero → Marquee → Category → Product grids → About → Reviews → Instagram → FAQ → Contact → Newsletter → Footer).
- Cấu trúc Product Card (ảnh + badge + hover add-to-cart + tên + vendor + giá) và cơ chế hiển thị giá sale/from.
- Cấu trúc PDP: gallery + info panel + accordion details + reviews + related + recently viewed, và đặc biệt **thứ tự variant selector nằm trên tên sản phẩm**.
- Cart Drawer + Cart Page flow, kể cả cơ chế **Gift-With-Purchase theo tầng** (đây là điểm khác biệt hoá cốt lõi).
- Design tokens đã đo được: font Yrsa + Red Hat Text, bảng màu (cream/mint/dusty-rose/brown-text), button pill radius 40px, product card radius 16px, grid spacing 30px/10px desktop.
- Guest checkout khả dụng (không ép buộc tạo tài khoản).

### 🟡 Những gì CÓ THỂ approximate (không cần pixel-perfect)
- Chi tiết responsive mobile cụ thể (đã đánh dấu estimated) — làm theo best-practice chuẩn ecommerce responsive, không cần khớp tuyệt đối site gốc.
- Animation/transition timing (fade, slide) — dùng giá trị hợp lý chuẩn UI (200-350ms ease).
- Shadow blur/opacity, ảnh aspect-ratio chính xác từng loại card.
- Nội dung minh hoạ (illustration hero) — giữ tinh thần "cozy/kawaii pastel" nhưng không cần sao chép hình vẽ.

### 🎨 Những gì CẦN tự thiết kế mới hoàn toàn (không copy được / không nên copy)
- Toàn bộ ảnh sản phẩm, ảnh lifestyle, illustration (bản quyền của Wuli Home).
- Nội dung văn bản thương hiệu (tên, mô tả, câu chuyện "About", review thật).
- Mã nguồn theme Shopify gốc (HTML/Liquid/CSS/JS) — viết lại 100% từ đầu bằng stack riêng.
- Hệ thống Checkout/Payment/Account nếu không dùng Shopify.
- Logic backend cụ thể (rule engine GWP, inventory, tax calculation) — chỉ giữ **hành vi quan sát được**, tự implement logic.
- Logo/wordmark "wuli" và mọi asset thương hiệu.

### ❓ Những thông tin còn thiếu (cần thu thập thêm trước khi implement)
- Screenshot/hành vi mobile thực tế (test trên thiết bị hoặc DevTools mobile emulation thật).
- Chi tiết bước Shipping method & Payment của Checkout (chưa điền form thật để xem).
- Error/empty/loading state đầy đủ (giỏ hàng rỗng, PDP hết hàng, filter không có kết quả, v.v.).
- Xác nhận chính xác giá trị hex màu badge giảm giá và các màu accent chưa trích xuất được từ CSS variables.
- Xác nhận cơ chế pagination (AJAX vs full reload) và infinite-scroll có tồn tại ở chế độ nào khác không.
