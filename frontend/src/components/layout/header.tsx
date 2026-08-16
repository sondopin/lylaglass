"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Menu, PackageSearch, Search, ShoppingBag, X } from "lucide-react";
import { Logo } from "./logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useCartStore, cartCount } from "@/store/cart-store";
import { Category } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const STATIC_LINKS = [
  { href: "/", label: "Trang chủ" },
  { href: "/san-pham", label: "Tất cả sản phẩm" },
  { href: "/gioi-thieu", label: "Giới thiệu" },
  { href: "/lien-he", label: "Liên hệ" },
];

export function Header({ categories }: { categories: Category[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const openDrawer = useCartStore((s) => s.openDrawer);
  const count = cartCount(items);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const navLinks = [
    STATIC_LINKS[0],
    ...categories.map((c) => ({ href: `/danh-muc/${c.slug}`, label: c.name })),
    STATIC_LINKS[1],
    ...STATIC_LINKS.slice(2),
  ];

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/tim-kiem?q=${encodeURIComponent(query.trim())}`);
    setSearchOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container-lyla flex h-18 items-center justify-between gap-4 py-3">
        <div className="flex items-center gap-2 lg:hidden">
          <Sheet>
            <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Mở menu" />}>
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px]">
              <SheetHeader>
                <SheetTitle>
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted",
                      pathname === link.href && "bg-muted"
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>

        <Logo />

        <nav className="hidden items-center gap-7 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "font-sans text-sm text-foreground/85 decoration-primary decoration-2 underline-offset-4 transition hover:text-foreground hover:underline",
                pathname === link.href && "text-foreground underline"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          {searchOpen ? (
            <form onSubmit={submitSearch} className="flex items-center gap-1">
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm ly thủy tinh..."
                className="h-9 w-40 sm:w-56"
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => setSearchOpen(false)} aria-label="Đóng tìm kiếm">
                <X className="size-4" />
              </Button>
            </form>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => setSearchOpen(true)} aria-label="Tìm kiếm">
              <Search className="size-5" />
            </Button>
          )}

          <Button variant="ghost" size="icon" aria-label="Tra cứu đơn hàng" render={<Link href="/tra-cuu-don-hang" />}>
            <PackageSearch className="size-5" />
          </Button>

          <Button variant="ghost" size="icon" className="relative" onClick={openDrawer} aria-label="Giỏ hàng">
            <ShoppingBag className="size-5" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex size-4.5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {count}
              </span>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
