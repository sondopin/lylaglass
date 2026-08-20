import { z } from "zod";

export const variantInputSchema = z.object({
  sku: z.string().min(1, "SKU là bắt buộc"),
  name: z.string().min(1, "Tên biến thể là bắt buộc"),
  attributes: z.record(z.string(), z.string()).optional(),
  price: z.number().min(0),
  compareAtPrice: z.number().min(0).optional(),
  inventoryQty: z.number().int().min(0),
  imageUrl: z.string().url().optional().or(z.literal("")),
  weight: z.number().min(0).optional(),
});

export const imageInputSchema = z.object({
  url: z.string().url(),
  alt: z.string().optional(),
  position: z.number().int().optional(),
  /** Set by the upload endpoint; absent when an external URL was pasted in. */
  publicId: z.string().optional(),
});

export const createProductSchema = z.object({
  name: z.string().min(1, "Tên sản phẩm là bắt buộc").max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug chỉ gồm chữ thường, số và dấu gạch ngang"),
  shortDescription: z.string().max(500).optional(),
  description: z.string().max(20000).optional(),
  categoryId: z.string().min(1, "Danh mục là bắt buộc"),
  vendor: z.string().max(120).optional(),
  images: z.array(imageInputSchema).default([]),
  variants: z.array(variantInputSchema).min(1, "Cần ít nhất một biến thể"),
  optionName: z.string().max(60).optional(),
  tags: z.array(z.string()).default([]),
  material: z.string().max(200).optional(),
  capacity: z.string().max(120).optional(),
  features: z.array(z.string()).default([]),
  careInstructions: z.array(z.string()).default([]),
  shippingReturnNote: z.string().max(2000).optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  isFeatured: z.boolean().optional(),
  isBestseller: z.boolean().optional(),
  isNewArrival: z.boolean().optional(),
  seoTitle: z.string().max(160).optional(),
  seoDescription: z.string().max(300).optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  category: z.string().optional(),
  q: z.string().optional(),
  sort: z
    .enum(["featured", "newest", "price_asc", "price_desc", "name_asc", "name_desc", "bestselling"])
    .default("featured"),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  tag: z.string().optional(),
  inStockOnly: z.coerce.boolean().optional(),
});

export const updateInventorySchema = z.object({
  sku: z.string().min(1),
  inventoryQty: z.number().int().min(0),
});
