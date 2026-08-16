import { formatVnd } from "@/lib/format";

export function AnnouncementBar({ freeShippingThreshold }: { freeShippingThreshold: number }) {
  return (
    <div className="font-sans text-xs">
      <div className="bg-primary py-2 text-center text-primary-foreground">
        Miễn phí vận chuyển cho đơn hàng từ {formatVnd(freeShippingThreshold)}
      </div>
      <div className="bg-cream-alt py-2 text-center text-foreground">✨ Gói quà miễn phí cho mọi đơn hàng ✨</div>
    </div>
  );
}
