import Image from "next/image";
import Link from "next/link";
import { Category } from "@/lib/api/types";
import { Reveal, RevealStagger } from "@/components/reveal";

export function CategoryGrid({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null;

  return (
    <section className="container-lyla py-16 sm:py-20">
      <Reveal className="mx-auto mb-10 max-w-xl text-center">
        <h2 className="font-heading text-3xl font-medium sm:text-4xl">Mua sắm theo danh mục</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ba câu chuyện, một chất liệu — mỗi chiếc ly LylaGlass đều có một khoảnh khắc riêng để toả sáng.
        </p>
      </Reveal>

      <RevealStagger className="mx-auto grid max-w-4xl grid-cols-1 gap-10 sm:grid-cols-3">
        {categories.map((category) => (
          <Link key={category.slug} href={`/categories/${category.slug}`} className="group flex flex-col items-center gap-4 text-center">
            <div className="relative size-40 overflow-hidden rounded-full ring-1 ring-border sm:size-48">
              {category.image && (
                <Image
                  src={category.image}
                  alt={category.name}
                  fill
                  sizes="192px"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              )}
            </div>
            <div>
              <h3 className="font-heading text-lg font-medium">{category.name}</h3>
              <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">{category.description}</p>
            </div>
          </Link>
        ))}
      </RevealStagger>
    </section>
  );
}
