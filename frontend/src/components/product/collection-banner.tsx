import Image from "next/image";

export function CollectionBanner({
  title,
  description,
  image,
  itemCount,
}: {
  title: string;
  description?: string;
  image?: string;
  itemCount?: number;
}) {
  return (
    <section className="bg-rose-deep/10">
      <div className="container-lyla grid grid-cols-1 items-center gap-8 py-12 sm:py-16 lg:grid-cols-2">
        <div>
          <h1 className="font-heading text-3xl font-medium sm:text-4xl">{title}</h1>
          {description && <p className="mt-3 max-w-lg text-sm text-foreground/80">{description}</p>}
          {typeof itemCount === "number" && <p className="mt-2 text-xs text-muted-foreground">{itemCount} sản phẩm</p>}
        </div>
        {image && (
          <div className="relative hidden aspect-16/9 overflow-hidden rounded-2xl lg:block">
            <Image src={image} alt={title} fill sizes="600px" className="object-cover" />
          </div>
        )}
      </div>
    </section>
  );
}
