import { Router } from "express";
import { validate } from "@/middlewares/validate";
import { requireAdmin } from "@/middlewares/adminAuth";
import { uploadSingleImage } from "@/middlewares/upload";
import {
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
  updateInventorySchema,
} from "@/validators/product.validators";
import {
  listProducts,
  listAdminProducts,
  getProductBySlug,
  getAdminProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductInventory,
} from "@/controllers/product.controller";
import { uploadProductImage } from "@/controllers/upload.controller";
import { getProductReviews, createReview } from "@/controllers/review.controller";
import { createReviewSchema } from "@/validators/review.validators";

const router = Router();

router.get("/", validate({ query: listProductsQuerySchema }), listProducts);
router.get("/admin/all", requireAdmin, validate({ query: listProductsQuerySchema }), listAdminProducts);
router.get("/admin/:id", requireAdmin, getAdminProductById);
router.get("/:slug", getProductBySlug);
router.get("/:productId/reviews", getProductReviews);
router.post("/:productId/reviews", validate({ body: createReviewSchema }), createReview);

router.post("/", requireAdmin, validate({ body: createProductSchema }), createProduct);
router.patch("/:id", requireAdmin, validate({ body: updateProductSchema }), updateProduct);
router.delete("/:id", requireAdmin, deleteProduct);
router.patch("/:id/inventory", requireAdmin, validate({ body: updateInventorySchema }), updateProductInventory);
router.post("/upload-image", requireAdmin, uploadSingleImage, uploadProductImage);

export default router;
