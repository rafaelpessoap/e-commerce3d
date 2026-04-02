export interface CartItem {
  productId: string;
  variationId?: string;
  quantity: number;
  price: number;
  name: string;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
}
