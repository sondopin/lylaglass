import { settingsRepository } from "@/repositories/settings.repository";

export async function calculateShippingFee(subtotal: number, freeShippingOverride: boolean): Promise<number> {
  if (freeShippingOverride) return 0;
  const settings = await settingsRepository.get();
  if (subtotal >= settings.freeShippingThreshold) return 0;
  return settings.flatShippingFee;
}
