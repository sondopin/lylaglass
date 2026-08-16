import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 6);

export function generateOrderNumber(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `LG${datePart}-${nanoid()}`;
}
