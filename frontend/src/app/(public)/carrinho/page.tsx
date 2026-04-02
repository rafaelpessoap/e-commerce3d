'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trash2, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from '@/components/shared/empty-state';
import { api } from '@/lib/api-client';
import { useCartStore } from '@/store/cart-store';
import { ROUTES, formatCurrency } from '@/lib/constants';
import type { Cart } from '@/types/cart';

export default function CartPage() {
  const { items, subtotal, setCart, clear } = useCartStore();
  const [couponCode, setCouponCode] = useState('');
  const [couponMsg, setCouponMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ data: Cart }>('/cart')
      .then(({ data }) => setCart(data.data.items, data.data.subtotal))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [setCart]);

  async function handleUpdateQuantity(productId: string, quantity: number) {
    try {
      const { data } = await api.put(`/cart/items/${productId}`, { quantity });
      setCart(data.data.items, data.data.subtotal);
    } catch {}
  }

  async function handleRemove(productId: string) {
    try {
      const { data } = await api.delete(`/cart/items/${productId}`);
      setCart(data.data.items, data.data.subtotal);
    } catch {}
  }

  async function handleClear() {
    try {
      await api.delete('/cart');
      clear();
    } catch {}
  }

  async function handleApplyCoupon(e: React.FormEvent) {
    e.preventDefault();
    setCouponMsg('');
    try {
      const { data } = await api.post('/coupons/validate', {
        code: couponCode,
        cartValue: subtotal,
      });
      setCouponMsg(`Cupom aplicado! Desconto: ${formatCurrency(data.data.discount)}`);
    } catch (err: any) {
      setCouponMsg(err.response?.data?.message ?? 'Cupom inválido');
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">
        Carregando carrinho...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          title="Carrinho vazio"
          description="Adicione produtos para continuar."
        />
        <div className="text-center mt-6">
          <Link href={ROUTES.products}>
            <Button>Ver Produtos</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Carrinho</h1>
        <Button variant="ghost" size="sm" onClick={handleClear}>
          Limpar
        </Button>
      </div>

      {/* Items */}
      <div className="space-y-4">
        {items.map((item) => (
          <div
            key={item.productId + (item.variationId ?? '')}
            className="flex items-center gap-4 border rounded-lg p-4"
          >
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm truncate">{item.name}</h3>
              <p className="text-sm text-muted-foreground">
                {formatCurrency(item.price)} un.
              </p>
            </div>

            <div className="flex items-center border rounded-md">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  handleUpdateQuantity(item.productId, Math.max(1, item.quantity - 1))
                }
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-8 text-center text-sm">{item.quantity}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  handleUpdateQuantity(item.productId, item.quantity + 1)
                }
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            <p className="font-medium text-sm w-20 text-right">
              {formatCurrency(item.price * item.quantity)}
            </p>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => handleRemove(item.productId)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Separator className="my-6" />

      {/* Coupon */}
      <form onSubmit={handleApplyCoupon} className="flex gap-2 mb-6">
        <Input
          placeholder="Cupom de desconto"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
          className="max-w-xs"
        />
        <Button type="submit" variant="outline" disabled={!couponCode}>
          Aplicar
        </Button>
      </form>
      {couponMsg && (
        <p className="text-sm text-muted-foreground mb-4">{couponMsg}</p>
      )}

      {/* Summary */}
      <div className="border rounded-lg p-6 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Frete</span>
          <span className="text-muted-foreground">Calcular no checkout</span>
        </div>
        <Separator />
        <div className="flex justify-between font-bold text-lg">
          <span>Total</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <Link href={ROUTES.checkout} className="block mt-4">
          <Button size="lg" className="w-full">
            Finalizar Compra
          </Button>
        </Link>
      </div>
    </div>
  );
}
