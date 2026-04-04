export interface CartItem {
  productId: string;
  variationId?: string;
  variationName?: string;
  scaleId?: string;
  scaleName?: string;
  scalePercentage?: number;
  quantity: number;
  price: number;
  name: string;
  image?: string;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
}
