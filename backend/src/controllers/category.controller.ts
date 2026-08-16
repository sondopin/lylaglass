import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendCreated, sendSuccess } from "@/utils/apiResponse";
import { categoryService } from "@/services/category.service";

export const listPublicCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await categoryService.listPublic();
  sendSuccess(res, categories);
});

export const getCategoryBySlug = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.getBySlug(req.params.idOrSlug);
  sendSuccess(res, category);
});

export const listAdminCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await categoryService.listAdmin();
  sendSuccess(res, categories);
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.create(req.body);
  sendCreated(res, category);
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.update(req.params.idOrSlug, req.body);
  sendSuccess(res, category);
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  await categoryService.remove(req.params.idOrSlug);
  sendSuccess(res, { deleted: true });
});
