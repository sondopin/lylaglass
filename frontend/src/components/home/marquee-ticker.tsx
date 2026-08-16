const MESSAGE = "✨ GÓI QUÀ MIỄN PHÍ CHO MỌI ĐƠN HÀNG — GIAO TOÀN QUỐC 2-5 NGÀY ✨";

export function MarqueeTicker() {
  const items = Array.from({ length: 8 }, (_, i) => i);
  return (
    <div className="overflow-hidden border-y border-border/60 bg-mint-light py-2.5">
      <div className="animate-marquee flex w-max gap-10 text-sm font-medium text-foreground/80 whitespace-nowrap">
        {items.map((i) => (
          <span key={i}>{MESSAGE}</span>
        ))}
      </div>
    </div>
  );
}
