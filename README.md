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
├── backend/         Express + TypeScript + MongoDB (Mongoose) — REST API
├── frontend/        Next.js (App Router) — storefront, public, không auth
├── frontend-admin/  Next.js (App Router) — trang quản trị, app RIÊNG, domain RIÊNG
└── docker-compose.yml   Mongo + backend, cho môi trường local/staging
```

`frontend-admin/` là app độc lập (không phải route `/admin` bên trong
`frontend/` nữa), dự kiến deploy lên subdomain riêng (vd `admin.lylaglass.com`)
— tách khỏi storefront để một lỗ hổng XSS trên storefront (vd nội dung review
chưa lọc kỹ) không thể chạm tới phiên đăng nhập admin. Xem mục **Xác thực
admin** bên dưới.

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
- `email/` là abstraction gửi email (`GmailEmailProvider` dùng Gmail API,
  `LogEmailProvider` cho dev), dùng bởi `services/email.service.ts`.
  `email/mime.ts` dựng message RFC 2822: mã hoá tiêu đề tiếng Việt theo
  RFC 2047 và từ chối mọi giá trị header có xuống dòng (chặn header injection).
- `jobs/` chứa job định kỳ hết hạn payment và gửi lại email thất bại.

## Bắt đầu nhanh

### 1. MongoDB — bắt buộc replica set

Checkout và xác nhận thanh toán chạy trong **transaction**, nên MongoDB phải là
replica set (standalone `mongod` không hỗ trợ transaction).

```bash
docker compose up -d mongo   # single-node replica set rs0, healthcheck tự rs.initiate()
```

```
# Local (từ máy host bắt buộc directConnection: replica set khai báo member là
# `mongo:27017`, chỉ phân giải được bên trong mạng Docker)
MONGODB_URI=mongodb://localhost:27017/lylaglass?replicaSet=rs0&directConnection=true

# Production — MongoDB Atlas M0 (free tier, luôn là replica set 3 node nên có
# sẵn transaction + backup tự động)
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/lylaglass?retryWrites=true&w=majority
```

Nếu MongoDB không hỗ trợ transaction: production **từ chối khởi động**
(`MONGODB_REQUIRE_TRANSACTIONS=true`), dev chỉ cảnh báo và rơi về đường bù trừ.

### 2. Backend

```bash
cd backend
cp .env.example .env   # điền JWT_SECRET, CSRF_SECRET, ADMIN_SEED_PASSWORD,
                       # VIETQR_ACCOUNT_NUMBER, BANK_WEBHOOK_SECRET...
npm install
npm run seed            # tạo admin, danh mục, sản phẩm mẫu
npm run dev              # http://localhost:4000
npm test                 # chạy test (Vitest)
```

> Thiếu biến thanh toán bắt buộc: ở dev backend chỉ log cảnh báo, ở
> production sẽ **không khởi động** (xem `config/validateConfig.ts`). Cùng quy
> tắc áp dụng cho `JWT_SECRET`/`CSRF_SECRET` còn để giá trị mặc định của dev.

### 3. Frontend (storefront)

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev               # http://localhost:3000
```

### 4. Frontend-admin (trang quản trị — app riêng)

```bash
cd frontend-admin
cp .env.example .env.local
npm install
npm run dev               # http://localhost:3001
```

Chạy song song với backend + frontend để mô phỏng đúng tình huống "khác
origin" ngay ở local — CORS/cookie/CSRF hoạt động y hệt lúc deploy thật (chỉ
khác domain, không khác cơ chế).

### 5. Đăng nhập quản trị

Truy cập `http://localhost:3001/login` với thông tin đã đặt ở
`ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` trong `backend/.env`.

**Nếu báo "Email hoặc mật khẩu không đúng"**: `npm run seed` chỉ tạo admin khi
chưa có, và **không bao giờ ghi đè mật khẩu của tài khoản đã tồn tại** (để việc
seed lại dữ liệu mẫu không vô hiệu hoá credential đang dùng). Nên nếu bạn đổi
`ADMIN_SEED_PASSWORD` sau lần seed đầu tiên, mật khẩu trong DB vẫn là cái cũ.

```bash
cd backend
npm run admin              # kiểm tra: tài khoản có tồn tại không, mật khẩu
                           # trong .env có khớp hash trong DB không (không đổi gì)
npm run admin -- --reset   # tạo admin, hoặc đặt lại mật khẩu theo ADMIN_SEED_PASSWORD
```

Có thể ghi đè bằng `--email=<địa chỉ>` và `--password=<mật khẩu>`. Script không
bao giờ in mật khẩu ra log. `--reset` cũng bật lại `isActive` — một tài khoản bị
vô hiệu hoá sẽ trượt đăng nhập trước cả khi mật khẩu được kiểm tra, nên nếu
không bật lại thì "đặt lại mật khẩu" trông như không có tác dụng.

## Xác thực admin: httpOnly cookie + CSRF (không còn localStorage)

