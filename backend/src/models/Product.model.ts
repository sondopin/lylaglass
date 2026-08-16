import { Schema, model, Types, InferSchemaType } from "mongoose";

const imageSchema = new Schema(
  {
    url: { type: String, required: true },
    alt: { type: String, default: "" },
    position: { type: Number, default: 0 },
  },
  { _id: false }
);

const variantSchema = new Schema(
  {
    sku: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true }, // e.g. "Dung tích 300ml"
    attributes: { type: Map, of: String, default: {} }, // e.g. { "Dung tích": "300ml", "Màu": "Trong suốt" }
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    inventoryQty: { type: Number, required: true, min: 0, default: 0 },
    imageUrl: { type: String, default: "" },
    weight: { type: Number, default: 0 },
  },
  { _id: false }
);

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    shortDescription: { type: String, default: "" },
    description: { type: String, default: "" },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    vendor: { type: String, default: "LylaGlass" },
    images: { type: [imageSchema], default: [] },
    variants: {
      type: [variantSchema],
      validate: {
        validator: (v: unknown[]) => Array.isArray(v) && v.length > 0,
        message: "Sản phẩm phải có ít nhất một biến thể (variant)",
      },
    },
    optionName: { type: String, default: "Loại" }, // label for the variant selector, e.g. "Dung tích"
    tags: { type: [String], default: [] },
    material: { type: String, default: "" },
    capacity: { type: String, default: "" },
    features: { type: [String], default: [] },
    careInstructions: { type: [String], default: [] },
    shippingReturnNote: { type: String, default: "" },
    status: { type: String, enum: ["draft", "active", "archived"], default: "active", index: true },
    isFeatured: { type: Boolean, default: false },
    isBestseller: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },
    ratingAverage: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    seoTitle: { type: String, default: "" },
    seoDescription: { type: String, default: "" },
  },
  { timestamps: true }
);

productSchema.index({ name: "text", shortDescription: "text", tags: "text" });
productSchema.index({ categoryId: 1, status: 1, createdAt: -1 });

productSchema.virtual("minPrice").get(function (this: { variants: { price: number }[] }) {
  if (!this.variants?.length) return 0;
  return Math.min(...this.variants.map((v) => v.price));
});

productSchema.virtual("maxCompareAtPrice").get(function (this: { variants: { compareAtPrice?: number }[] }) {
  const values = this.variants.map((v) => v.compareAtPrice).filter((v): v is number => typeof v === "number");
  return values.length ? Math.max(...values) : undefined;
});

productSchema.virtual("totalInventory").get(function (this: { variants: { inventoryQty: number }[] }) {
  return this.variants.reduce((sum, v) => sum + v.inventoryQty, 0);
});

productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

export type Product = InferSchemaType<typeof productSchema> & { _id: Types.ObjectId };
export type ProductVariant = InferSchemaType<typeof variantSchema>;
export const ProductModel = model("Product", productSchema);
