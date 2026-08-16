import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(1, "Tên danh mục là bắt buộc").max(120),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug chỉ gồm chữ thường, số và dấu gạch ngang"),
  description: z.string().max(2000).optional(),
  image: z.string().url().optional().or(z.literal("")),
  sortOrder: z.number().int().optional(),
  seoTitle: z.string().max(160).optional(),
  seoDescription: z.string().max(300).optional(),
  isActive: z.boolean().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const categoryParamsSchema = z.object({ idOrSlug: z.string().min(1) });
