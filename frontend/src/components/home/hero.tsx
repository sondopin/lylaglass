import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MARKETING_IMAGES } from "@/lib/marketing-images";

export function Hero() {
  return (
    <section className="relative flex h-[560px] items-center justify-center overflow-hidden sm:h-[620px]">
      <Image
        src={MARKETING_IMAGES.hero}
        alt="Ly thủy tinh LylaGlass trên bàn ăn ấm áp"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-black/10" />
      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center gap-4 px-6 text-center text-white">
        <p className="text-sm tracking-[0.2em] uppercase text-white/85">Chào mừng đến với LylaGlass</p>
        <h1 className="font-heading text-4xl leading-tight font-medium sm:text-5xl">
          Mang khoảnh khắc ấm áp vào từng chiếc ly
        </h1>
        <p className="text-sm text-white/90 sm:text-base">Quà Tặng · Theo Mùa · Tâm Trạng Mỗi Ngày</p>
        <Button size="lg" className="mt-2 rounded-full px-8" render={<Link href="/products" />}>
          Mua sắm ngay
        </Button>
      </div>
    </section>
  );
}
