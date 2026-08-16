"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NewsletterSignup() {
  const [email, setEmail] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      toast.error("Vui lòng nhập email hợp lệ");
      return;
    }
    toast.success("Cảm ơn bạn đã đăng ký nhận tin từ LylaGlass!");
    setEmail("");
  }

  return (
    <section className="bg-mint">
      <div className="container-lyla flex flex-col items-center gap-4 py-16 text-center sm:py-20">
        <h2 className="font-heading text-3xl font-medium sm:text-4xl">Gia nhập cộng đồng LylaGlass</h2>
        <p className="max-w-md text-xs font-medium tracking-widest text-foreground/70 uppercase">
          Nhận tin khuyến mãi, sản phẩm mới và ưu đãi dành riêng cho bạn
        </p>
        <form onSubmit={handleSubmit} className="mt-2 flex w-full max-w-md gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email của bạn"
            className="h-11 bg-background"
          />
          <Button type="submit" className="h-11 shrink-0 rounded-full px-6">
            Đăng ký
          </Button>
        </form>
      </div>
    </section>
  );
}
