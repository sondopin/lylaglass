export interface ApiSuccess<T> {
  success: true;
  data: T;
  pagination?: { page: number; limit: number; total: number; totalPages: number };
}

export interface ApiFailure {
  success: false;
  error: { message: string; details?: unknown };
}

export interface ProductImage {
  url: string;
  alt?: string;
  position?: number;
  /** Cloudinary asset id — only set for images uploaded through the admin. */
  publicId?: string;
}

export interface ProductVariant {
  sku: string;
  name: string;
  attributes?: Record<string, string>;
  price: number;
  compareAtPrice?: number;
  inventoryQty: number;
  imageUrl?: string;
  weight?: number;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  sortOrder?: number;
  isActive?: boolean;
  seoTitle?: string;
  seoDescription?: string;
}

export interface Product {
  _id: string;
  name: string;
  slug: string;
  shortDescription?: string;
  description?: string;
  categoryId: string | Category;
  vendor?: string;
  images: ProductImage[];
  variants: ProductVariant[];
  optionName?: string;
  tags: string[];
  material?: string;
  capacity?: string;
  features: string[];
  careInstructions: string[];
  shippingReturnNote?: string;
  status: "draft" | "active" | "archived";
  isFeatured?: boolean;
  isBestseller?: boolean;
  isNewArrival?: boolean;
  ratingAverage: number;
  reviewCount: number;
  seoTitle?: string;
  seoDescription?: string;
  minPrice?: number;
  maxCompareAtPrice?: number;
  totalInventory?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  ward?: string;
  district?: string;
  province: string;
  country?: string;
  postalCode?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  slug: string;
  image?: string;
  sku: string;
  variantName: string;
  variantAttributes?: Record<string, string>;
  quantity: number;
  unitPrice: number;
  compareAtPrice?: number;
  lineTotal: number;
}

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type OrderStatus = "pending" | "confirmed" | "processing" | "completed" | "cancelled";
export type ShippingStatus = "unfulfilled" | "processing" | "shipped" | "delivered" | "returned";

/** Bank transfer is the only payment method on the storefront. */
export type PaymentMethod = "bank_transfer";

/** Lifecycle of the payment record itself, as reported by the backend. */
export type PaymentRecordStatus =
  | "requires_action"
  | "processing"
  | "succeeded"
  | "failed"
  | "expired"
  | "refunded";

/**
 * Everything the storefront needs to display a VietQR transfer. Produced
 * entirely server-side — the client never computes an amount, payment code or
 * account number, and never decides that a payment succeeded.
 */
export interface PaymentView {
  id: string;
  provider: string;
  method: PaymentMethod;
  status: PaymentRecordStatus;
  amount: number;
  currency: string;
  paymentCode: string;
  bank: {
    code: string;
    name: string;
    accountNumber: string;
    accountName: string;
  };
  qrPayload: string;
  /** PNG data URI, only populated when the QR was requested. */
  qrCodeDataUrl: string;
  expiresAt: string;
  paidAt: string | null;
  createdAt: string;
}

export interface PaymentStatusResult {
  order: {
    orderNumber: string;
    email: string;
    total: number;
    currency: string;
    paymentStatus: PaymentStatus;
    orderStatus: OrderStatus;
    createdAt: string;
  };
  payment: PaymentView;
}

/** Admin-only view of the payment behind an order, used for reconciliation. */
export interface AdminPayment extends PaymentView {
  transactionId?: string;
  referenceCode?: string;
  transactionDate?: string;
  transferredAmount?: number;
  needsManualReview?: boolean;
  manualReviewReason?: string;
  failureReason?: string;
  confirmationEmailStatus?: "pending" | "sending" | "sent" | "failed";
  confirmationEmailSentAt?: string;
  confirmationEmailError?: string;
  /** "New paid order" alert to the shop; "skipped" = no recipient configured. */
  ownerNotificationStatus?: "pending" | "sending" | "sent" | "failed" | "skipped";
  ownerNotificationSentAt?: string;
  ownerNotificationError?: string;
  bankBin?: string;
  bankCode?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
}

/** One incoming transfer the bank notification provider told us about. */
export interface BankTransaction {
  _id: string;
  provider: string;
  providerTransactionId: string;
  gateway: string;
  accountNumber: string;
  transferType: "in" | "out";
  transferAmount: number;
  code: string;
  content: string;
  referenceCode: string;
  transactionDate?: string;
  matchStatus: "matched" | "unmatched" | "rejected" | "ignored";
  matchNote?: string;
  createdAt: string;
}

export interface Order {
  _id: string;
  orderNumber: string;
  customer: { customerId?: string; name: string; email: string; phone: string };
  shippingAddress: Address;
  billingAddress?: Address;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  discountTotal: number;
  couponCode?: string;
  total: number;
  currency: string;
  customerNote?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  shippingStatus: ShippingStatus;
  shippingCarrier?: string;
  trackingNumber?: string;
  createdAt: string;
  updatedAt: string;
}

/** An order plus its payment record — what the admin order detail endpoint returns. */
export interface OrderWithPayment extends Order {
  payment: AdminPayment | null;
}

export interface Review {
  _id: string;
  productId: string;
  rating: number;
  authorName: string;
  title?: string;
  body: string;
  isVerifiedPurchase?: boolean;
  createdAt: string;
}

export interface Coupon {
  _id: string;
  code: string;
  type: "percentage" | "fixed" | "free_shipping";
  value: number;
  minimumSubtotal?: number;
  maxDiscountAmount?: number;
  usageLimit?: number;
  usageCount: number;
  startsAt?: string;
  endsAt?: string;
  isActive: boolean;
}

export interface Customer {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  ordersCount: number;
  totalSpent: number;
  createdAt: string;
}

export interface Settings {
  freeShippingThreshold: number;
  flatShippingFee: number;
  storeName: string;
  supportEmail: string;
  supportPhone: string;
}

export interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  totalProducts: number;
  lowStockCount: number;
  totalCustomers: number;
  recentOrders: Order[];
  revenueSeries: Array<{ _id: string; revenue: number; orders: number }>;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "owner" | "staff";
}
