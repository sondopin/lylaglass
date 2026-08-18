"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import { Category } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ApiClientError } from "@/lib/api/client";

const categorySchema = z.object({
  name: z.string().min(1, "Bắt buộc"),
  slug: z
    .string()
    .min(1, "Bắt buộc")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Chỉ gồm chữ thường, số và dấu gạch ngang"),
  description: z.string().optional(),
  image: z.string().optional(),
});
type CategoryValues = z.infer<typeof categorySchema>;

export default function AdminCategoriesPage() {
  const token = useAdminAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => adminApi.categories.list(token!),
    enabled: !!token,
  });

  const form = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", slug: "", description: "", image: "" },
  });

  function openCreate() {
    setEditing(null);
    form.reset({ name: "", slug: "", description: "", image: "" });
    setOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    form.reset({
      name: category.name,
      slug: category.slug,
      description: category.description ?? "",
      image: category.image ?? "",
    });
    setOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: (values: CategoryValues) =>
      editing ? adminApi.categories.update(token!, editing._id, values) : adminApi.categories.create(token!, values),
    onSuccess: () => {
      toast.success(editing ? "Đã cập nhật danh mục" : "Đã tạo danh mục");
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      setOpen(false);
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : "Có lỗi xảy ra"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.categories.remove(token!, id),
    onSuccess: () => {
      toast.success("Đã xoá danh mục");
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : "Có lỗi xảy ra"),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-medium">Danh mục</h1>
        <Button className="rounded-full" onClick={openCreate}>
          <Plus className="size-4" /> Thêm danh mục
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Tên</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Mô tả</th>
              <th className="px-4 py-3 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {categories.map((c) => (
              <tr key={c._id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.slug}</td>
                <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">{c.description}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(c)} aria-label="Sửa">
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        if (confirm(`Xoá danh mục "${c.name}"?`)) deleteMutation.mutate(c._id);
                      }}
                      aria-label="Xoá"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && categories.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  Chưa có danh mục nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa danh mục" : "Thêm danh mục"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tên danh mục</FormLabel>
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
                name="image"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL ảnh</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mô tả</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <Button type="submit" className="rounded-full" disabled={saveMutation.isPending}>
                {editing ? "Lưu thay đổi" : "Tạo danh mục"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
