"use client";

import { useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Image as ImageIcon, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import { Product } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ApiClientError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const variantSchema = z.object({
  sku: z.string().min(1, "Bắt buộc"),
  name: z.string().min(1, "Bắt buộc"),
  price: z.coerce.number().min(0),
  compareAtPrice: z.coerce.number().min(0).optional(),
  inventoryQty: z.coerce.number().min(0),
});

const imageSchema = z.object({
  url: z.string().url("URL không hợp lệ"),
  alt: z.string().optional(),
  /** Present only for images uploaded to Cloudinary through this form. */
  publicId: z.string().optional(),
});

/** Kept in step with the multer limit in `backend/src/middlewares/upload.ts`. */
const MAX_IMAGE_MB = 5;
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/**
 * Rejects what the server would reject anyway, but immediately and per-file.
 * Uploading a 40MB file only to be told "too large" after the whole transfer is
 * a poor trade when the size is knowable up front.
 */
function rejectionReason(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return `"${file.name}": chỉ chấp nhận JPEG, PNG, WEBP hoặc AVIF`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `"${file.name}": ${(file.size / 1024 / 1024).toFixed(1)}MB, vượt quá ${MAX_IMAGE_MB}MB`;
  }
  return null;
}

/** Preview of an image already attached to the product. */
function ImageThumb({ url, isPrimary }: { url: string; isPrimary: boolean }) {
  return (
    <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
      {url ? (
        // A plain <img>: the URL is whatever the admin pasted, and next/image
        // would fail the whole render on a host missing from remotePatterns.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center">
          <ImageIcon className="size-5 text-muted-foreground" />
        </div>
      )}
      {isPrimary && (
        <span className="absolute inset-x-0 bottom-0 bg-foreground/80 py-0.5 text-center text-[10px] font-medium text-background">
          Đại diện
        </span>
      )}
    </div>
  );
}

/** Click-to-browse and drag-and-drop target for uploading new images. */
function ImageDropzone({
  disabled,
  pendingCount,
  onFilesSelected,
}: {
  disabled: boolean;
  pendingCount: number;
  onFilesSelected: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (files.length > 0) onFilesSelected(files);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-8 text-center transition",
        isDragging && "border-foreground bg-muted/50",
        disabled && "opacity-60"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          // Reset so selecting the same file twice in a row still fires change.
          e.target.value = "";
        }}
      />

      {disabled ? (
        <>
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Đang tải {pendingCount} ảnh lên...</p>
        </>
      ) : (
        <>
          <Upload className="size-5 text-muted-foreground" />
          <p className="text-sm">
            Kéo thả ảnh vào đây, hoặc{" "}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="font-medium underline underline-offset-2"
            >
              chọn từ máy
            </button>
          </p>
          <p className="text-xs text-muted-foreground">Có thể chọn nhiều ảnh cùng lúc</p>
        </>
      )}
    </div>
  );
}

