import { Schema, model, Types, InferSchemaType } from "mongoose";

const paymentSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    provider: { type: String, enum: ["mock", "stripe"], required: true },
    intentId: { type: String, required: true, index: true }, // provider-side payment intent / session id
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "VND" },
    status: {
      type: String,
      enum: ["requires_action", "processing", "succeeded", "failed", "refunded"],
      default: "processing",
      index: true,
    },
    method: { type: String, default: "" }, // card / bank_transfer / cod / mock
    last4: { type: String, default: "" },
    failureReason: { type: String, default: "" },
    rawEvent: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export type Payment = InferSchemaType<typeof paymentSchema> & { _id: Types.ObjectId };
export const PaymentModel = model("Payment", paymentSchema);
