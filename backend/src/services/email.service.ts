import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { getEmailProvider } from "@/email";
import { OrderRecord } from "@/repositories/order.repository";
import { PaymentRecord } from "@/repositories/payment.repository";

/**
 * The schema marks `customer` required, but Mongoose infers nested objects as
 * optional, so it is narrowed once here instead of guarded at every use.
 */
type OrderCustomer = NonNullable<OrderRecord["customer"]>;

function orderCustomer(order: OrderRecord): OrderCustomer {
  return order.customer as OrderCustomer;
}

function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(amount)}đ`;
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(value);
}

/** Order data is customer-supplied, so everything interpolated into HTML is escaped. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function orderLookupUrl(order: OrderRecord): string {
  const base = env.storefrontUrl.replace(/\/$/, "");
  return `${base}/don-hang/${encodeURIComponent(order.orderNumber)}?email=${encodeURIComponent(orderCustomer(order).email)}`;
}

function addressLines(order: OrderRecord): string {
  return [
    order.shippingAddress.line1,
    order.shippingAddress.line2,
    order.shippingAddress.ward,
    order.shippingAddress.district,
    order.shippingAddress.province,
  ]
    .filter(Boolean)
    .join(", ");
}

export interface PaymentConfirmationEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Renders the "payment successful" transactional email. Pure and exported so
 * its content can be asserted in tests without sending anything.
 */
export function buildPaymentConfirmationEmail(order: OrderRecord, payment: PaymentRecord): PaymentConfirmationEmail {
  const subject = `Thanh toán thành công - Đơn hàng ${order.orderNumber}`;
  const lookupUrl = orderLookupUrl(order);
  const paidAt = payment.paidAt ?? new Date();

  const itemRows = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee">
            ${escapeHtml(item.productName)}<br />
            <span style="color:#777;font-size:12px">${escapeHtml(item.variantName)} × ${item.quantity}</span>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">
            ${formatVnd(item.lineTotal)}
          </td>
        </tr>`
    )
    .join("");

  const html = `<!doctype html>
<html lang="vi">
  <body style="margin:0;background:#f6f6f4;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px">
      <div style="background:#fff;border-radius:16px;padding:28px">
        <p style="margin:0 0 4px;color:#059669;font-size:12px;letter-spacing:.08em;text-transform:uppercase">
          Thanh toán thành công
        </p>
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:500">Cảm ơn bạn đã đặt hàng tại LylaGlass!</h1>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6">
          Chúng tôi đã nhận được khoản chuyển khoản của bạn. Đơn hàng đã được xác nhận và sẽ được xử lý sớm.
        </p>

        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:4px 0;color:#777">Mã đơn hàng</td><td style="padding:4px 0;text-align:right;font-weight:600">${escapeHtml(order.orderNumber)}</td></tr>
          <tr><td style="padding:4px 0;color:#777">Số tiền</td><td style="padding:4px 0;text-align:right;font-weight:600">${formatVnd(order.total)}</td></tr>
          <tr><td style="padding:4px 0;color:#777">Phương thức</td><td style="padding:4px 0;text-align:right">Chuyển khoản ngân hàng qua VietQR / ${escapeHtml(payment.bankName || "TPBank")}</td></tr>
          <tr><td style="padding:4px 0;color:#777">Mã thanh toán</td><td style="padding:4px 0;text-align:right">${escapeHtml(payment.paymentCode)}</td></tr>
          <tr><td style="padding:4px 0;color:#777">Thời gian thanh toán</td><td style="padding:4px 0;text-align:right">${formatDateTime(paidAt)}</td></tr>
        </table>

        <h2 style="margin:24px 0 8px;font-size:16px;font-weight:500">Sản phẩm</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">${itemRows}</table>

        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px">
          <tr><td style="padding:3px 0;color:#777">Tạm tính</td><td style="padding:3px 0;text-align:right">${formatVnd(order.subtotal)}</td></tr>
          ${
            order.discountTotal > 0
              ? `<tr><td style="padding:3px 0;color:#059669">Giảm giá${order.couponCode ? ` (${escapeHtml(order.couponCode)})` : ""}</td><td style="padding:3px 0;text-align:right;color:#059669">-${formatVnd(order.discountTotal)}</td></tr>`
              : ""
          }
          <tr><td style="padding:3px 0;color:#777">Phí vận chuyển</td><td style="padding:3px 0;text-align:right">${formatVnd(order.shippingFee)}</td></tr>
          <tr><td style="padding:8px 0 0;font-weight:600;border-top:1px solid #eee">Tổng cộng</td><td style="padding:8px 0 0;text-align:right;font-weight:600;border-top:1px solid #eee">${formatVnd(order.total)}</td></tr>
        </table>

        <h2 style="margin:24px 0 8px;font-size:16px;font-weight:500">Giao hàng</h2>
        <p style="margin:0;font-size:14px;line-height:1.6">
          ${escapeHtml(order.shippingAddress.fullName)}<br />
          ${escapeHtml(order.shippingAddress.phone)}<br />
          <span style="color:#777">${escapeHtml(addressLines(order))}</span>
        </p>

        <p style="margin:24px 0 0">
          <a href="${lookupUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:14px">
            Xem đơn hàng
          </a>
        </p>

        <p style="margin:20px 0 0;font-size:12px;color:#777">
          Đơn hàng được đặt lúc ${formatDateTime(order.createdAt as Date)}.
          Nếu cần hỗ trợ, hãy phản hồi email này.
        </p>
      </div>
    </div>
  </body>
</html>`;

  const text = [
    "Thanh toán thành công",
    "",
    `Mã đơn hàng: ${order.orderNumber}`,
    `Số tiền: ${formatVnd(order.total)}`,
    `Phương thức: Chuyển khoản ngân hàng qua VietQR / ${payment.bankName || "TPBank"}`,
    `Mã thanh toán: ${payment.paymentCode}`,
    `Thời gian thanh toán: ${formatDateTime(paidAt)}`,
    "",
    "Đơn hàng của bạn đã được xác nhận.",
    "",
    "Sản phẩm:",
    ...order.items.map((item) => `- ${item.productName} (${item.variantName}) × ${item.quantity}: ${formatVnd(item.lineTotal)}`),
    "",
    `Tạm tính: ${formatVnd(order.subtotal)}`,
    ...(order.discountTotal > 0 ? [`Giảm giá: -${formatVnd(order.discountTotal)}`] : []),
    `Phí vận chuyển: ${formatVnd(order.shippingFee)}`,
    `Tổng cộng: ${formatVnd(order.total)}`,
    "",
    `Giao đến: ${order.shippingAddress.fullName}, ${order.shippingAddress.phone}, ${addressLines(order)}`,
    "",
    `Tra cứu đơn hàng: ${lookupUrl}`,
  ].join("\n");

  return { subject, html, text };
}

