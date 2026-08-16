import { CategoryModel } from "@/models/Category.model";

export const categoryRepository = {
  findAllActive: () => CategoryModel.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean(),
  findAllAdmin: () => CategoryModel.find().sort({ sortOrder: 1, name: 1 }).lean(),
  findBySlug: (slug: string) => CategoryModel.findOne({ slug }).lean(),
  findById: (id: string) => CategoryModel.findById(id).lean(),
  create: (data: Record<string, unknown>) => CategoryModel.create(data),
  updateById: (id: string, data: Record<string, unknown>) =>
    CategoryModel.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean(),
  deleteById: (id: string) => CategoryModel.findByIdAndDelete(id).lean(),
};
