"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const contactSchema = z.object({
  name: z.string().min(1, "Vui lòng nhập họ tên"),
  email: z.string().email("Email không hợp lệ"),
  phone: z.string().optional(),
  message: z.string().min(5, "Vui lòng nhập nội dung (tối thiểu 5 ký tự)"),
});

type ContactValues = z.infer<typeof contactSchema>;

export function ContactFormSection() {
  const form = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", phone: "", message: "" },
  });

  function onSubmit() {
    toast.success("Đã gửi tin nhắn! LylaGlass sẽ phản hồi trong vòng 12 giờ.");
    form.reset();
  }

  return (
    <section className="container-lyla py-16 sm:py-20">
      <div className="mx-auto max-w-lg text-center">
        <h2 className="font-heading text-3xl font-medium sm:text-4xl">Liên hệ với chúng tôi</h2>
        <p className="mt-2 text-sm text-muted-foreground">Có câu hỏi? Điền vào biểu mẫu bên dưới nhé.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mx-auto mt-8 flex max-w-md flex-col gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Họ tên</FormLabel>
                <FormControl>
                  <Input placeholder="Nguyễn Văn A" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="ban@email.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Số điện thoại (không bắt buộc)</FormLabel>
                <FormControl>
                  <Input placeholder="09xx xxx xxx" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nội dung</FormLabel>
                <FormControl>
                  <Textarea rows={4} placeholder="Bạn cần hỗ trợ điều gì?" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="mt-2 rounded-full" disabled={form.formState.isSubmitting}>
            Gửi tin nhắn
          </Button>
          <p className="text-center text-xs text-muted-foreground">Chúng tôi sẽ phản hồi trong vòng 12 giờ — cảm ơn bạn đã liên hệ!</p>
        </form>
      </Form>
    </section>
  );
}
