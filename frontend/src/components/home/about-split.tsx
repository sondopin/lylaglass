import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";
import { MARKETING_IMAGES } from "@/lib/marketing-images";

export function AboutSplit() {
  return (
    <section className="bg-mint">
      <Reveal className="container-lyla grid grid-cols-1 items-center gap-10 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16">
        <div className="order-2 flex flex-col items-start gap-4 lg:order-1">
          <h2 className="font-heading text-3xl font-medium sm:text-4xl">Về LylaGlass</h2>
          <p className="text-xs font-semibold tracking-[0.2em] text-foreground/70 uppercase">Từ năm 2023</p>
          <p className="max-w-md text-sm leading-relaxed text-foreground/85">
            LylaGlass bắt đầu từ tình yêu với những chiếc ly thủy tinh giản dị mà đẹp. Chúng tôi tuyển chọn từng
            thiết kế — từ ly quà tặng đóng hộp tinh tế, bộ sưu tập theo mùa lễ hội, đến những chiếc ly dùng mỗi ngày
            — với mong muốn mỗi lần bạn cầm ly lên đều là một khoảnh khắc nhỏ đáng nhớ.
          </p>
          <Button variant="outline" className="mt-2 rounded-full px-7" render={<Link href="/about" />}>
            Tìm hiểu thêm
          </Button>
        </div>
        <div className="order-1 flex justify-center lg:order-2">
          <div className="glass-rim-mask relative aspect-4/3 w-full max-w-md overflow-hidden ring-1 ring-foreground/15">
            <Image src={MARKETING_IMAGES.about} alt="Không gian trưng bày ly thủy tinh LylaGlass" fill sizes="480px" className="object-cover" />
          </div>
        </div>
      </Reveal>
    </section>
  );
}
