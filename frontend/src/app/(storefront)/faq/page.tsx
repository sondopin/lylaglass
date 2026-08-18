import type { Metadata } from "next";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const metadata: Metadata = {
  title: "Câu hỏi thường gặp",
  description: "Giải đáp các câu hỏi thường gặp về vận chuyển, đổi trả, thanh toán và đặt hàng tại LylaGlass.",
  alternates: { canonical: "/faq" },
};

const FAQ_GROUPS = [
  {
    heading: "Đặt hàng & Thanh toán",
    items: [
      { q: "Tôi có cần tạo tài khoản để đặt hàng không?", a: "Không. LylaGlass hỗ trợ đặt hàng dưới dạng khách — bạn chỉ cần cung cấp họ tên, email, số điện thoại và địa chỉ giao hàng." },
      { q: "LylaGlass hỗ trợ những hình thức thanh toán nào?", a: "Thanh toán khi nhận hàng (COD) và thanh toán online qua thẻ/ví điện tử." },
      { q: "Tôi có thể dùng mã giảm giá ở đâu?", a: "Mã giảm giá được nhập ở bước thanh toán, trong phần tóm tắt đơn hàng." },
    ],
  },
  {
    heading: "Vận chuyển & Giao nhận",
    items: [
      { q: "Phí vận chuyển được tính như thế nào?", a: "Miễn phí vận chuyển cho đơn hàng từ 490.000đ. Đơn dưới mức này áp dụng phí đồng giá 30.000đ." },
      { q: "Thời gian giao hàng dự kiến là bao lâu?", a: "Thông thường 2-5 ngày làm việc tuỳ khu vực." },
      { q: "Làm sao để theo dõi đơn hàng?", a: "Bạn có thể tra cứu đơn hàng bằng mã đơn và email tại trang Tra cứu đơn hàng." },
    ],
  },
  {
    heading: "Đổi trả & Bảo hành",
    items: [
      { q: "Chính sách đổi trả của LylaGlass là gì?", a: "Đổi trả miễn phí trong vòng 7 ngày nếu sản phẩm bị lỗi do vận chuyển hoặc sản xuất." },
      { q: "Sản phẩm khắc tên theo yêu cầu có được đổi trả không?", a: "Sản phẩm cá nhân hoá không áp dụng đổi trả, trừ trường hợp lỗi sản xuất." },
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="container-lyla max-w-2xl py-16">
      <h1 className="mb-10 text-center font-heading text-3xl font-medium">Câu hỏi thường gặp</h1>
      <div className="flex flex-col gap-10">
        {FAQ_GROUPS.map((group) => (
          <div key={group.heading}>
            <h2 className="mb-3 font-heading text-lg font-medium">{group.heading}</h2>
            <Accordion className="flex flex-col gap-1">
              {group.items.map((item, i) => (
                <AccordionItem key={i} value={`${group.heading}-${i}`}>
                  <AccordionTrigger>{item.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ))}
      </div>
    </div>
  );
}
