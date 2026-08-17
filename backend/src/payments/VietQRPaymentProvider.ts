import { ApiError } from "@/utils/ApiError";
import { buildVietQrPayload } from "./vietqrPayload";
import { renderQrCodeDataUrl } from "./qrImage";
import {
  CreatePaymentIntentInput,
  CreatePaymentIntentResult,
  PaymentBankAccount,
  PaymentProvider,
} from "./PaymentProvider";

/**
 * Produces a VietQR (NAPAS 247) transfer QR for the shop's own bank account.
 *
 * This provider ONLY creates payment instructions — it never observes or
 * confirms money movement. A QR being generated, opened or scanned says nothing
 * about whether the customer paid; confirmation comes exclusively from an
 * incoming-transfer notification (see BankNotificationProvider).
 *
 * The QR is rendered locally from server-side data, so the bank account number
 * is never handed to a third-party image service.
 */
export class VietQRPaymentProvider implements PaymentProvider {
  readonly name = "vietqr";

  constructor(private readonly account: PaymentBankAccount) {}

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
    if (!this.account.accountNumber || !this.account.bin) {
      throw ApiError.internal("Chưa cấu hình tài khoản ngân hàng nhận thanh toán");
    }

    let qrPayload: string;
    try {
      qrPayload = buildVietQrPayload({
        bankBin: this.account.bin,
        accountNumber: this.account.accountNumber,
        amount: input.amount,
        description: input.paymentCode,
      });
    } catch {
      // Never leak bank configuration details through an API error message.
      throw ApiError.internal("Không thể tạo mã VietQR cho đơn hàng này");
    }

    const qrCodeDataUrl = await renderQrCodeDataUrl(qrPayload);

    return {
      // VietQR has no external gateway session, so the payment code doubles as
      // the intent identifier.
      intentId: input.paymentCode,
      // Money has not moved yet — the customer still has to make the transfer.
      status: "requires_action",
      method: "bank_transfer",
      bank: this.account,
      qrPayload,
      qrCodeDataUrl,
    };
  }
}
