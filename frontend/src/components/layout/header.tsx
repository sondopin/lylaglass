"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  { href: "/products", label: "Tất cả sản phẩm" },
  { href: "/about", label: "Giới thiệu" },
  { href: "/contact", label: "Liên hệ" },
];

export function Header({ categories }: { categories: Category[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const openDrawer = useCartStore((s) => s.openDrawer);
  const count = cartCount(items);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    STATIC_LINKS[0],
    ...categories.map((c) => ({ href: `/categories/${c.slug}`, label: c.name })),
    STATIC_LINKS[1],
    ...STATIC_LINKS.slice(2),
  ];

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    setSearchOpen(false);
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur transition-shadow duration-300 supports-[backdrop-filter]:bg-background/80",
        scrolled && "shadow-sm"
      )}
    >
      <div
        className={cn(
          "container-lyla flex items-center justify-between gap-4 transition-[height,padding] duration-300 ease-out",
          scrolled ? "h-14 py-2" : "h-18 py-3"
        )}
      >
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

        <Logo className={cn("transition-transform duration-300", scrolled && "scale-90")} />

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
            <Button
              variant="ghost"
              size="icon"
              className="transition-transform duration-200 hover:scale-125"
              onClick={() => setSearchOpen(true)}
              aria-label="Tìm kiếm"
            >
              <Search className="size-5" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="transition-transform duration-200 hover:scale-125"
            aria-label="Tra cứu đơn hàng"
            render={<Link href="/track-order" />}
          >
            <PackageSearch className="size-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="relative transition-transform duration-200 hover:scale-125"
            onClick={openDrawer}
            aria-label="Giỏ hàng"
          >
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
