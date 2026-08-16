import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Product } from "@/lib/api/types";

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1 pl-4">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function DetailsAccordion({ product }: { product: Product }) {
  const sections = [
    {
      value: "details",
      label: "Chi tiết sản phẩm",
      content: product.description || product.shortDescription || "Đang cập nhật.",
    },
    product.material && { value: "material", label: "Chất liệu", content: product.material },
    product.capacity && { value: "capacity", label: "Dung tích", content: product.capacity },
    product.features.length > 0 && { value: "features", label: "Đặc điểm nổi bật", content: <BulletList items={product.features} /> },
    product.careInstructions.length > 0 && {
      value: "care",
      label: "Hướng dẫn bảo quản",
      content: <BulletList items={product.careInstructions} />,
    },
    {
      value: "shipping",
      label: "Vận chuyển & đổi trả",
      content:
        product.shippingReturnNote ||
        "Giao hàng toàn quốc trong 2-5 ngày làm việc. Đổi trả miễn phí trong 7 ngày nếu sản phẩm lỗi do vận chuyển hoặc sản xuất.",
    },
  ].filter(Boolean) as Array<{ value: string; label: string; content: React.ReactNode }>;

  return (
    <Accordion defaultValue={["details"]} className="flex flex-col gap-1">
      {sections.map((s) => (
        <AccordionItem key={s.value} value={s.value}>
          <AccordionTrigger className="text-base">{s.label}</AccordionTrigger>
          <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{s.content}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
