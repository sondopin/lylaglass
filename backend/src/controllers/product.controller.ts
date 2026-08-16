import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendCreated, sendSuccess } from "@/utils/apiResponse";
import { productService } from "@/services/product.service";
import { ProductListFilters } from "@/repositories/product.repository";

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ProductListFilters;
  const { items, total } = await productService.list(filters);
  sendSuccess(res, items, 200, {
    page: filters.page,
    limit: filters.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / filters.limit)),
  });
});

export const listAdminProducts = asyncHandler(async (req: Request, res: Response) => {
  const filters = { ...(req.query as unknown as ProductListFilters), statusFilter: "all" as const };
  const { items, total } = await productService.list(filters);
  sendSuccess(res, items, 200, {
    page: filters.page,
    limit: filters.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / filters.limit)),
  });
});

export const getProductBySlug = asyncHandler(async (req: Request, res: Response) => {
  const result = await productService.getBySlug(req.params.slug);
  sendSuccess(res, result);
});

export const getAdminProductById = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.getByIdAdmin(req.params.id);
  sendSuccess(res, product);
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.create(req.body);
  sendCreated(res, product);
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.update(req.params.id, req.body);
  sendSuccess(res, product);
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  await productService.remove(req.params.id);
  sendSuccess(res, { deleted: true });
});

export const updateProductInventory = asyncHandler(async (req: Request, res: Response) => {
  const { sku, inventoryQty } = req.body;
  const product = await productService.updateInventory(req.params.id, sku, inventoryQty);
  sendSuccess(res, product);
});
