"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Review } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { reviewsApi } from "@/lib/api/reviews";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/utils";

const reviewSchema = z.object({
  authorName: z.string().min(1, "Vui lòng nhập tên của bạn"),
  rating: z.number().min(1).max(5),
  title: z.string().optional(),
  body: z.string().min(5, "Nội dung tối thiểu 5 ký tự"),
});
type ReviewValues = z.infer<typeof reviewSchema>;

function Stars({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5 text-amber-500">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("size-3.5", i <= Math.round(value) ? "fill-amber-500" : "fill-none text-muted-foreground")} />
      ))}
    </div>
  );
}

export function ReviewsSection({
  productId,
  reviews,
  summary,
}: {
  productId: string;
  reviews: Review[];
  summary: { average: number; count: number };
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const form = useForm<ReviewValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { authorName: "", rating: 5, title: "", body: "" },
  });

  async function onSubmit(values: ReviewValues) {
    try {
      await reviewsApi.create(productId, values);
      toast.success("Cảm ơn bạn đã đánh giá sản phẩm!");
      form.reset();
      setShowForm(false);
      router.refresh();
    } catch {
      toast.error("Không thể gửi đánh giá, vui lòng thử lại.");
    }
  }

  return (
    <section className="mt-16 border-t border-border pt-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-medium">Đánh giá từ khách hàng</h2>
          {summary.count > 0 ? (
            <div className="mt-1 flex items-center gap-2">
              <Stars value={summary.average} />
              <span className="text-sm text-muted-foreground">
                {summary.average.toFixed(1)} trên 5 — {summary.count} đánh giá
              </span>
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Hãy là người đầu tiên đánh giá sản phẩm này</p>
          )}
        </div>
        <Button variant="outline" className="rounded-full" onClick={() => setShowForm((s) => !s)}>
          Viết đánh giá
        </Button>
      </div>

      {showForm && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 flex max-w-md flex-col gap-4 rounded-2xl border border-border p-5">
            <FormField
              control={form.control}
              name="rating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Số sao</FormLabel>
                  <FormControl>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <button type="button" key={i} onClick={() => field.onChange(i)}>
                          <Star className={cn("size-6", i <= field.value ? "fill-amber-500 text-amber-500" : "text-muted-foreground")} />
                        </button>
                      ))}
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="authorName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên của bạn</FormLabel>
                  <FormControl>
                    <Input placeholder="Nguyễn Văn A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nhận xét</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Cảm nhận của bạn về sản phẩm..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="rounded-full" disabled={form.formState.isSubmitting}>
              Gửi đánh giá
            </Button>
          </form>
        </Form>
      )}

      <ul className="mt-8 flex flex-col gap-6">
        {reviews.map((r) => (
          <li key={r._id} className="border-b border-border pb-6 last:border-none">
            <div className="flex items-center justify-between">
              <Stars value={r.rating} />
              <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
            </div>
            {r.title && <p className="mt-2 text-sm font-medium">{r.title}</p>}
            <p className="mt-1 text-sm text-foreground/85">{r.body}</p>
            <p className="mt-2 text-xs font-medium text-muted-foreground">{r.authorName}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
