import { FilterQuery, SortOrder, Types } from "mongoose";
import { ProductModel, Product } from "@/models/Product.model";

export interface ProductListFilters {
  page: number;
  limit: number;
  category?: string; // category slug
  categoryId?: string;
  q?: string;
  sort: "featured" | "newest" | "price_asc" | "price_desc" | "name_asc" | "name_desc" | "bestselling";
  minPrice?: number;
  maxPrice?: number;
  tag?: string;
  inStockOnly?: boolean;
  statusFilter?: "active" | "all";
}

const SORT_MAP: Record<ProductListFilters["sort"], Record<string, SortOrder>> = {
  featured: { isFeatured: -1, createdAt: -1 },
  newest: { createdAt: -1 },
  price_asc: { "variants.0.price": 1 },
  price_desc: { "variants.0.price": -1 },
  name_asc: { name: 1 },
  name_desc: { name: -1 },
  bestselling: { isBestseller: -1, reviewCount: -1 },
};

export const productRepository = {
  async list(filters: ProductListFilters, categoryIdBySlug?: Types.ObjectId | null) {
    const query: FilterQuery<Product> = {};
    query.status = filters.statusFilter === "all" ? { $exists: true } : "active";

    if (filters.categoryId) query.categoryId = filters.categoryId;
    else if (filters.category && categoryIdBySlug) query.categoryId = categoryIdBySlug;

    if (filters.q) query.$text = { $search: filters.q };
    if (filters.tag) query.tags = filters.tag;

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      query.variants = {
        $elemMatch: {
          price: {
            ...(filters.minPrice !== undefined ? { $gte: filters.minPrice } : {}),
            ...(filters.maxPrice !== undefined ? { $lte: filters.maxPrice } : {}),
          },
        },
      };
    }

    if (filters.inStockOnly) {
      query["variants.inventoryQty"] = { $gt: 0 };
    }

    const skip = (filters.page - 1) * filters.limit;
    const sort = SORT_MAP[filters.sort];

    const [items, total] = await Promise.all([
      ProductModel.find(query).sort(sort).skip(skip).limit(filters.limit).populate("categoryId", "name slug").lean(),
      ProductModel.countDocuments(query),
    ]);

    return { items, total };
  },

  findBySlug: (slug: string) => ProductModel.findOne({ slug, status: "active" }).populate("categoryId", "name slug").lean(),
  findBySlugAdmin: (slug: string) => ProductModel.findOne({ slug }).lean(),
  findById: (id: string) => ProductModel.findById(id).lean(),
  findByIdAdmin: (id: string) => ProductModel.findById(id).lean(),

  findRelated: (categoryId: Types.ObjectId, excludeId: Types.ObjectId, limit = 4) =>
    ProductModel.find({ categoryId, _id: { $ne: excludeId }, status: "active" }).limit(limit).lean(),

  create: (data: Record<string, unknown>) => ProductModel.create(data),
  updateById: (id: string, data: Record<string, unknown>) =>
    ProductModel.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean(),
  deleteById: (id: string) => ProductModel.findByIdAndDelete(id).lean(),

  /**
   * Atomically decrements a variant's inventory only if enough stock is
   * available. MongoDB applies the filter + update as one atomic document
   * operation, so concurrent checkouts for the same SKU can never both
   * succeed past the available quantity (no negative stock, no lost updates).
   */
  async decrementVariantStock(productId: Types.ObjectId | string, sku: string, quantity: number) {
    const result = await ProductModel.findOneAndUpdate(
      { _id: productId, variants: { $elemMatch: { sku, inventoryQty: { $gte: quantity } } } },
      { $inc: { "variants.$[v].inventoryQty": -quantity } },
      { arrayFilters: [{ "v.sku": sku }], new: true }
    ).lean();
    return result; // null means insufficient stock / not found -> caller must treat as failure
  },

  async restockVariant(productId: Types.ObjectId | string, sku: string, quantity: number) {
    return ProductModel.findOneAndUpdate(
      { _id: productId, "variants.sku": sku },
      { $inc: { "variants.$[v].inventoryQty": quantity } },
      { arrayFilters: [{ "v.sku": sku }], new: true }
    ).lean();
  },

  countAll: () => ProductModel.countDocuments(),
  countLowStock: (threshold: number) =>
    ProductModel.countDocuments({ variants: { $elemMatch: { inventoryQty: { $lte: threshold, $gt: 0 } } } }),
};
