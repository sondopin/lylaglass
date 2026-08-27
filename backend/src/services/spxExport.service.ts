import ExcelJS from "exceljs";
import { OrderRecord } from "@/repositories/order.repository";

/**
 * Column layout copied verbatim (header text + order) from the "Tạo đơn (địa
 * chỉ cũ)" sheet of SPX's own
 * collect_fee_mass_order_creation_template_vn_2level_addr.xlsx — the 2-level
 * address tab (Tỉnh/Thành Phố + Xã/Phường, no Quận/Huyện), matching what the
 * filename promises. SPX's importer matches columns by position, so the
 * header text and order must stay byte-for-byte identical to the template.
 */
const SPX_HEADER = [
  "*Mã đơn hàng",
  "*Tên người nhận",
  "*Số điện thoại",
  "*Địa chỉ chi tiết",
  "Tỉnh/Thành Phố",
  "Xã/Phường",
  "Lưu ý về địa chỉ",
  "Mã bưu chính",
  "*Tên sản phẩm",
  "Số lượng (Thông tin bắt buộc khi chọn Giao hàng một phần & Thu COD)",
  "Giá tiền (Thông tin bắt buộc khi chọn Giao hàng một phần & Thu COD)",
  "*Tổng cân nặng bưu gửi (KG)",
  "Chiều dài (CM)",
  "Chiều rộng (CM)",
  "Chiều cao (CM)",
  "Mã khách hàng",
  "*Giá trị đơn hàng",
  "*Giao hàng một phần (Y/N)",
  "*Cho phép thử hàng (Y/N)",
  "*Cho xem hàng, không cho thử (Y/N)",
  "Thu phí từ chối nhận hàng (Y/N)",
  "Phí từ chối nhận hàng cần thu",
  "*Thu COD (Y/N)",
  "Số tiền COD",
  "bưu gửi giá trị cao (Y/N)",
  "*Hình thức thanh Toán",
  "Lưu ý giao hàng",
];

export interface SpxExportOptions {
  defaultWeightPerItemKg: number;
  allowPartialDelivery: boolean;
  allowTryOn: boolean;
  allowViewNoTry: boolean;
  highValueThreshold: number;
}

function yn(value: boolean) {
  return value ? "Y" : "N";
}

/**
 * One row per order line item (not per order): shared order-level fields
 * (address, weight, order value) repeat on every row that shares the same
 * order code, while product name/quantity/unit price vary per line — the
 * same convention the template's own multi-item examples use.
 */
function buildRows(order: OrderRecord, options: SpxExportOptions): unknown[][] {
  const address = order.shippingAddress;
  // The 2-level sheet has no Quận/Huyện column; fold it into the detail
  // address line so district data captured pre-checkout is not silently lost.
  const addressDetail = [address.line1, address.district].filter(Boolean).join(", ");
  const totalWeightKg = Math.round(
    order.items.reduce((sum, item) => sum + item.quantity, 0) * options.defaultWeightPerItemKg * 100
  ) / 100;
  const isHighValue = yn(order.total >= options.highValueThreshold);

  return order.items.map((item) => [
    order.orderNumber,
    address.fullName,
    address.phone,
    addressDetail,
    address.province,
    address.ward || "",
    address.line2 || "",
    address.postalCode || "",
    item.variantName ? `${item.productName} - ${item.variantName}` : item.productName,
    item.quantity,
    item.unitPrice,
    totalWeightKg,
    "",
    "",
    "",
    order.customer?.customerId ? String(order.customer.customerId) : "",
    order.total,
    yn(options.allowPartialDelivery),
    yn(options.allowTryOn),
    yn(options.allowViewNoTry),
    "N",
    "",
    // Already collected in full via VietQR bank transfer at checkout — never COD.
    "N",
    "",
    isHighValue,
    // The shop collects the shipping fee from the customer up front (it is
    // part of `order.total`), so the shop is the one who owes SPX the freight.
    "Người gửi trả",
    order.customerNote || "",
  ]);
}

export async function buildSpxExportBuffer(orders: OrderRecord[], options: SpxExportOptions) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Tạo đơn (địa chỉ cũ)");
  sheet.addRow(SPX_HEADER);

  let rowCount = 0;
  for (const order of orders) {
    for (const row of buildRows(order, options)) {
      sheet.addRow(row);
      rowCount++;
    }
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return { buffer: Buffer.from(arrayBuffer), rowCount };
}
