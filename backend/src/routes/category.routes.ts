import { Router } from "express";
import { validate } from "@/middlewares/validate";
import { requireAdmin, requireRole } from "@/middlewares/adminAuth";
import { createCategorySchema, updateCategorySchema, categoryParamsSchema } from "@/validators/category.validators";
import {
  listPublicCategories,
  getCategoryBySlug,
  listAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/controllers/category.controller";

const router = Router();

router.get("/", listPublicCategories);
router.get("/admin/all", requireAdmin, listAdminCategories);
router.get("/:idOrSlug", validate({ params: categoryParamsSchema }), getCategoryBySlug);

router.post("/", requireAdmin, requireRole("owner", "staff"), validate({ body: createCategorySchema }), createCategory);
router.patch(
  "/:idOrSlug",
  requireAdmin,
  requireRole("owner", "staff"),
  validate({ params: categoryParamsSchema, body: updateCategorySchema }),
  updateCategory
);
router.delete("/:idOrSlug", requireAdmin, requireRole("owner"), validate({ params: categoryParamsSchema }), deleteCategory);

export default router;
