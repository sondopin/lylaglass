import { ReviewModel } from "@/models/Review.model";

export const reviewRepository = {
  findByProduct: (productId: string) =>
    ReviewModel.find({ productId, isApproved: true }).sort({ createdAt: -1 }).lean(),
  create: (data: Record<string, unknown>) => ReviewModel.create(data),
  async ratingSummary(productId: string) {
    const result = await ReviewModel.aggregate([
      { $match: { productId: { $eq: productId }, isApproved: true } },
      { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    return { average: result[0]?.average ?? 0, count: result[0]?.count ?? 0 };
  },
};
