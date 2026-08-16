# LylaGlass

Website thương mại điện tử bán ly thủy tinh — guest checkout, 3 danh mục
(Quà Tặng, Theo Mùa, Tâm Trạng Mỗi Ngày), đơn hàng và thanh toán được xác
minh phía backend, và trang quản trị đầy đủ.

Tái tạo theo cấu trúc/pattern quan sát được trong `REFERENCE_ANALYSIS.md`
(layout, typography, product card, cart/checkout flow), với nội dung, hình
ảnh và thương hiệu hoàn toàn mới cho LylaGlass.

## Kiến trúc

```
LylaGlass/
├── backend/     Express + TypeScript + MongoDB (Mongoose) — REST API
├── frontend/    Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
└── docker-compose.yml   Mongo + backend, cho môi trường local/staging
```

Backend theo mô hình **Controller → Service → Repository**:
- `controllers/` chỉ nhận request, gọi service, trả response.
- `services/` chứa business logic (checkout, thanh toán, tồn kho...).
- `repositories/` là lớp truy cập dữ liệu (Mongoose queries).
- `payments/` là abstraction cổng thanh toán (`PaymentProvider` interface),
  hiện có `MockPaymentProvider` (dev) và khung sẵn cho `StripePaymentProvider`
  — đổi cổng thanh toán chỉ cần thêm 1 class mới, không đụng vào Order system.

## Bắt đầu nhanh

### 1. MongoDB

```bash
docker compose up -d mongo
```

Hoặc trỏ `MONGODB_URI` trong `backend/.env` tới một MongoDB Atlas cluster.

### 2. Backend

```bash
cd backend
cp .env.example .env   # rồi điền JWT_SECRET, ADMIN_SEED_PASSWORD...
npm install
npm run seed            # tạo admin, danh mục, sản phẩm mẫu
npm run dev              # http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev               # http://localhost:3000
```

> Trên Windows, nếu Turbopack báo lỗi spawn process khi biên dịch
> `globals.css`, chạy `npm run dev` (đã cấu hình dùng `next dev --webpack`)
> để dùng webpack thay Turbopack.

### 4. Đăng nhập quản trị

Truy cập `http://localhost:3000/quan-tri/dang-nhap` với thông tin đã đặt ở
`ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` trong `backend/.env`.

## Thanh toán (môi trường dev)

`PAYMENT_PROVIDER=mock` (mặc định) mô phỏng một cổng thanh toán ngoài:
checkout tạo payment intent ở trạng thái `processing`, chuyển hướng tới
`/thanh-toan/gia-lap`, nơi bạn có thể giả lập "thanh toán thành công/thất
bại" — hành động này gọi `POST /api/payments/webhook` giống hệt cách một
cổng thanh toán thật sẽ gọi lại, để backend xác minh và cập nhật đơn hàng.
Đơn hàng COD bỏ qua bước này hoàn toàn.

## Kiểm tra đã thực hiện

- Toàn bộ flow: duyệt sản phẩm → giỏ hàng → checkout (COD & mock online) →
  webhook xác nhận thanh toán → đơn hàng, đã test end-to-end qua API thật.
- Race-condition tồn kho: giảm kho bằng `findOneAndUpdate` atomic theo từng
  SKU, hoàn kho tự động nếu thanh toán thất bại/đơn bị huỷ.
- `npm run build` ở cả hai thư mục chạy sạch (frontend prerender 29 routes,
  backend biên dịch TypeScript không lỗi).

## Giới hạn đã biết / việc còn lại

- Ảnh sản phẩm dùng Unsplash (đã kiểm tra URL còn hoạt động) làm placeholder
  — cần thay bằng ảnh chụp sản phẩm thật trước khi lên production.
- Chưa tích hợp cổng thanh toán thật (Stripe/VNPay/MoMo...) — mới có khung
  `StripePaymentProvider` với các TODO rõ ràng.
- Chưa có test tự động (unit/integration/e2e) — nên bổ sung trước khi mở
  rộng thêm tính năng.
- Form Liên hệ và Đăng ký nhận tin ở frontend hiện chưa lưu vào backend
  (chỉ hiển thị thông báo thành công) — có thể nối vào một endpoint riêng
  nếu cần lưu trữ.
