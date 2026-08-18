import type { Metadata } from "next";
import Image from "next/image";
import { MARKETING_IMAGES } from "@/lib/marketing-images";

export const metadata: Metadata = {
  title: "Giới thiệu",
  description: "Câu chuyện thương hiệu LylaGlass — ly thủy tinh tuyển chọn cho quà tặng, mùa lễ hội và những ngày thường.",
  alternates: { canonical: "/about" },
};

const VALUES = [
  { title: "Câu chuyện thương hiệu", body: "LylaGlass ra đời từ tình yêu với những chiếc ly thủy tinh giản dị mà đẹp, mong muốn mang lại niềm vui nhỏ trong từng khoảnh khắc thường nhật." },
  { title: "Khách hàng là trọng tâm", body: "Mỗi sản phẩm đều được chọn lọc kỹ lưỡng, đóng gói cẩn thận và đội ngũ luôn sẵn sàng hỗ trợ bạn trong suốt hành trình mua sắm." },
  { title: "Thiết kế tinh tế", body: "Từ quà tặng, bộ sưu tập theo mùa đến ly dùng mỗi ngày — mỗi thiết kế đều cân bằng giữa vẻ đẹp và sự tiện dụng." },
  { title: "Bền vững", body: "Chúng tôi ưu tiên chất liệu thủy tinh bền, an toàn và đóng gói thân thiện với môi trường." },
];

export default function AboutPage() {
  return (
    <div>
      <section className="relative flex h-[360px] items-center justify-center overflow-hidden">
        <Image src={MARKETING_IMAGES.hero} alt="Không gian LylaGlass" fill sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-black/45" />
        <h1 className="relative font-heading text-4xl font-medium text-white">Giới thiệu LylaGlass</h1>
      </section>

      <div className="container-lyla max-w-3xl py-16 text-center">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Từ năm 2023</p>
        <p className="mt-4 text-base leading-relaxed text-foreground/85">
          LylaGlass bắt đầu từ một câu hỏi đơn giản: điều gì khiến một chiếc ly trở nên đặc biệt? Không chỉ là vật dụng
          đựng nước, mỗi chiếc ly LylaGlass còn là một phần của khoảnh khắc — một tách trà sáng sớm, một ly rượu vang
          tối cuối tuần, hay một món quà gửi gắm yêu thương. Chúng tôi tuyển chọn từng thiết kế với tiêu chí: đẹp, bền
          và mang lại niềm vui khi sử dụng mỗi ngày.
        </p>
      </div>

      <div className="container-lyla grid grid-cols-1 gap-8 pb-20 sm:grid-cols-2 lg:grid-cols-4">
        {VALUES.map((v) => (
          <div key={v.title} className="rounded-2xl border border-border p-6">
            <h3 className="font-heading text-lg font-medium">{v.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{v.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
