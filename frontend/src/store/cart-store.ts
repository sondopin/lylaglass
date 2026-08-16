import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  productId: string;
  sku: string;
  slug: string;
  name: string;
  image: string;
  variantName: string;
  price: number;
  compareAtPrice?: number;
  quantity: number;
  maxQuantity: number;
}

interface CartState {
  items: CartItem[];
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (sku: string) => void;
  setQuantity: (sku: string, quantity: number) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isDrawerOpen: false,
      openDrawer: () => set({ isDrawerOpen: true }),
      closeDrawer: () => set({ isDrawerOpen: false }),

      addItem: (item, quantity = 1) => {
        const items = get().items;
        const existing = items.find((i) => i.sku === item.sku);
        if (existing) {
          const nextQty = Math.min(existing.quantity + quantity, existing.maxQuantity);
          set({ items: items.map((i) => (i.sku === item.sku ? { ...i, quantity: nextQty } : i)) });
        } else {
          set({ items: [...items, { ...item, quantity: Math.min(quantity, item.maxQuantity) }] });
        }
        set({ isDrawerOpen: true });
      },

      removeItem: (sku) => set({ items: get().items.filter((i) => i.sku !== sku) }),

      setQuantity: (sku, quantity) =>
        set({
          items: get()
            .items.map((i) => (i.sku === sku ? { ...i, quantity: Math.max(1, Math.min(quantity, i.maxQuantity)) } : i))
            .filter((i) => i.quantity > 0),
        }),

      clear: () => set({ items: [] }),
    }),
    { name: "lylaglass-cart" }
  )
);

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
