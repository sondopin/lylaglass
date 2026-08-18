import Link from "next/link";
import { Logo } from "./logo";
import { Category, Settings } from "@/lib/api/types";

export function Footer({ categories, settings }: { categories: Category[]; settings: Settings }) {
  return (
    <footer className="mt-24 bg-cream-alt">
      <div className="container-lyla grid grid-cols-2 gap-10 py-14 sm:grid-cols-2 lg:grid-cols-5">
        <div className="col-span-2 flex flex-col gap-3 lg:col-span-2">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">
            LylaGlass tuyển chọn những chiếc ly thủy tinh đẹp và bền, mang niềm vui nhỏ vào từng khoảnh khắc — từ quà
            tặng, mùa lễ hội đến những ngày thường.
          </p>
          <div className="flex gap-4 pt-1 text-xs font-medium text-muted-foreground">
            <a
              href="https://www.facebook.com/lylaglass.lythuytinh"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground hover:underline"
            >
              Facebook
            </a>
            <a
              href="https://www.instagram.com/lylaglass_lythuytinh/"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground hover:underline"
            >
              Instagram
            </a>
            <a
              href="https://www.tiktok.com/@lylaglass"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground hover:underline"
            >
              TikTok
            </a>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-semibold tracking-widest text-foreground/70 uppercase">Danh mục</h3>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/categories/${c.slug}`} className="hover:text-foreground">
                  {c.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/products" className="hover:text-foreground">
                Tất cả sản phẩm
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-semibold tracking-widest text-foreground/70 uppercase">Về LylaGlass</h3>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            <li>
              <Link href="/about" className="hover:text-foreground">
                Câu chuyện thương hiệu
              </Link>
            </li>
            <li>
              <Link href="/faq" className="hover:text-foreground">
                Câu hỏi thường gặp
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-foreground">
                Liên hệ
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-semibold tracking-widest text-foreground/70 uppercase">Hỗ trợ khách hàng</h3>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            <li>
              <Link href="/track-order" className="hover:text-foreground">
                Tra cứu đơn hàng
              </Link>
            </li>
            <li className="pt-1">{settings.supportEmail}</li>
            <li>{settings.supportPhone}</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/70">
        <div className="container-lyla flex flex-col items-center justify-between gap-2 py-5 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} LylaGlass. Đã đăng ký bản quyền.</p>
          <p>Thanh toán an toàn · Đổi trả trong 7 ngày · Giao hàng toàn quốc</p>
        </div>
      </div>
    </footer>
  );
}