const productFormSchema = z.object({
  name: z.string().min(1, "Bắt buộc"),
  slug: z
    .string()
    .min(1, "Bắt buộc")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Chỉ gồm chữ thường, số và dấu gạch ngang"),
  categoryId: z.string().min(1, "Bắt buộc"),
  shortDescription: z.string().optional(),
  description: z.string().optional(),
  optionName: z.string().optional(),
  material: z.string().optional(),
  capacity: z.string().optional(),
  shippingReturnNote: z.string().optional(),
  tagsText: z.string().optional(),
  featuresText: z.string().optional(),
  careInstructionsText: z.string().optional(),
  status: z.enum(["draft", "active", "archived"]),
  isFeatured: z.boolean(),
  isBestseller: z.boolean(),
  isNewArrival: z.boolean(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  images: z.array(imageSchema),
  variants: z.array(variantSchema).min(1, "Cần ít nhất một biến thể"),
});
type ProductFormValues = z.infer<typeof productFormSchema>;

function toFormValues(product?: Product): ProductFormValues {
  if (!product) {
    return {
      name: "",
      slug: "",
      categoryId: "",
      shortDescription: "",
      description: "",
      optionName: "Loại",
      material: "",
      capacity: "",
      shippingReturnNote: "",
      tagsText: "",
      featuresText: "",
      careInstructionsText: "",
      status: "active",
      isFeatured: false,
      isBestseller: false,
      isNewArrival: false,
      seoTitle: "",
      seoDescription: "",
      images: [],
      variants: [{ sku: "", name: "", price: 0, compareAtPrice: undefined, inventoryQty: 0 }],
    };
  }
  return {
    name: product.name,
    slug: product.slug,
    categoryId: typeof product.categoryId === "string" ? product.categoryId : product.categoryId._id,
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
    optionName: product.optionName ?? "Loại",
    material: product.material ?? "",
    capacity: product.capacity ?? "",
    shippingReturnNote: product.shippingReturnNote ?? "",
    tagsText: product.tags.join(", "),
    featuresText: product.features.join("\n"),
    careInstructionsText: product.careInstructions.join("\n"),
    status: product.status,
    isFeatured: !!product.isFeatured,
    isBestseller: !!product.isBestseller,
    isNewArrival: !!product.isNewArrival,
    seoTitle: product.seoTitle ?? "",
    seoDescription: product.seoDescription ?? "",
    images: product.images.map((i) => ({ url: i.url, alt: i.alt ?? "", publicId: i.publicId ?? "" })),
    variants: product.variants.map((v) => ({
      sku: v.sku,
      name: v.name,
      price: v.price,
      compareAtPrice: v.compareAtPrice,
      inventoryQty: v.inventoryQty,
    })),
  };
}

export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: categories = [],
    isLoading: isLoadingCategories,
    isError: categoriesFailed,
    error: categoriesError,
    refetch: refetchCategories,
  } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => adminApi.categories.list(),
  });

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: toFormValues(product),
  });

  const variantFields = useFieldArray({ control: form.control, name: "variants" });
  const imageFields = useFieldArray({ control: form.control, name: "images" });

  const [pendingUploads, setPendingUploads] = useState(0);

  /**
   * Uploads the selected files to Cloudinary and appends each result to the
   * form's image list.
   *
   * Uploads are settled independently rather than with `Promise.all`, so one
   * bad file does not discard the images that uploaded fine alongside it — the
   * admin keeps what succeeded and is told exactly which files failed and why.
   */
  const uploadImages = useMutation({
    mutationFn: async (files: File[]) => {
      const rejected: string[] = [];
      const accepted: File[] = [];
      for (const file of files) {
        const reason = rejectionReason(file);
        if (reason) rejected.push(reason);
        else accepted.push(file);
      }

      setPendingUploads(accepted.length);
      try {
        const results = await Promise.allSettled(accepted.map((file) => adminApi.products.uploadImage(file)));

        const uploaded = results.flatMap((result, i) =>
          result.status === "fulfilled"
            ? [
                {
                  url: result.value.url,
                  publicId: result.value.publicId,
                  // Filename minus extension is a better starting alt text than
                  // an empty box, and the admin can refine it in place.
                  alt: accepted[i].name.replace(/\.[^.]+$/, ""),
                },
              ]
            : []
        );

        const failed = results.flatMap((result, i) =>
          result.status === "rejected"
            ? [`"${accepted[i].name}": ${result.reason instanceof Error ? result.reason.message : "tải lên thất bại"}`]
            : []
        );

        return { uploaded, problems: [...rejected, ...failed] };
      } finally {
        setPendingUploads(0);
      }
    },
    onSuccess: ({ uploaded, problems }) => {
      for (const image of uploaded) imageFields.append(image);
      if (uploaded.length > 0) toast.success(`Đã tải lên ${uploaded.length} ảnh`);
      for (const problem of problems) toast.error(problem);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Tải ảnh lên thất bại"),
  });

  const saveMutation = useMutation({
    mutationFn: (values: ProductFormValues) => {
      const payload = {
        name: values.name,
        slug: values.slug,
        categoryId: values.categoryId,
        shortDescription: values.shortDescription,
        description: values.description,
        optionName: values.optionName,
        material: values.material,
        capacity: values.capacity,
        shippingReturnNote: values.shippingReturnNote,
        status: values.status,
        isFeatured: values.isFeatured,
        isBestseller: values.isBestseller,
        isNewArrival: values.isNewArrival,
        seoTitle: values.seoTitle,
        seoDescription: values.seoDescription,
        images: values.images,
        variants: values.variants,
        tags: (values.tagsText ?? "").split(",").map((t) => t.trim()).filter(Boolean),
        features: (values.featuresText ?? "").split("\n").map((t) => t.trim()).filter(Boolean),
        careInstructions: (values.careInstructionsText ?? "").split("\n").map((t) => t.trim()).filter(Boolean),
      };
      return product ? adminApi.products.update(product._id, payload) : adminApi.products.create(payload);
    },
    onSuccess: () => {
      toast.success(product ? "Đã cập nhật sản phẩm" : "Đã tạo sản phẩm");
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      router.push("/products");
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : "Có lỗi xảy ra"),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="flex flex-col gap-8">
        <section className="grid grid-cols-1 gap-4 rounded-2xl border border-border p-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tên sản phẩm</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slug (URL)</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Danh mục</FormLabel>
                <FormControl>
                  <select
                    {...field}
                    disabled={isLoadingCategories || categoriesFailed}
                    className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring disabled:opacity-60"
                  >
                    {/*
                      The placeholder states why the list is empty instead of
                      silently offering nothing to choose — an empty dropdown
                      with no explanation is indistinguishable from a bug.
                    */}
                    <option value="">
                      {isLoadingCategories
                        ? "Đang tải danh mục..."
                        : categoriesFailed
                          ? "Không tải được danh mục"
                          : categories.length === 0
                            ? "Chưa có danh mục nào"
                            : "-- Chọn danh mục --"}
                    </option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </FormControl>

                {categoriesFailed && (
                  <p className="text-xs text-destructive">
                    {categoriesError instanceof ApiClientError
                      ? categoriesError.message
                      : "Không gọi được API. Kiểm tra backend đã chạy chưa."}{" "}
                    <button
                      type="button"
                      onClick={() => refetchCategories()}
                      className="underline underline-offset-2"
                    >
                      Thử lại
                    </button>
                  </p>
                )}

                {!isLoadingCategories && !categoriesFailed && categories.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Cần tạo danh mục trước khi thêm sản phẩm —{" "}
                    <Link href="/categories" className="underline underline-offset-2">
                      đi tới trang Danh mục
                    </Link>
                    .
                  </p>
                )}

                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Trạng thái</FormLabel>
                <FormControl>
                  <select {...field} className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring">
                    <option value="active">Đang bán</option>
                    <option value="draft">Bản nháp</option>
                    <option value="archived">Ngừng bán</option>
                  </select>
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="shortDescription"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Mô tả ngắn</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Mô tả chi tiết</FormLabel>
                <FormControl>
                  <Textarea rows={4} {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <div className="flex flex-wrap gap-4 sm:col-span-2">
            {(["isFeatured", "isBestseller", "isNewArrival"] as const).map((name) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                    {name === "isFeatured" ? "Nổi bật" : name === "isBestseller" ? "Bán chạy" : "Hàng mới"}
                  </label>
                )}
              />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border p-5">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-heading text-lg font-medium">Hình ảnh</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => imageFields.append({ url: "", alt: "", publicId: "" })}
            >
              <Plus className="size-4" /> Dán URL
            </Button>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Ảnh đầu tiên là ảnh đại diện hiển thị ở trang danh sách và giỏ hàng. JPEG, PNG, WEBP hoặc AVIF, tối đa{" "}
            {MAX_IMAGE_MB}MB mỗi ảnh.
          </p>

          <ImageDropzone
            disabled={uploadImages.isPending}
            pendingCount={pendingUploads}
            onFilesSelected={(files) => uploadImages.mutate(files)}
          />

          <div className="mt-4 flex flex-col gap-3">
            {imageFields.fields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-3 rounded-xl border border-border p-3">
                <ImageThumb url={form.watch(`images.${index}.url`)} isPrimary={index === 0} />

                <div className="flex flex-1 flex-col gap-2">
                  <FormField
                    control={form.control}
                    name={`images.${index}.url`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="https://..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`images.${index}.alt`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="Mô tả ảnh (alt text) — tốt cho SEO và trình đọc màn hình" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="Di chuyển lên"
                    disabled={index === 0}
                    onClick={() => imageFields.move(index, index - 1)}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="Di chuyển xuống"
                    disabled={index === imageFields.fields.length - 1}
                    onClick={() => imageFields.move(index, index + 1)}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="Xoá khỏi sản phẩm"
                    onClick={() => imageFields.remove(index)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
            {imageFields.fields.length === 0 && !uploadImages.isPending && (
              <p className="text-sm text-muted-foreground">Chưa có ảnh nào.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-lg font-medium">Biến thể</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => variantFields.append({ sku: "", name: "", price: 0, compareAtPrice: undefined, inventoryQty: 0 })}
            >
              <Plus className="size-4" /> Thêm biến thể
            </Button>
          </div>
          <FormField
            control={form.control}
            name="optionName"
            render={({ field }) => (
              <FormItem className="mb-4 max-w-xs">
                <FormLabel>Nhãn phân loại (VD: Dung tích)</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <div className="flex flex-col gap-4">
            {variantFields.fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-2 gap-2 rounded-xl border border-border p-3 sm:grid-cols-5">
                <FormField
                  control={form.control}
                  name={`variants.${index}.sku`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">SKU</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`variants.${index}.name`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Tên biến thể</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`variants.${index}.price`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Giá bán</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`variants.${index}.compareAtPrice`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Giá gốc (không bắt buộc)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} value={field.value ?? ""} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex items-end gap-2">
                  <FormField
                    control={form.control}
                    name={`variants.${index}.inventoryQty`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="text-xs">Tồn kho</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => variantFields.remove(index)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {form.formState.errors.variants?.message && (
            <p className="mt-2 text-xs font-medium text-destructive">{form.formState.errors.variants.message}</p>
          )}
        </section>

        <section className="grid grid-cols-1 gap-4 rounded-2xl border border-border p-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="material"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Chất liệu</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="capacity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dung tích</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tagsText"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Tags (phân tách bằng dấu phẩy)</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="featuresText"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Đặc điểm nổi bật (mỗi dòng một ý)</FormLabel>
                <FormControl>
                  <Textarea rows={4} {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="careInstructionsText"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hướng dẫn bảo quản (mỗi dòng một ý)</FormLabel>
                <FormControl>
                  <Textarea rows={4} {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="shippingReturnNote"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Ghi chú vận chuyển & đổi trả</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </section>

        <section className="grid grid-cols-1 gap-4 rounded-2xl border border-border p-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="seoTitle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SEO Title</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="seoDescription"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SEO Description</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </section>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => router.push("/products")}>
            Huỷ
          </Button>
          <Button type="submit" className="rounded-full" disabled={saveMutation.isPending}>
            {product ? "Lưu thay đổi" : "Tạo sản phẩm"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
