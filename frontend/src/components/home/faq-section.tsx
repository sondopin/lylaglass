import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Reveal } from "@/components/reveal";

const FAQS = [
  { q: "Phí vận chuyển được tính như thế nào?", a: "Miễn phí vận chuyển cho đơn hàng từ 490.000đ. Đơn dưới mức này áp dụng phí vận chuyển đồng giá 30.000đ toàn quốc." },
  { q: "Thời gian giao hàng dự kiến là bao lâu?", a: "Đơn hàng thường được giao trong 2-5 ngày làm việc tuỳ khu vực. Sản phẩm khắc tên theo yêu cầu cần thêm 2-3 ngày gia công." },
  { q: "Tôi có cần tạo tài khoản để đặt hàng không?", a: "Không. Bạn có thể đặt hàng với vai trò khách — chỉ cần họ tên, email, số điện thoại và địa chỉ giao hàng." },
  { q: "Làm sao để liên hệ chăm sóc khách hàng?", a: "Bạn có thể nhắn qua trang Liên hệ hoặc gọi hotline, đội ngũ LylaGlass sẽ phản hồi trong vòng 12 giờ." },
];

export function FaqSection() {
  return (
    <section className="bg-rose-deep/10">
      <Reveal className="container-lyla py-16 sm:py-20">
        <h2 className="mx-auto mb-10 max-w-xl text-center font-heading text-3xl font-medium italic sm:text-4xl">
          Câu hỏi thường gặp
        </h2>
        <Accordion className="mx-auto flex max-w-2xl flex-col gap-3">
          {FAQS.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="rounded-2xl border-none bg-card px-5 shadow-sm">
              <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">{item.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Reveal>
    </section>
  );
}
