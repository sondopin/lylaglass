import { ApiError } from "@/utils/ApiError";
import { categoryRepository } from "@/repositories/category.repository";

export const categoryService = {
  listPublic: () => categoryRepository.findAllActive(),
  listAdmin: () => categoryRepository.findAllAdmin(),

  async getBySlug(slug: string) {
    const category = await categoryRepository.findBySlug(slug);
    if (!category) throw ApiError.notFound("Không tìm thấy danh mục");
    return category;
  },

  create: (data: Record<string, unknown>) => categoryRepository.create(data),

  async update(id: string, data: Record<string, unknown>) {
    const updated = await categoryRepository.updateById(id, data);
    if (!updated) throw ApiError.notFound("Không tìm thấy danh mục");
    return updated;
  },

  async remove(id: string) {
    const deleted = await categoryRepository.deleteById(id);
    if (!deleted) throw ApiError.notFound("Không tìm thấy danh mục");
    return deleted;
  },
};
