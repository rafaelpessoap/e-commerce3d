'use client';

import { useCallback } from 'react';
import { useCartStore } from '@/store/cart-store';
import { api } from '@/lib/api-client';

export function useCart() {
  const { items, subtotal, itemCount, setCart, clear } = useCartStore();

  const fetchCart = useCallback(async () => {
    try {
      const { data } = await api.get('/cart');
      setCart(data.data.items, data.data.subtotal);
    } catch {}
  }, [setCart]);

  const addItem = useCallback(
    async (productId: string, quantity = 1, variationId?: string) => {
      const { data } = await api.post('/cart/items', {
        productId,
        quantity,
        variationId,
      });
      setCart(data.data.items, data.data.subtotal);
    },
    [setCart],
  );

  const removeItem = useCallback(
    async (productId: string) => {
      const { data } = await api.delete(`/cart/items/${productId}`);
      setCart(data.data.items, data.data.subtotal);
    },
    [setCart],
  );

  const updateQuantity = useCallback(
    async (productId: string, quantity: number) => {
      const { data } = await api.put(`/cart/items/${productId}`, { quantity });
      setCart(data.data.items, data.data.subtotal);
    },
    [setCart],
  );

  const clearCart = useCallback(async () => {
    await api.delete('/cart');
    clear();
  }, [clear]);

  return { items, subtotal, itemCount, fetchCart, addItem, removeItem, updateQuantity, clearCart };
}
