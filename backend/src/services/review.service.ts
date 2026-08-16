import { ApiError } from "@/utils/ApiError";
import { reviewRepository } from "@/repositories/review.repository";
import { productRepository } from "@/repositories/product.repository";
import { ProductModel } from "@/models/Product.model";

export async function listProductReviews(productId: string) {
  const [reviews, summary] = await Promise.all([
    reviewRepository.findByProduct(productId),
    reviewRepository.ratingSummary(productId),
  ]);
  return { reviews, summary };
}

export async function createProductReview(
  productId: string,
  input: { rating: number; authorName: string; title?: string; body: string }
) {
  const product = await productRepository.findById(productId);
  if (!product) throw ApiError.notFound("Không tìm thấy sản phẩm");

  await reviewRepository.create({ productId, ...input });

  const summary = await reviewRepository.ratingSummary(productId);
  await ProductModel.findByIdAndUpdate(productId, {
    ratingAverage: Math.round(summary.average * 10) / 10,
    reviewCount: summary.count,
  });

  return summary;
}
