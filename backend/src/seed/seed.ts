import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectDatabase, disconnectDatabase, ensureCriticalIndexes } from "@/config/db";
import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { CategoryModel } from "@/models/Category.model";
import { ProductModel } from "@/models/Product.model";
import { AdminUserModel } from "@/models/AdminUser.model";
import { CouponModel } from "@/models/Coupon.model";
import { ReviewModel } from "@/models/Review.model";
import { SettingsModel } from "@/models/Settings.model";
import { BankTransactionModel } from "@/models/BankTransaction.model";
import { CustomerModel } from "@/models/Customer.model";
import { OrderModel } from "@/models/Order.model";
import { PaymentModel } from "@/models/Payment.model";
import { seedDemoOrders } from "./demoOrders";
import { IMAGES } from "./images";

async function seed() {
  await connectDatabase();
  // `autoIndex` is off, so a freshly seeded database would otherwise have no
  // unique indexes at all — including the ones enforcing payment idempotency.
  await ensureCriticalIndexes();
  logger.info("Bắt đầu seed dữ liệu LylaGlass...");

  // Orders/payments reference products by id, so leaving them behind while the
  // catalogue is recreated would produce orders pointing at deleted products.
  // Wiping them together keeps the seeded database internally consistent.
  logger.warn("Seed sẽ XOÁ toàn bộ catalogue, đơn hàng, payment, giao dịch NH và khách hàng, rồi tạo lại dữ liệu mẫu.");

  await Promise.all([
    CategoryModel.deleteMany({}),
    ProductModel.deleteMany({}),
    CouponModel.deleteMany({}),
    ReviewModel.deleteMany({}),
    OrderModel.deleteMany({}),
    PaymentModel.deleteMany({}),
    BankTransactionModel.deleteMany({}),
    CustomerModel.deleteMany({}),
  ]);

  // ---- Settings -------------------------------------------------------
  await SettingsModel.findOneAndUpdate(
    { key: "store" },
    {
      key: "store",
      freeShippingThreshold: 490_000,
      flatShippingFee: 30_000,
      storeName: "LylaGlass",
      supportEmail: "hello@lylaglass.vn",
      supportPhone: "0333 971 738",
    },
    { upsert: true }
  );

  // ---- Admin user -------------------------------------------------------
  // Seeding never overwrites an existing admin's password: re-seeding demo
  // catalogue data must not silently invalidate a credential someone is using.
  // The consequence is that editing ADMIN_SEED_PASSWORD after the first seed
  // has no effect here, which is indistinguishable from a wrong password at the
  // login screen — so say so explicitly rather than passing over it in silence.
  const existingAdmin = await AdminUserModel.findOne({ email: env.adminSeedEmail });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(env.adminSeedPassword, 10);
    await AdminUserModel.create({
      name: "LylaGlass Admin",
      email: env.adminSeedEmail,
      passwordHash,
      role: "owner",
    });
    logger.info(`Đã tạo tài khoản admin: ${env.adminSeedEmail}`);
  } else {
    logger.info(
      `Tài khoản admin ${env.adminSeedEmail} đã tồn tại — GIỮ NGUYÊN mật khẩu cũ. ` +
        `Nếu vừa đổi ADMIN_SEED_PASSWORD, chạy: npm run admin -- --reset`
    );
  }

  // ---- Categories ---------------------------------------------------
  const [gifting, seasonal, dailyMoods] = await CategoryModel.insertMany([
    {
      name: "Quà Tặng",
      slug: "gifting",
      description:
        "Những bộ ly thủy tinh được tuyển chọn và đóng hộp tinh tế — món quà ấm áp cho người thân yêu trong mọi dịp đặc biệt.",
      image: IMAGES.gifting[0],
      sortOrder: 1,
      seoTitle: "Quà Tặng Ly Thủy Tinh Cao Cấp | LylaGlass",
      seoDescription: "Khám phá bộ sưu tập ly thủy tinh làm quà tặng tinh tế, đóng hộp sang trọng từ LylaGlass.",
    },
    {
      name: "Theo Mùa",
      slug: "seasonal",
      description:
        "Bộ sưu tập ly thủy tinh theo từng mùa lễ hội trong năm — từ Tết, Giáng Sinh đến Trung Thu, mang không khí lễ hội vào từng bàn tiệc.",
      image: IMAGES.seasonal[0],
      sortOrder: 2,
      seoTitle: "Ly Thủy Tinh Theo Mùa Lễ Hội | LylaGlass",
      seoDescription: "Bộ sưu tập ly thủy tinh giới hạn theo mùa — Tết, Giáng Sinh, Trung Thu và hơn thế nữa.",
    },
    {
      name: "Tâm Trạng Mỗi Ngày",
      slug: "daily-moods",
      description:
        "Ly thủy tinh dùng hằng ngày với thiết kế tối giản, nhiều màu sắc — mang chút niềm vui nhỏ vào từng khoảnh khắc thường nhật.",
      image: IMAGES.home[0],
      sortOrder: 3,
      seoTitle: "Ly Thủy Tinh Dùng Hằng Ngày | LylaGlass",
      seoDescription: "Ly thủy tinh phong cách tối giản, bền đẹp cho mọi khoảnh khắc trong ngày của bạn.",
    },
  ]);

  // ---- Products -------------------------------------------------------
  const products = [
    // GIFTING
    {
      name: 'Bộ Ly Thủy Tinh Quà Tặng "Ánh Dương"',
      slug: "bo-ly-anh-duong-qua-tang",
      categoryId: gifting._id,
      shortDescription: "Bộ ly pha lê trong suốt, đóng hộp quà sang trọng, khắc hoa văn ánh mặt trời tinh xảo.",
      description:
        "Bộ ly thủy tinh Ánh Dương được chế tác từ pha lê không chì, khắc họa tiết tia nắng tinh tế trên thân ly. Mỗi bộ được đóng trong hộp quà cứng cáp, lót nhung êm, kèm thiệp chúc tùy chỉnh — món quà hoàn hảo cho tân gia, sinh nhật hay lễ kỷ niệm.",
      images: [{ url: IMAGES.gifting[0], alt: "Bộ ly thủy tinh Ánh Dương trong hộp quà" }, { url: IMAGES.glass[0], alt: "Chi tiết ly thủy tinh Ánh Dương" }],
      optionName: "Số lượng ly",
      variants: [
        { sku: "AD-2LY", name: "Set 2 ly (300ml)", price: 349000, compareAtPrice: 420000, inventoryQty: 40 },
        { sku: "AD-4LY", name: "Set 4 ly (300ml)", price: 599000, compareAtPrice: 720000, inventoryQty: 25 },
      ],
      tags: ["qua-tang", "pha-le", "hop-qua"],
      material: "Pha lê không chì cao cấp",
      capacity: "300ml / ly",
      features: ["Khắc họa tiết ánh dương thủ công", "Hộp quà lót nhung sang trọng", "Kèm thiệp chúc tùy chỉnh"],
      careInstructions: ["Rửa tay với nước ấm và xà phòng dịu nhẹ", "Không dùng miếng cọ kim loại", "Nên hong khô tự nhiên"],
      shippingReturnNote: "Giao hàng 2-5 ngày toàn quốc. Đổi trả miễn phí trong 7 ngày nếu sản phẩm lỗi do vận chuyển.",
      isFeatured: true,
      isBestseller: true,
    },
    {
      name: "Ly Thủy Tinh Khắc Tên Theo Yêu Cầu",
      slug: "ly-khac-ten-theo-yeu-cau",
      categoryId: gifting._id,
      shortDescription: "Ly thủy tinh cá nhân hóa với tên hoặc lời nhắn theo yêu cầu, đóng hộp quà tặng.",
      description:
        "Biến chiếc ly thành món quà chỉ dành riêng cho một người — khắc tên, ngày kỷ niệm hoặc lời nhắn yêu thương lên thân ly thủy tinh dày dặn, chịu lực tốt. Vui lòng để lại nội dung khắc ở ghi chú đơn hàng.",
      images: [{ url: IMAGES.gifting[1], alt: "Ly thủy tinh khắc tên làm quà" }, { url: IMAGES.glass[1], alt: "Chi tiết khắc chữ trên ly" }],
      optionName: "Dung tích",
      variants: [
        { sku: "KT-300", name: "300ml", price: 259000, inventoryQty: 60 },
        { sku: "KT-400", name: "400ml", price: 289000, inventoryQty: 45 },
      ],
      tags: ["qua-tang", "ca-nhan-hoa"],
      material: "Thủy tinh borosilicate",
      capacity: "300ml - 400ml",
      features: ["Khắc laser theo yêu cầu", "Chịu nhiệt tốt, an toàn khi rửa máy", "Đóng hộp quà kèm ruy băng"],
      careInstructions: ["An toàn với máy rửa chén ở chế độ nhẹ", "Tránh va đập mạnh vùng khắc chữ"],
      shippingReturnNote: "Sản phẩm cá nhân hóa cần 2-3 ngày gia công trước khi giao. Không áp dụng đổi trả trừ lỗi sản xuất.",
      isFeatured: true,
    },
    {
      name: "Set Ly Rượu Vang Pha Lê Cao Cấp",
      slug: "set-ly-ruou-vang-pha-le",
      categoryId: gifting._id,
      shortDescription: "Bộ 2 ly rượu vang pha lê chân cao, thiết kế thanh lịch, hộp quà cứng cao cấp.",
      description:
        "Set ly rượu vang pha lê với thân ly mỏng nhẹ, chân ly thon dài giúp tôn lên hương vị và màu sắc của rượu. Thiết kế tinh giản, sang trọng — lựa chọn lý tưởng cho các buổi tối lãng mạn hoặc làm quà tặng đối tác.",
      images: [{ url: IMAGES.gifting[2], alt: "Set ly rượu vang pha lê" }, { url: IMAGES.glass[2], alt: "Chi tiết chân ly rượu vang" }],
      optionName: "Bộ sản phẩm",
      variants: [{ sku: "RV-2LY", name: "Set 2 ly", price: 459000, compareAtPrice: 550000, inventoryQty: 30 }],
      tags: ["qua-tang", "ly-ruou-vang", "pha-le"],
      material: "Pha lê không chì",
      capacity: "350ml / ly",
      features: ["Chân ly thon dài chuẩn sommelier", "Thành ly mỏng 1mm", "Hộp quà cứng chống sốc"],
      careInstructions: ["Rửa tay, tránh nước quá nóng đột ngột", "Bảo quản đứng, tránh va chạm chân ly"],
      shippingReturnNote: "Đóng gói chống sốc 3 lớp. Đổi trả miễn phí nếu vỡ trong quá trình vận chuyển.",
    },
    {
      name: 'Ly Thủy Tinh Đôi "Song Hỷ"',
      slug: "ly-doi-song-hy",
      categoryId: gifting._id,
      shortDescription: "Cặp ly thủy tinh khắc họa tiết song hỷ, quà tặng ý nghĩa cho cặp đôi mới cưới.",
      description:
        "Cặp ly Song Hỷ với họa tiết chữ Hỷ cách điệu tinh tế, tượng trưng cho hạnh phúc lứa đôi. Thiết kế đối xứng, đóng hộp đôi sang trọng — món quà cưới hoặc kỷ niệm ngày cưới đầy ý nghĩa.",
      images: [{ url: IMAGES.gifting[3], alt: "Ly đôi Song Hỷ" }, { url: IMAGES.glass[3], alt: "Chi tiết cặp ly song hỷ" }],
      optionName: "Màu sắc",
      variants: [
        { sku: "SH-TRONG", name: "Trong suốt", price: 319000, inventoryQty: 35 },
        { sku: "SH-VANG", name: "Ánh vàng", price: 359000, inventoryQty: 20 },
      ],
      tags: ["qua-tang", "qua-cuoi"],
      material: "Thủy tinh cường lực",
      capacity: "320ml / ly",
      features: ["Họa tiết Song Hỷ khắc nổi", "Bộ đôi đối xứng", "Hộp quà đôi kèm dải lụa đỏ"],
      careInstructions: ["Rửa tay với nước ấm", "Không ngâm nước quá lâu"],
      shippingReturnNote: "Giao hàng toàn quốc 2-5 ngày. Đổi trả trong 7 ngày nếu lỗi sản xuất.",
    },
    {
      name: "Set Ly Trà Thảo Mộc & Đế Gỗ",
      slug: "set-ly-tra-thao-moc-de-go",
      categoryId: gifting._id,
      shortDescription: "Bộ ly thủy tinh chịu nhiệt pha trà kèm đế gỗ tự nhiên, quà tân gia tinh tế.",
      description:
        "Set ly trà thảo mộc thân thủy tinh chịu nhiệt, quan sát rõ màu trà khi pha, đi kèm đế lót gỗ sồi tự nhiên. Một món quà tân gia hoặc tặng người yêu thích trà đầy tinh tế và thực dụng.",
      images: [{ url: IMAGES.gifting[4], alt: "Set ly trà thảo mộc và đế gỗ" }, { url: IMAGES.glass[4], alt: "Chi tiết ly trà thủy tinh" }],
      optionName: "Bộ sản phẩm",
      variants: [{ sku: "TT-2LY", name: "Set 2 ly + đế gỗ", price: 389000, inventoryQty: 28 }],
      tags: ["qua-tang", "tra", "tan-gia"],
      material: "Thủy tinh borosilicate chịu nhiệt + gỗ sồi",
      capacity: "250ml / ly",
      features: ["Chịu nhiệt đến 150°C", "Đế gỗ sồi tự nhiên chống trượt", "Quan sát rõ màu nước trà"],
      careInstructions: ["Rửa tay, lau khô đế gỗ ngay sau khi dùng", "Tránh ngâm đế gỗ trong nước"],
      shippingReturnNote: "Giao hàng 2-5 ngày. Đổi trả trong 7 ngày nếu lỗi sản xuất.",
    },

    // SEASONAL
    {
      name: "Ly Thủy Tinh Họa Tiết Hoa Đào",
      slug: "ly-hoa-tiet-hoa-dao",
      categoryId: seasonal._id,
      shortDescription: "Ly thủy tinh in họa tiết hoa đào hồng phai, mang không khí Tết đến bàn tiệc.",
      description:
        "Thiết kế giới hạn mùa Tết với họa tiết hoa đào phớt hồng vẽ tay trên nền thủy tinh trong. Phù hợp bày biện bàn tiệc năm mới hoặc làm quà biếu Tết ý nghĩa.",
      images: [{ url: IMAGES.seasonal[0], alt: "Ly thủy tinh họa tiết hoa đào" }, { url: IMAGES.glass[5], alt: "Chi tiết họa tiết hoa đào" }],
      optionName: "Bộ sản phẩm",
      variants: [
        { sku: "HD-1LY", name: "1 ly (280ml)", price: 129000, inventoryQty: 80 },
        { sku: "HD-4LY", name: "Set 4 ly (280ml)", price: 459000, compareAtPrice: 516000, inventoryQty: 30 },
      ],
      tags: ["theo-mua", "tet", "hoa-dao"],
      material: "Thủy tinh cường lực",
      capacity: "280ml",
      features: ["Họa tiết vẽ tay giới hạn số lượng", "Phiên bản Tết theo mùa", "Hộp quà đỏ may mắn"],
      careInstructions: ["Rửa tay để giữ họa tiết bền màu", "Tránh cọ xát mạnh lên phần in"],
      shippingReturnNote: "Sản phẩm theo mùa, số lượng có hạn. Đổi trả trong 7 ngày nếu lỗi sản xuất.",
      isNewArrival: true,
    },
    {
      name: "Ly Thủy Tinh In Họa Tiết Giáng Sinh",
      slug: "ly-hoa-tiet-giang-sinh",
      categoryId: seasonal._id,
      shortDescription: "Ly thủy tinh in họa tiết cây thông và tuyết, ấm áp không khí Giáng Sinh.",
      description:
        "Bộ sưu tập Giáng Sinh với họa tiết cây thông, bông tuyết in nổi tinh xảo. Thích hợp dùng đãi khách dịp lễ hội cuối năm hoặc trang trí bàn tiệc Noel thêm lung linh.",
      images: [{ url: IMAGES.seasonal[1], alt: "Ly thủy tinh họa tiết Giáng Sinh" }, { url: IMAGES.glass[6], alt: "Chi tiết ly Giáng Sinh" }],
      optionName: "Bộ sản phẩm",
      variants: [{ sku: "GS-4LY", name: "Set 4 ly (300ml)", price: 429000, compareAtPrice: 490000, inventoryQty: 35 }],
      tags: ["theo-mua", "giang-sinh", "noel"],
      material: "Thủy tinh cường lực",
      capacity: "300ml",
      features: ["Họa tiết in nổi cây thông & tuyết", "Phiên bản giới hạn mùa lễ hội", "Phù hợp trang trí bàn tiệc"],
      careInstructions: ["Rửa tay với nước ấm", "Không dùng miếng cọ kim loại"],
      shippingReturnNote: "Giao hàng nhanh trong mùa lễ hội. Đổi trả trong 7 ngày nếu lỗi sản xuất.",
      isNewArrival: true,
      isBestseller: true,
    },
    {
      name: 'Bộ Ly Cocktail Mùa Hè "Tropical Breeze"',
      slug: "bo-ly-cocktail-tropical-breeze",
      categoryId: seasonal._id,
      shortDescription: "Ly cocktail họa tiết lá nhiệt đới rực rỡ, gợi nhớ những ngày hè sôi động.",
      description:
        "Thiết kế lấy cảm hứng từ những khu vườn nhiệt đới, họa tiết lá cọ xanh mát in trên thân ly cocktail miệng rộng. Hoàn hảo cho những buổi tiệc hồ bơi hoặc tối hè cùng bạn bè.",
      images: [{ url: IMAGES.seasonal[2], alt: "Bộ ly cocktail Tropical Breeze" }, { url: IMAGES.glass[7], alt: "Chi tiết ly cocktail nhiệt đới" }],
      optionName: "Bộ sản phẩm",
      variants: [{ sku: "TB-2LY", name: "Set 2 ly (400ml)", price: 279000, inventoryQty: 50 }],
      tags: ["theo-mua", "mua-he", "cocktail"],
      material: "Thủy tinh cường lực",
      capacity: "400ml",
      features: ["Họa tiết lá nhiệt đới rực rỡ", "Miệng ly rộng phù hợp cocktail", "Đế ly vững chãi"],
      careInstructions: ["An toàn với máy rửa chén ở chế độ nhẹ nhàng"],
      shippingReturnNote: "Giao hàng 2-5 ngày toàn quốc.",
    },
    {
      name: "Ly Thủy Tinh Trung Thu Họa Tiết Đèn Lồng",
      slug: "ly-trung-thu-den-long",
      categoryId: seasonal._id,
      shortDescription: "Ly thủy tinh in họa tiết đèn lồng và trăng rằm, quà biếu Trung Thu ấm cúng.",
      description:
        "Họa tiết đèn lồng đỏ và ánh trăng rằm được in tinh xảo trên nền thủy tinh trong suốt, gợi nhắc không khí đoàn viên mùa Trung Thu. Thích hợp làm quà biếu đối tác, người thân dịp Rằm tháng Tám.",
      images: [{ url: IMAGES.seasonal[0], alt: "Ly thủy tinh Trung Thu đèn lồng" }, { url: IMAGES.glass[8], alt: "Chi tiết họa tiết đèn lồng" }],
      optionName: "Bộ sản phẩm",
      variants: [{ sku: "TT2-2LY", name: "Set 2 ly (280ml)", price: 219000, inventoryQty: 40 }],
      tags: ["theo-mua", "trung-thu"],
      material: "Thủy tinh cường lực",
      capacity: "280ml",
      features: ["Họa tiết đèn lồng in nổi", "Phiên bản giới hạn Trung Thu", "Hộp quà kèm thiệp"],
      careInstructions: ["Rửa tay để giữ độ bền của họa tiết"],
      shippingReturnNote: "Sản phẩm theo mùa, số lượng có hạn.",
    },

    // DAILY MOODS
    {
      name: "Ly Thủy Tinh Borosilicate Chịu Nhiệt Dáng Basic",
      slug: "ly-borosilicate-dang-basic",
      categoryId: dailyMoods._id,
      shortDescription: "Ly thủy tinh tối giản, chịu nhiệt tốt, dùng được cho cả đồ nóng và lạnh mỗi ngày.",
      description:
        "Thiết kế tối giản không tì vết, thân ly dày dặn chịu được sốc nhiệt tốt — từ trà nóng buổi sáng đến nước đá mát lạnh buổi chiều. Người bạn đồng hành lý tưởng cho mọi khoảnh khắc trong ngày.",
      images: [{ url: IMAGES.glass[9], alt: "Ly thủy tinh Basic tối giản" }, { url: IMAGES.glass[10], alt: "Chi tiết ly Basic" }],
      optionName: "Dung tích",
      variants: [
        { sku: "BS-250", name: "250ml", price: 89000, inventoryQty: 120 },
        { sku: "BS-350", name: "350ml", price: 109000, inventoryQty: 100 },
        { sku: "BS-450", name: "450ml", price: 129000, inventoryQty: 75 },
      ],
      tags: ["hang-ngay", "toi-gian", "chiu-nhiet"],
      material: "Thủy tinh borosilicate",
      capacity: "250ml - 450ml",
      features: ["Chịu sốc nhiệt từ -20°C đến 150°C", "Thiết kế tối giản đa dụng", "An toàn với lò vi sóng"],
      careInstructions: ["An toàn với máy rửa chén", "Tránh thay đổi nhiệt độ quá đột ngột"],
      shippingReturnNote: "Giao hàng 2-5 ngày. Đổi trả trong 7 ngày nếu lỗi sản xuất.",
      isBestseller: true,
      isFeatured: true,
    },
    {
      name: 'Ly Thủy Tinh Sọc Màu "Retro Sunset"',
      slug: "ly-soc-mau-retro-sunset",
      categoryId: dailyMoods._id,
      shortDescription: "Ly thủy tinh sọc màu gradient hoài cổ, mang chút hoài niệm vào bàn ăn hằng ngày.",
      description:
        "Lấy cảm hứng từ ánh hoàng hôn thập niên 70, những sọc màu gradient cam - hồng - tím được thổi thủ công trên thân ly, không chiếc nào giống chiếc nào hoàn toàn.",
      images: [{ url: IMAGES.glass[11], alt: "Ly thủy tinh Retro Sunset" }, { url: IMAGES.glass[12], alt: "Chi tiết sọc màu retro" }],
      optionName: "Dung tích",
      variants: [
        { sku: "RS-300", name: "300ml", price: 139000, inventoryQty: 60 },
        { sku: "RS-400", name: "400ml", price: 159000, inventoryQty: 50 },
      ],
      tags: ["hang-ngay", "retro", "mau-sac"],
      material: "Thủy tinh thổi thủ công",
      capacity: "300ml - 400ml",
      features: ["Thổi thủ công, mỗi ly là độc bản", "Gradient màu hoài cổ", "Đế ly dày chống trượt"],
      careInstructions: ["Rửa tay để giữ màu bền đẹp", "Tránh va đập mạnh"],
      shippingReturnNote: "Giao hàng 2-5 ngày toàn quốc.",
      isNewArrival: true,
    },
    {
      name: 'Bộ 4 Ly Thủy Tinh Màu Pastel "Cloud"',
      slug: "bo-4-ly-pastel-cloud",
      categoryId: dailyMoods._id,
      shortDescription: "Bộ 4 ly thủy tinh 4 màu pastel dịu nhẹ, mang sắc màu vui tươi vào căn bếp.",
      description:
        "Bộ 4 ly với 4 tông pastel dịu mắt: hồng phấn, xanh bạc hà, vàng bơ và tím lavender. Kết hợp linh hoạt trong mọi bữa ăn gia đình hay tiệc trà cùng bạn bè.",
      images: [{ url: IMAGES.glass[13], alt: "Bộ 4 ly pastel Cloud" }, { url: IMAGES.glass[14], alt: "Chi tiết ly pastel" }],
      optionName: "Bộ sản phẩm",
      variants: [{ sku: "CL-4LY", name: "Set 4 ly (280ml)", price: 249000, compareAtPrice: 289000, inventoryQty: 45 }],
      tags: ["hang-ngay", "pastel", "mau-sac"],
      material: "Thủy tinh cường lực phủ màu",
      capacity: "280ml / ly",
      features: ["4 tông pastel dịu nhẹ", "Lớp phủ màu bền, không phai", "An toàn khi rửa máy"],
      careInstructions: ["An toàn với máy rửa chén ở chế độ nhẹ"],
      shippingReturnNote: "Giao hàng 2-5 ngày toàn quốc.",
      isBestseller: true,
    },
    {
      name: 'Ly Thủy Tinh Có Quai "Cozy Morning"',
      slug: "ly-co-quai-cozy-morning",
      categoryId: dailyMoods._id,
      shortDescription: "Ly thủy tinh có quai cầm chắc chắn, lý tưởng cho tách cà phê hay ca cao buổi sáng.",
      description:
        "Thiết kế quai cầm cong vừa tay, thân ly dày giữ nhiệt tốt hơn — người bạn đồng hành hoàn hảo cho những buổi sáng nhâm nhi cà phê sữa hay ca cao nóng bên cửa sổ.",
      images: [{ url: IMAGES.glass[15], alt: "Ly thủy tinh có quai Cozy Morning" }, { url: IMAGES.glass[16], alt: "Chi tiết quai cầm ly" }],
      optionName: "Dung tích",
      variants: [
        { sku: "CM-300", name: "300ml", price: 149000, inventoryQty: 70 },
        { sku: "CM-400", name: "400ml", price: 169000, inventoryQty: 55 },
      ],
      tags: ["hang-ngay", "ca-phe", "co-quai"],
      material: "Thủy tinh borosilicate chịu nhiệt",
      capacity: "300ml - 400ml",
      features: ["Quai cầm cong vừa tay, chống trượt", "Giữ nhiệt tốt hơn ly thường", "Chịu nhiệt đến 150°C"],
      careInstructions: ["An toàn với máy rửa chén", "Kiểm tra quai cầm định kỳ tránh nứt"],
      shippingReturnNote: "Giao hàng 2-5 ngày toàn quốc.",
      isFeatured: true,
    },
    {
      name: 'Ly Thủy Tinh Gân Sóng "Wave" Phong Cách Hàn Quốc',
      slug: "ly-gan-song-wave-han-quoc",
      categoryId: dailyMoods._id,
      shortDescription: "Ly thủy tinh gân sóng dập nổi theo phong cách tối giản Hàn Quốc, cầm chắc tay không trơn trượt.",
      description:
        "Họa tiết gân sóng dập nổi lấy cảm hứng từ mặt nước gợn sóng, vừa tạo điểm nhấn thẩm mỹ vừa giúp cầm ly chắc tay hơn. Phong cách tối giản đang rất được ưa chuộng trong giới trẻ Hàn Quốc.",
      images: [{ url: IMAGES.glass[17], alt: "Ly thủy tinh gân sóng Wave" }, { url: IMAGES.glass[18], alt: "Chi tiết gân sóng trên ly" }],
      optionName: "Dung tích",
      variants: [
        { sku: "WV-300", name: "300ml", price: 119000, inventoryQty: 90 },
        { sku: "WV-450", name: "450ml", price: 139000, inventoryQty: 65 },
      ],
      tags: ["hang-ngay", "phong-cach-han-quoc", "toi-gian"],
      material: "Thủy tinh cường lực",
      capacity: "300ml - 450ml",
      features: ["Họa tiết gân sóng dập nổi", "Cầm chắc tay, chống trơn trượt", "Thiết kế tối giản hiện đại"],
      careInstructions: ["An toàn với máy rửa chén"],
      shippingReturnNote: "Giao hàng 2-5 ngày toàn quốc.",
      isNewArrival: true,
      isBestseller: true,
    },
    // --- Trạng thái không phải "active", để test bộ lọc ở trang quản trị ---
    // A draft must never appear on the storefront but must appear in the admin
    // list; without one, a broken status filter looks identical to a working one.
    {
      name: "Set Ly Quà Tặng Doanh Nghiệp In Logo (Sắp Ra Mắt)",
      slug: "set-ly-qua-tang-doanh-nghiep-in-logo",
      categoryId: gifting._id,
      shortDescription: "Set ly in logo theo đơn đặt riêng cho doanh nghiệp — đang hoàn thiện, chưa mở bán.",
      description: "Bản nháp phục vụ thử nghiệm: sản phẩm ở trạng thái draft sẽ không hiển thị ngoài storefront.",
      images: [{ url: IMAGES.gifting[0], alt: "Set ly quà tặng doanh nghiệp in logo" }],
      optionName: "Số lượng",
      variants: [{ sku: "DN-SET10", name: "Set 10 ly", price: 1990000, inventoryQty: 10 }],
      tags: ["qua-tang", "ca-nhan-hoa"],
      material: "Thủy tinh cao cấp",
      status: "draft",
    },
    {
      name: "Ly Thủy Tinh Cổ Điển Bản Giới Hạn 2025 (Ngừng Kinh Doanh)",
      slug: "ly-co-dien-gioi-han-2025",
      categoryId: seasonal._id,
      shortDescription: "Bản giới hạn năm 2025 đã ngừng kinh doanh, giữ lại để tra cứu đơn hàng cũ.",
      description: "Bản archived phục vụ thử nghiệm: không hiển thị ngoài storefront, không đặt hàng được.",
      images: [{ url: IMAGES.seasonal[0], alt: "Ly thủy tinh cổ điển bản giới hạn" }],
      optionName: "Dung tích",
      variants: [{ sku: "GH-2025", name: "350ml", price: 259000, inventoryQty: 0 }],
      tags: ["theo-mua", "gioi-han"],
      material: "Thủy tinh cao cấp",
      status: "archived",
    },
  ];

  const createdProducts = await ProductModel.insertMany(products);
  logger.info(`Đã tạo ${createdProducts.length} sản phẩm (gồm 1 draft, 1 archived)`);

  // ---- Trạng thái tồn kho biên -------------------------------------------
  // Everything seeded above is comfortably in stock, which leaves the sold-out
  // and low-stock paths (PDP "Hết hàng", checkout 409, dashboard cảnh báo sắp
  // hết) with no data to exercise them.
  // Matched by SKU rather than slug: the SKU is the stable identifier a variant
  // is addressed by everywhere else in the system.
  const stockOverrides: Array<[sku: string, qty: number]> = [
    ["RV-2LY", 0], // hết hàng
    ["TT-2LY", 3], // sắp hết
  ];
  for (const [sku, inventoryQty] of stockOverrides) {
    const result = await ProductModel.updateOne(
      { "variants.sku": sku },
      { $set: { "variants.$[v].inventoryQty": inventoryQty } },
      { arrayFilters: [{ "v.sku": sku }] }
    );
    if (result.matchedCount === 0) throw new Error(`Seed: không tìm thấy SKU ${sku} để đặt tồn kho`);
  }
  logger.info("Đã đặt 1 variant hết hàng (RV-2LY = 0) và 1 variant sắp hết (TT-2LY = 3)");

  // ---- Sample reviews for a few bestsellers ----------------------------
  const bestsellers = createdProducts.filter((p) => p.isBestseller).slice(0, 3);
  const sampleReviews = [
    { rating: 5, authorName: "Minh Anh", body: "Ly rất đẹp, đóng gói cẩn thận, giao hàng nhanh. Sẽ ủng hộ shop dài dài!" },
    { rating: 5, authorName: "Thu Hà", body: "Chất lượng thủy tinh dày dặn, cầm chắc tay. Mua tặng mẹ mà mẹ thích lắm." },
    { rating: 4, authorName: "Quốc Bảo", body: "Sản phẩm đẹp như hình, chỉ tiếc là giao hơi chậm 1 ngày so với dự kiến." },
  ];
  for (const product of bestsellers) {
    await ReviewModel.insertMany(
      sampleReviews.map((r) => ({ ...r, productId: product._id, isVerifiedPurchase: true }))
    );
    const avg = sampleReviews.reduce((sum, r) => sum + r.rating, 0) / sampleReviews.length;
    await ProductModel.findByIdAndUpdate(product._id, {
      ratingAverage: Math.round(avg * 10) / 10,
      reviewCount: sampleReviews.length,
    });
  }

  // ---- Coupons ----------------------------------------------------------
  // One coupon per rejection reason in evaluateCoupon/claimUsage, so every
  // branch of the discount logic can be exercised from the storefront.
  const now = Date.now();
  await CouponModel.insertMany([
    { code: "LYLA10", type: "percentage", value: 10, minimumSubtotal: 200_000, isActive: true },
    { code: "FREESHIP", type: "free_shipping", value: 0, minimumSubtotal: 300_000, isActive: true },
    // Percentage with a cap — discount stops growing past maxDiscountAmount.
    { code: "SALE20", type: "percentage", value: 20, maxDiscountAmount: 100_000, minimumSubtotal: 300_000, isActive: true },
    // Fixed amount, and a high minimum so "chưa đủ điều kiện" is reachable.
    { code: "GIAM50K", type: "fixed", value: 50_000, minimumSubtotal: 400_000, isActive: true },
    // One redemption left: two simultaneous checkouts must not both get it.
    { code: "LASTCALL", type: "percentage", value: 15, usageLimit: 2, usageCount: 1, isActive: true },
    // Already exhausted.
    { code: "HETLUOT", type: "percentage", value: 25, usageLimit: 3, usageCount: 3, isActive: true },
    { code: "HETHAN", type: "percentage", value: 30, endsAt: new Date(now - 2 * 24 * 60 * 60_000), isActive: true },
    { code: "SAPMO", type: "percentage", value: 30, startsAt: new Date(now + 7 * 24 * 60 * 60_000), isActive: true },
    { code: "TATDUNG", type: "percentage", value: 50, isActive: false },
  ]);
  logger.info("Đã tạo 9 mã giảm giá (đủ mọi trạng thái: hợp lệ, hết lượt, hết hạn, chưa mở, tắt)");

  // ---- Demo orders / payments / bank transactions ------------------------
  await seedDemoOrders();

  logger.info("Seed hoàn tất!");
  await disconnectDatabase();
  process.exit(0);
}

seed().catch((err) => {
  logger.error({ err }, "Seed thất bại");
  process.exit(1);
});
