import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/apiResponse";
import { handleBankWebhook } from "@/services/payment.service";
import { bankTransactionRepository, BankTransactionListFilters } from "@/repositories/bankTransaction.repository";

/**
 * Public endpoint the bank notification provider (SePay) calls whenever the
 * shop's TPBank account receives money. Not protected by the admin JWT — it is
 * authenticated by the provider's signature/API key inside the provider class.
 *
 * The response body is deliberately a bare `{ success: true }` rather than the
 * usual `{ success, data }` envelope: SePay only treats a delivery as accepted
 * when the body is exactly that, and anything else puts the transaction into
 * its retry queue.
 */
export const receiveBankWebhook = asyncHandler(async (req: Request, res: Response) => {
  await handleBankWebhook(req.body as Buffer, req.headers);
  // 200 + {"success":true} means "received and recorded" — not "payment accepted".
  // Rejected transfers are stored for reconciliation, so the provider must stop
  // retrying them; only auth failures and real server errors get a non-2xx.
  res.status(200).json({ success: true });
});

export const listAdminBankTransactions = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as BankTransactionListFilters;
  const { items, total } = await bankTransactionRepository.list(filters);
  sendSuccess(res, items, 200, {
    page: filters.page,
    limit: filters.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / filters.limit)),
  });
});
