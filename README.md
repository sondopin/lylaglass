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
- `payments/` chứa **hai** abstraction tách biệt:
  - `PaymentProvider` → tạo hướng dẫn thanh toán (`VietQRPaymentProvider` sinh
    mã VietQR). **Chỉ tạo QR, không xác nhận thanh toán.**
  - `BankNotificationProvider` → nhận và xác thực thông báo tiền vào tài khoản
    ngân hàng (`SePayBankNotificationProvider`). **Đây là nơi duy nhất có thể
    đánh dấu một payment là đã thanh toán.**
  Đổi nhà cung cấp chỉ cần thêm 1 class mới, không đụng vào Order system.
- `email/` là abstraction gửi email (`ResendEmailProvider`, `LogEmailProvider`
  cho dev), dùng bởi `services/email.service.ts`.
- `jobs/` chứa job định kỳ hết hạn payment và gửi lại email thất bại.

## Bắt đầu nhanh

### 1. MongoDB

```bash
docker compose up -d mongo
```

Hoặc trỏ `MONGODB_URI` trong `backend/.env` tới một MongoDB Atlas cluster.

### 2. Backend

```bash
cd backend
cp .env.example .env   # điền JWT_SECRET, ADMIN_SEED_PASSWORD,
                       # VIETQR_ACCOUNT_NUMBER, BANK_WEBHOOK_SECRET...
npm install
npm run seed            # tạo admin, danh mục, sản phẩm mẫu
npm run dev              # http://localhost:4000
npm test                 # chạy test (Vitest)
```

> Thiếu biến thanh toán bắt buộc: ở dev backend chỉ log cảnh báo, ở
> production sẽ **không khởi động** (xem `config/validateConfig.ts`).

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

## Thanh toán: VietQR → TPBank → webhook

Phương thức thanh toán duy nhất trên storefront là **chuyển khoản ngân hàng
qua VietQR** vào tài khoản TPBank của shop. Không còn COD, không còn cổng
thanh toán giả lập, không dùng thẻ.

> **Quan trọng:** VietQR chỉ tạo mã QR chuyển khoản. Việc xác nhận thanh toán
> dựa trên **giao dịch tiền vào tài khoản TPBank** thông qua webhook/IPN của
> nhà cung cấp thông báo biến động số dư. Khách mở hoặc quét QR **không** được
> coi là đã thanh toán.

```
Khách checkout
  → backend tính tiền server-side, giữ tồn kho, tạo Order + Payment
  → backend sinh VietQR (TPBank + STK + đúng số tiền + paymentCode) + expiresAt
  → FE hiển thị QR, thông tin chuyển khoản dạng text, countdown theo expiresAt
  → khách chuyển khoản vào TPBank
  → SePay nhận biến động số dư, POST /api/payments/bank-webhook
  → backend xác thực chữ ký, ghi BankTransaction (chống trùng), đối chiếu:
      tiền vào · đúng tài khoản · đúng paymentCode · đúng số tiền
      · chưa xử lý · payment chưa terminal · chưa hết hạn
  → Payment = succeeded, Order.paymentStatus = paid, orderStatus = confirmed
  → FE đang polling tự chuyển sang "Thanh toán thành công"
  → backend gửi 2 email, mỗi loại đúng một lần:
      · email xác nhận cho khách
      · email thông báo đơn mới cho shop (ORDER_NOTIFICATION_EMAILS)
```

Hai email được theo dõi độc lập trên Payment (`confirmationEmail*` và
`ownerNotification*`), nên một email lỗi không chặn hoặc gửi lại email kia, và
cả hai đều không bao giờ làm rollback thanh toán.

Nếu hết TTL (mặc định 15 phút) mà chưa nhận được tiền: Payment = `expired`,
Order = `failed`/`cancelled`, tồn kho **và** lượt dùng coupon được hoàn lại
(đúng một lần, nhờ atomic claim trên document Order).

### Cấu hình

1. **Tài khoản TPBank** — mở/dùng tài khoản TPBank của shop (cá nhân hoặc
   doanh nghiệp đều được).