/**
 * Sends the payment confirmation to the email the customer entered at checkout.
 * Throws on failure — callers own the retry/status bookkeeping, because a failed
 * email must never roll back a successful payment.
 */
export async function sendPaymentConfirmationEmail(order: OrderRecord, payment: PaymentRecord) {
  const { subject, html, text } = buildPaymentConfirmationEmail(order, payment);
  const provider = getEmailProvider();
  const result = await provider.send({ to: orderCustomer(order).email, subject, html, text });
  logger.info(
    { orderNumber: order.orderNumber, paymentId: String(payment._id), provider: provider.name, messageId: result.id },
    "email sent"
  );
  return result;
}

function adminOrderUrl(order: OrderRecord): string {
  const base = env.storefrontUrl.replace(/\/$/, "");
  return `${base}/quan-tri/don-hang/${String(order._id)}`;
}

/**
 * Renders the shop-side "new paid order" alert. Deliberately different from the
 * customer email: it leads with what the shop must act on (money received, what
 * to pack, where to ship) and links straight to the admin order screen.
 *
 * Pure and exported so its content can be asserted in tests.
 */
export function buildNewOrderNotificationEmail(order: OrderRecord, payment: PaymentRecord): PaymentConfirmationEmail {
  const customer = orderCustomer(order);
  const subject = `Đơn mới đã thanh toán: ${order.orderNumber} — ${formatVnd(order.total)}`;
  const paidAt = payment.paidAt ?? new Date();
  const adminUrl = adminOrderUrl(order);

  const itemRows = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee">
            ${escapeHtml(item.productName)}<br />
            <span style="color:#777;font-size:12px">${escapeHtml(item.variantName)} · SKU ${escapeHtml(item.sku)}</span>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center">× ${item.quantity}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${formatVnd(item.lineTotal)}</td>
        </tr>`
    )
    .join("");

  const html = `<!doctype html>
<html lang="vi">
  <body style="margin:0;background:#f6f6f4;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a">
    <div style="max-width:600px;margin:0 auto;padding:32px 20px">
      <div style="background:#fff;border-radius:16px;padding:28px">
        <p style="margin:0 0 4px;color:#059669;font-size:12px;letter-spacing:.08em;text-transform:uppercase">
          Đã nhận tiền
        </p>
        <h1 style="margin:0 0 4px;font-size:22px;font-weight:500">
          Đơn ${escapeHtml(order.orderNumber)} — ${formatVnd(order.total)}
        </h1>
        <p style="margin:0 0 20px;font-size:13px;color:#777">
          Thanh toán lúc ${formatDateTime(paidAt)} · cần chuẩn bị hàng và giao
        </p>

        <h2 style="margin:0 0 8px;font-size:15px;font-weight:600">Cần đóng gói</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">${itemRows}</table>

        <h2 style="margin:24px 0 8px;font-size:15px;font-weight:600">Giao đến</h2>
        <p style="margin:0;font-size:14px;line-height:1.6">
          ${escapeHtml(order.shippingAddress.fullName)} · ${escapeHtml(order.shippingAddress.phone)}<br />
          <span style="color:#777">${escapeHtml(addressLines(order))}</span>
        </p>
        ${
          order.customerNote
            ? `<p style="margin:12px 0 0;padding:10px 12px;background:#fff8e1;border-radius:8px;font-size:13px">
                 <strong>Ghi chú của khách:</strong> ${escapeHtml(order.customerNote)}
               </p>`
            : ""
        }

        <h2 style="margin:24px 0 8px;font-size:15px;font-weight:600">Khách hàng</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:3px 0;color:#777">Tên</td><td style="padding:3px 0;text-align:right">${escapeHtml(customer.name)}</td></tr>
          <tr><td style="padding:3px 0;color:#777">Email</td><td style="padding:3px 0;text-align:right">${escapeHtml(customer.email)}</td></tr>
          <tr><td style="padding:3px 0;color:#777">Điện thoại</td><td style="padding:3px 0;text-align:right">${escapeHtml(customer.phone)}</td></tr>
        </table>

        <h2 style="margin:24px 0 8px;font-size:15px;font-weight:600">Đối soát</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:3px 0;color:#777">Tạm tính</td><td style="padding:3px 0;text-align:right">${formatVnd(order.subtotal)}</td></tr>
          ${
            order.discountTotal > 0
              ? `<tr><td style="padding:3px 0;color:#059669">Giảm giá${order.couponCode ? ` (${escapeHtml(order.couponCode)})` : ""}</td><td style="padding:3px 0;text-align:right;color:#059669">-${formatVnd(order.discountTotal)}</td></tr>`
              : ""
          }
          <tr><td style="padding:3px 0;color:#777">Phí vận chuyển</td><td style="padding:3px 0;text-align:right">${formatVnd(order.shippingFee)}</td></tr>
          <tr><td style="padding:6px 0 3px;font-weight:600;border-top:1px solid #eee">Đã nhận</td><td style="padding:6px 0 3px;text-align:right;font-weight:600;border-top:1px solid #eee">${formatVnd(payment.transferredAmount ?? order.total)}</td></tr>
          <tr><td style="padding:3px 0;color:#777">Mã thanh toán</td><td style="padding:3px 0;text-align:right">${escapeHtml(payment.paymentCode)}</td></tr>
          <tr><td style="padding:3px 0;color:#777">Mã giao dịch NH</td><td style="padding:3px 0;text-align:right">${escapeHtml(payment.transactionId ?? "—")}</td></tr>
          <tr><td style="padding:3px 0;color:#777">Reference</td><td style="padding:3px 0;text-align:right">${escapeHtml(payment.referenceCode || "—")}</td></tr>
        </table>
        ${
          payment.needsManualReview
            ? `<p style="margin:16px 0 0;padding:10px 12px;background:#fef2f2;border-radius:8px;font-size:13px;color:#991b1b">
                 <strong>⚠ Cần đối soát thủ công:</strong> ${escapeHtml(payment.manualReviewReason)}
               </p>`
            : ""
        }

        <p style="margin:24px 0 0">
          <a href="${adminUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:14px">
            Mở đơn trong trang quản trị
          </a>
        </p>
      </div>
    </div>
  </body>
</html>`;

  const text = [
    `ĐƠN MỚI ĐÃ THANH TOÁN: ${order.orderNumber}`,
    "",
    `Số tiền     : ${formatVnd(order.total)}`,
    `Đã nhận     : ${formatVnd(payment.transferredAmount ?? order.total)}`,
    `Thanh toán  : ${formatDateTime(paidAt)}`,
    `Mã thanh toán: ${payment.paymentCode}`,
    `Mã giao dịch : ${payment.transactionId ?? "—"}`,
    `Reference    : ${payment.referenceCode || "—"}`,
    "",
    "Cần đóng gói:",
    ...order.items.map((item) => `- ${item.productName} (${item.variantName}, SKU ${item.sku}) × ${item.quantity}: ${formatVnd(item.lineTotal)}`),
    "",
    `Giao đến: ${order.shippingAddress.fullName}, ${order.shippingAddress.phone}`,
    `         ${addressLines(order)}`,
    ...(order.customerNote ? [`Ghi chú của khách: ${order.customerNote}`] : []),
    "",
    `Khách: ${customer.name} · ${customer.email} · ${customer.phone}`,
    "",
    `Tạm tính: ${formatVnd(order.subtotal)}`,
    ...(order.discountTotal > 0 ? [`Giảm giá: -${formatVnd(order.discountTotal)}${order.couponCode ? ` (${order.couponCode})` : ""}`] : []),
    `Phí vận chuyển: ${formatVnd(order.shippingFee)}`,
    ...(payment.needsManualReview ? ["", `⚠ CẦN ĐỐI SOÁT THỦ CÔNG: ${payment.manualReviewReason}`] : []),
    "",
    `Mở đơn: ${adminUrl}`,
  ].join("\n");

  return { subject, html, text };
}

/**
 * Alerts the shop that a paid order came in. Throws on failure so the caller can
 * record it and retry — the customer's confirmation and the payment itself are
 * never affected by this email.
 */
export async function sendNewOrderNotificationEmail(order: OrderRecord, payment: PaymentRecord) {
  const recipients = env.email.orderNotificationRecipients;
  if (recipients.length === 0) throw new Error("ORDER_NOTIFICATION_EMAILS chưa được cấu hình");

  const { subject, html, text } = buildNewOrderNotificationEmail(order, payment);
  const provider = getEmailProvider();
  const result = await provider.send({ to: recipients, subject, html, text });
  logger.info(
    {
      orderNumber: order.orderNumber,
      paymentId: String(payment._id),
      provider: provider.name,
      recipients: recipients.length,
      messageId: result.id,
    },
    "owner notification sent"
  );
  return result;
}
