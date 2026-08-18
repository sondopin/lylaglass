import { settingsRepository } from "@/repositories/settings.repository";

export async function calculateShippingFee(subtotal: number, freeShippingOverride: boolean): Promise<number> {
  if (freeShippingOverride) return 0;
  // Read-only: checkout must not write to the shared settings singleton.
  const settings = await settingsRepository.read();
  if (subtotal >= settings.freeShippingThreshold) return 0;
  return settings.flatShippingFee;
}