Trước đây token admin là JWT lưu trong `localStorage` qua header
`Authorization: Bearer`. Rủi ro: `localStorage` chỉ cô lập theo **origin**, nên
storefront và admin từng chung 1 domain nghĩa là một XSS trên storefront (vd
nội dung review chưa lọc kỹ) đọc được thẳng token admin.

Cơ chế mới:

- **Phiên đăng nhập nằm trong cookie `admin_token`**: `HttpOnly` (JS không đọc
  được, kể cả từ chính app admin), `Secure` ở production, `SameSite=Lax`,
  **host-only** (không set `Domain` — xem lý do trong
  `backend/src/config/env.ts`). `frontend-admin/` không lưu token ở bất kỳ đâu
  trong JS — không `localStorage`, không `document.cookie`.
- **CSRF được chống bằng synchronizer token, không phải double-submit
  cookie**: token CSRF được suy ra từ `sub + jti` của JWT bằng HMAC (xem
  `backend/src/utils/csrf.ts`), trả về **trong JSON body** của
  `POST /admin/auth/login` và `GET /admin/auth/me` — không phải qua cookie.
  Lý do chọn cách này thay vì double-submit cookie kinh điển: double-submit
  cookie đòi hỏi cookie CSRF phải **đọc được bằng JS của app admin**, và cách
  duy nhất để làm vậy mà không cần cùng origin với API là set `Domain` rộng ra
  cả domain cha — nhưng làm vậy thì storefront (cùng domain cha) cũng đọc
  được cookie đó nếu dính XSS, gần như phá mất lý do tách domain ngay từ đầu.
  Với synchronizer token, storefront dù kích hoạt được request (cookie tự
  đính kèm vì cùng site) cũng không thể đọc được response (bị chặn bởi CORS,
  vì storefront không nằm trong whitelist origin được phép gửi credentials
  tới các endpoint này) — nên không bao giờ lấy được giá trị token để giả
  mạo.
  `frontend-admin/` giữ token này trong biến JS ở bộ nhớ (`lib/csrf.ts`), gắn
  vào header `X-CSRF-Token` cho mọi request POST/PATCH/DELETE.
- **`POST /admin/auth/logout`** xoá cookie phía server (JS không tự xoá được
  cookie `HttpOnly`).
- **CORS chuyển từ 1 origin sang whitelist nhiều origin**
  (`CORS_ORIGINS` trong `backend/.env`, mặc định gồm cả `:3000` và `:3001` khi
  dev), luôn `credentials: true`, không bao giờ reflect origin không nằm
  trong whitelist.

**Không đổi gì** với luồng khách hàng: guest checkout, giỏ hàng, tra cứu đơn —
không có cookie, không có CSRF, hoạt động y như trước.

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
   `EMAIL_PROVIDER=gmail` + 4 biến `GMAIL_*` (xem mục Email bên dưới), và
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

- `npm test` (backend, Vitest): **134 test**.
  - Unit (repository được stub, không cần DB): sinh VietQR đối chiếu vector
    tham chiếu NAPAS, xác thực webhook SePay (HMAC/API key/replay), toàn bộ
    quy tắc đối soát (sai số tiền, sai nội dung, sai tài khoản, webhook trùng,
    hết hạn, hoàn kho/coupon, email gửi đúng một lần), dựng MIME + mã hoá
    tiếng Việt + chặn header injection, cache access token của Gmail, mapping
    lỗi upload ảnh.
  - Integration (`tests/integration/`, chạy trên replica set thật, tự bỏ qua
    nếu không kết nối được): xác nhận transaction thật sự hoạt động và
    **kiểm chứng bằng chạy song song**:
    - 8 khách mua đồng thời, kho còn 3 → đúng 3 đơn thành công, kho về 0,
      không có Order/Payment mồ côi.
    - 6 khách dùng đồng thời coupon `usageLimit: 2` → đúng 2 đơn thành công,
      `usageCount` bằng đúng 2, 4 đơn thất bại không tiêu kho.
    - Checkout lỗi giữa chừng → không để lại gì: 0 Order, 0 Payment, kho
      nguyên vẹn.
    - **Auth cookie + CSRF qua HTTP thật** (`adminAuth.integration.test.ts`,
      20 test dùng `supertest` gọi thẳng app thật): thuộc tính cookie
      (`HttpOnly`/`SameSite=Lax`/host-only/`Max-Age` đúng `JWT_EXPIRES_IN`),
      login không trả `token` trong body, mutating route từ chối khi thiếu
      hoặc sai `X-CSRF-Token`, CSRF token của phiên A không dùng được cho
      phiên B, logout xoá cookie, CORS chỉ reflect origin trong whitelist,
      route công khai (storefront) không bị ảnh hưởng.
- Race-condition tồn kho: trừ kho bằng `findOneAndUpdate` atomic theo từng SKU
  (điều kiện `inventoryQty >= quantity` nằm trong filter), toàn bộ nằm trong
  transaction; hoàn kho/coupon qua atomic claim nên không bao giờ chạy hai lần.
- Lượt dùng coupon được claim atomic (`claimUsage` kiểm tra lại `usageLimit`
  và khoảng thời gian hiệu lực ngay trong filter của update), nên không thể
  vượt hạn mức khi nhiều khách đặt cùng lúc.
