import { ApiError } from "@/utils/ApiError";
import { productRepository, ProductListFilters } from "@/repositories/product.repository";
import { categoryRepository } from "@/repositories/category.repository";

export const productService = {
  async list(filters: ProductListFilters) {
    let categoryId = null;
    if (filters.category) {
      const category = await categoryRepository.findBySlug(filters.category);
      if (!category) return { items: [], total: 0 };
      categoryId = category._id;
    }
    return productRepository.list(filters, categoryId);
  },

  async getBySlug(slug: string) {
    const product = await productRepository.findBySlug(slug);
    if (!product) throw ApiError.notFound("Không tìm thấy sản phẩm");
    const related = await productRepository.findRelated(product.categoryId._id ?? product.categoryId, product._id, 4);
    return { product, related };
  },

  async getByIdAdmin(id: string) {
    const product = await productRepository.findByIdAdmin(id);
    if (!product) throw ApiError.notFound("Không tìm thấy sản phẩm");
    return product;
  },

  create: (data: Record<string, unknown>) => productRepository.create(data),

  async update(id: string, data: Record<string, unknown>) {
    const updated = await productRepository.updateById(id, data);
    if (!updated) throw ApiError.notFound("Không tìm thấy sản phẩm");
    return updated;
  },

  async remove(id: string) {
    const deleted = await productRepository.deleteById(id);
    if (!deleted) throw ApiError.notFound("Không tìm thấy sản phẩm");
    return deleted;
  },

  async updateInventory(id: string, sku: string, inventoryQty: number) {
    const product = await productRepository.findByIdAdmin(id);
    if (!product) throw ApiError.notFound("Không tìm thấy sản phẩm");
    const variant = product.variants.find((v) => v.sku === sku);
    if (!variant) throw ApiError.notFound("Không tìm thấy biến thể sản phẩm");

    const updated = await productRepository.updateById(id, {
      variants: product.variants.map((v) => (v.sku === sku ? { ...v, inventoryQty } : v)),
    });
    return updated;
  },
};
