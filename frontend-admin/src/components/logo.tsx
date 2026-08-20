import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group flex items-baseline gap-0.5 font-heading", className)} aria-label="LylaGlass Admin — Trang tổng quan">
      <span className="text-2xl font-semibold tracking-tight text-foreground italic">Lyla</span>
      <span className="text-2xl font-semibold tracking-tight text-primary italic">Glass</span>
    </Link>
  );
}