- `npm run build` ở cả hai thư mục chạy sạch (frontend prerender 28 routes,
  backend biên dịch TypeScript không lỗi).

## Email (Gmail API)

Mỗi đơn thanh toán thành công gửi **hai** email, mỗi loại đúng một lần:

| Email | Người nhận | Nội dung |
|---|---|---|
| Xác nhận thanh toán | email khách nhập lúc checkout | mã đơn, số tiền, sản phẩm, địa chỉ giao, link tra cứu đơn |
| Thông báo đơn mới | `ORDER_NOTIFICATION_EMAILS` (có thể nhiều người, cách nhau bằng phẩy) | cần đóng gói gì, giao đến đâu, ghi chú của khách, thông tin đối soát, link mở đơn trong trang quản trị |

Hai email được theo dõi độc lập trên Payment (`confirmationEmail*` và
`ownerNotification*`) nên một cái lỗi không chặn hoặc gửi lại cái kia, và
không cái nào có thể làm hỏng trạng thái đã thanh toán của đơn.

### Lấy refresh token (làm một lần)

1. [Google Cloud Console](https://console.cloud.google.com) → tạo project →
   bật **Gmail API**.
2. **OAuth consent screen**: chọn External, thêm địa chỉ `GMAIL_SENDER` vào
   danh sách *Test users*.
3. **Credentials** → *Create OAuth client ID* → loại **Desktop app**. Lưu lại
   Client ID và Client secret.
4. Mở URL sau trên trình duyệt (thay `<GMAIL_CLIENT_ID>`), bấm đồng ý, rồi
   copy tham số `code` trên thanh địa chỉ sau khi bị chuyển hướng:

   ```
   https://accounts.google.com/o/oauth2/v2/auth?client_id=<GMAIL_CLIENT_ID>&redirect_uri=http://localhost&response_type=code&scope=https://www.googleapis.com/auth/gmail.send&access_type=offline&prompt=consent
   ```

5. Đổi `code` lấy refresh token:

   ```bash
   curl -s https://oauth2.googleapis.com/token \
     -d client_id=<GMAIL_CLIENT_ID> -d client_secret=<GMAIL_CLIENT_SECRET> \
     -d code=<CODE> -d grant_type=authorization_code -d redirect_uri=http://localhost
   ```

6. Điền vào `backend/.env`:

   ```
   EMAIL_PROVIDER=gmail
   GMAIL_CLIENT_ID=...
   GMAIL_CLIENT_SECRET=...
   GMAIL_REFRESH_TOKEN=...
   GMAIL_SENDER=shop@lylaglass.vn
   EMAIL_FROM=LylaGlass <shop@lylaglass.vn>
   ORDER_NOTIFICATION_EMAILS=owner@lylaglass.vn
   ```

`EMAIL_FROM` phải là chính `GMAIL_SENDER` hoặc một alias đã xác minh trong mục
"Send mail as" của Gmail — nếu không Gmail sẽ từ chối.

Quyền được cấp chỉ là `gmail.send` (**không** đọc được hộp thư) và có thể thu
hồi bất cứ lúc nào trong phần bảo mật của tài khoản Google. Không có mật khẩu
nào được lưu.

Hạn ngạch gửi: ~500 người nhận/ngày với tài khoản @gmail.com, ~2000/ngày với
Google Workspace.

## Upload ảnh sản phẩm (Cloudinary)

Trong `Quản trị → Sản phẩm → Thêm/Sửa`, phần **Hình ảnh** cho phép kéo-thả hoặc
chọn nhiều ảnh từ máy. Ảnh được tải thẳng lên Cloudinary, form nhận về URL và
`publicId`. Ngoài ra vẫn dán được URL ngoài bằng nút "Dán URL".

- Ảnh **đầu tiên** trong danh sách là ảnh đại diện (hiện ở trang danh sách, giỏ
  hàng, email). Dùng nút mũi tên lên/xuống để đổi thứ tự.
- Giới hạn **5MB**, định dạng **JPEG / PNG / WEBP / AVIF**. Kiểm tra ở cả ba nơi:
  trình duyệt (báo lỗi ngay, không tốn băng thông), multer, và `allowed_formats`
  của Cloudinary.
- Chọn nhiều ảnh thì mỗi ảnh tải lên độc lập — một ảnh lỗi không làm mất những
  ảnh đã lên thành công, và báo rõ tệp nào hỏng vì sao.
- Alt text mặc định lấy từ tên tệp, sửa lại được tại chỗ.

Cấu hình: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
trong `backend/.env`.

> **Cấu hình Cloudinary được đọc lúc khởi động.** Sau khi điền key phải **khởi
> động lại backend**, nếu không upload sẽ lỗi dù key đã đúng. Thiếu key thì
> backend log cảnh báo lúc boot (storefront vẫn chạy bình thường, chỉ nút tải
> ảnh là hỏng).

## Giới hạn đã biết / việc còn lại

- Ảnh sản phẩm **seed** dùng Unsplash (đã kiểm tra URL còn hoạt động) làm placeholder
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
