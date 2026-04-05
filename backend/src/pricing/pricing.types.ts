export interface PricingInput {
  userId: string;
  items: Array<{
    productId: string;
    variationId?: string;
    scaleId?: string; // ScaleRuleItem.id
    quantity: number;
  }>;
  couponCode?: string;
  shippingAmount: number;
  shippingZipCode?: string;
  paymentMethod?: string;
}

export interface VerifiedItem {
  productId: string;
  variationId?: string;
  scaleId?: string;
  quantity: number;
  basePrice: number; // do banco (variação ou produto)
  scalePercentage: number; // 0 se sem escala
  unitPrice: number; // basePrice × (1 + scalePercentage/100)
  lineTotal: number; // unitPrice × quantity
}

export interface CouponResult {
  discount: number;
  couponId?: string;
  couponType?: string;
  isFreeShipping: boolean;
}

export interface PricingResult {
  items: VerifiedItem[];
  subtotal: number;
  couponDiscount: number;
  couponId?: string;
  isFreeShipping: boolean;
  shipping: number;
  paymentDiscount: number;
  total: number; // subtotal - couponDiscount + shipping
}
