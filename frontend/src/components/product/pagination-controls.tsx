import Link from "next/link";
import { cn } from "@/lib/utils";

function buildHref(basePath: string, params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params);
  if (page <= 1) next.delete("page");
  else next.set("page", String(page));
  const qs = next.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function PaginationControls({
  basePath,
  currentSearchParams,
  page,
  totalPages,
}: {
  basePath: string;
  currentSearchParams: Record<string, string | undefined>;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const params = new URLSearchParams(
    Object.entries(currentSearchParams).filter(([, v]) => v !== undefined) as [string, string][]
  );

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1
  );

  return (
    <nav className="mt-14 flex items-center justify-center gap-1.5" aria-label="Phân trang">
      <Link
        href={buildHref(basePath, params, Math.max(1, page - 1))}
        aria-disabled={page === 1}
        className={cn(
          "rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted",
          page === 1 && "pointer-events-none opacity-40"
        )}
      >
        Trước
      </Link>

      {pages.map((p, idx) => (
        <span key={p} className="flex items-center gap-1.5">
          {idx > 0 && pages[idx - 1] !== p - 1 && <span className="px-1 text-muted-foreground">…</span>}
          <Link
            href={buildHref(basePath, params, p)}
            className={cn(
              "flex size-8 items-center justify-center rounded-full text-sm hover:bg-muted",
              p === page && "bg-primary text-primary-foreground hover:bg-primary"
            )}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </Link>
        </span>
      ))}

      <Link
        href={buildHref(basePath, params, Math.min(totalPages, page + 1))}
        aria-disabled={page === totalPages}
        className={cn(
          "rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted",
          page === totalPages && "pointer-events-none opacity-40"
        )}
      >
        Sau
      </Link>
    </nav>
  );
}