2. **Nhà cung cấp webhook** — đăng ký [SePay](https://sepay.vn), liên kết tài
   khoản TPBank (SePay có hợp tác chính thức với TPBank, đồng bộ giao dịch
   real-time).
3. **Tạo webhook trong SePay** trỏ tới
   `https://<domain>/api/payments/bank-webhook`, chọn loại **chỉ tiền vào**,
   kiểu xác thực **HMAC-SHA256** (khuyến nghị) hoặc **API Key**.
4. **Điền `.env`** (xem `backend/.env.example`): `VIETQR_ACCOUNT_NUMBER`,
   `VIETQR_ACCOUNT_NAME`, `BANK_WEBHOOK_SECRET` (hoặc `BANK_WEBHOOK_API_KEY`),
   `EMAIL_PROVIDER`/`EMAIL_API_KEY`/`EMAIL_FROM`, và
   `ORDER_NOTIFICATION_EMAILS` nếu muốn shop nhận email mỗi khi có đơn đã
   thanh toán (để trống là tắt tính năng này).
5. **Migration** (chỉ cần nếu DB đã có dữ liệu từ scheme COD/mock cũ):

   ```bash
   cd backend
   npm run migrate:vietqr             # dry run, chỉ báo cáo
   npm run migrate:vietqr -- --apply  # thực hiện
   ```

Backend luôn trả `200 {"success": true}` cho webhook đã tiếp nhận (kể cả giao
dịch bị từ chối, để SePay không retry vô ích); chỉ lỗi xác thực (401) và lỗi
server (5xx) mới khiến SePay gửi lại.

### Test local

`EMAIL_PROVIDER=log` ghi email ra log thay vì gửi thật. Để thử webhook mà
không cần chuyển khoản thật, gửi một request đã ký hợp lệ:

```bash
BODY='{"id":92704,"gateway":"TPBank","transactionDate":"2026-08-17 19:05:12","accountNumber":"<STK>","subAccount":"","code":"<paymentCode>","content":"<paymentCode> chuyen tien","transferType":"in","description":"","transferAmount":<đúng số tiền>,"accumulated":0,"referenceCode":"FT123"}'
TS=$(date +%s)
SIG=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$BANK_WEBHOOK_SECRET" -hex | awk '{print $2}')
curl -X POST http://localhost:4000/api/payments/bank-webhook \
  -H "Content-Type: application/json" \
  -H "X-SePay-Signature: sha256=$SIG" \
  -H "X-SePay-Timestamp: $TS" \
  -d "$BODY"
```

## Kiểm tra đã thực hiện

- `npm test` (backend, Vitest): 50 test bao gồm sinh VietQR (đối chiếu với
  vector tham chiếu NAPAS), xác thực webhook SePay (HMAC/API key/replay), và
  toàn bộ quy tắc đối soát — sai số tiền, sai nội dung, sai tài khoản, webhook
  trùng, hết hạn, hoàn kho/coupon, email gửi đúng một lần.
- Race-condition tồn kho: giảm kho bằng `findOneAndUpdate` atomic theo từng
  SKU; hoàn kho/coupon qua atomic claim nên không bao giờ chạy hai lần.
- `npm run build` ở cả hai thư mục chạy sạch (frontend prerender 28 routes,
  backend biên dịch TypeScript không lỗi).

## Giới hạn đã biết / việc còn lại

- Ảnh sản phẩm dùng Unsplash (đã kiểm tra URL còn hoạt động) làm placeholder
  — cần thay bằng ảnh chụp sản phẩm thật trước khi lên production.
- Chuyển khoản **thừa tiền** hoặc **đến sau khi payment hết hạn** không được
  tự động xác nhận (tránh oversell sau khi đã hoàn kho): giao dịch được ghi
  lại, payment gắn cờ `needsManualReview`, admin xử lý ở trang Thanh toán.
- Email xác nhận dùng cơ chế idempotent đơn giản (trạng thái + số lần thử trên
  Payment) thay vì Outbox pattern: job định kỳ thử lại tối đa
  `EMAIL_MAX_ATTEMPTS` lần, sau đó admin thấy trạng thái "Gửi thất bại". Nếu
  chạy nhiều instance backend, job hết hạn/gửi lại chạy song song vẫn an toàn
  vì mọi transition đều là atomic claim, nhưng sẽ lặp công vô ích — nên bật ở
  một instance nếu scale ngang.
- Chưa có test end-to-end (Playwright) cho luồng UI; test hiện tại là unit/
  integration ở tầng service với repository được stub.
- Form Liên hệ và Đăng ký nhận tin ở frontend hiện chưa lưu vào backend
  (chỉ hiển thị thông báo thành công) — có thể nối vào một endpoint riêng
  nếu cần lưu trữ.
