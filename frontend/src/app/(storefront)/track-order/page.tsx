"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function OrderLookupPage() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/orders/${orderNumber.trim().toUpperCase()}?email=${encodeURIComponent(email.trim())}`);
  }

  return (
    <div className="container-lyla flex flex-col items-center py-16 sm:py-20">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-heading text-3xl font-medium">Tra cứu đơn hàng</h1>
        <p className="mt-2 text-sm text-muted-foreground">Nhập mã đơn hàng và email đã dùng khi đặt hàng để xem chi tiết.</p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4 text-left">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="orderNumber">Mã đơn hàng</Label>
            <Input id="orderNumber" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="VD: LG20260816-AB12CD" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@email.com" required />
          </div>
          <Button type="submit" className="mt-2 rounded-full">
            Tra cứu
          </Button>
        </form>
      </div>
    </div>
  );
}
