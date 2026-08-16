import { Schema, model, Types, InferSchemaType } from "mongoose";

const reviewSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    authorName: { type: String, required: true, trim: true },
    title: { type: String, default: "" },
    body: { type: String, required: true },
    isVerifiedPurchase: { type: Boolean, default: false },
    isApproved: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type Review = InferSchemaType<typeof reviewSchema> & { _id: Types.ObjectId };
export const ReviewModel = model("Review", reviewSchema);
