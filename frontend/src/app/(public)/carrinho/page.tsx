'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Trash2, Minus, Plus, Pencil, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from '@/components/shared/empty-state';
import { ShippingCalculator, type ShippingQuote } from '@/components/shared/shipping-calculator';
import { api } from '@/lib/api-client';
import { useCartStore } from '@/store/cart-store';
import { ROUTES, formatCurrency } from '@/lib/constants';
import type { Cart } from '@/types/cart';

export default function CartPage() {
  const { items, subtotal, setCart, clear } = useCartStore();
  const [couponCode, setCouponCode] = useState('');
  const [couponMsg, setCouponMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedShipping, setSelectedShipping] = useState<ShippingQuote | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('cartShipping');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [savedCep, setSavedCep] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('cartShippingCep') ?? '';
  });

  function handleSelectShipping(quote: ShippingQuote) {
    setSelectedShipping(quote);
    localStorage.setItem('cartShipping', JSON.stringify(quote));
  }

  function handleCepChange(cep: string) {
    setSavedCep(cep);
    localStorage.setItem('cartShippingCep', cep);
  }

  useEffect(() => {
    api
      .get<{ data: Cart }>('/cart')
      .then(({ data }) => setCart(data.data.items, data.data.subtotal))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [setCart]);

  async function handleUpdateQuantity(
    productId: string,
    quantity: number,
    variationId?: string,
    scaleId?: string,
  ) {
    try {
      const params = new URLSearchParams();
      if (variationId) params.set('variationId', variationId);
      if (scaleId) params.set('scaleId', scaleId);
      const qs = params.toString();
      const { data } = await api.put(`/cart/items/${productId}${qs ? `?${qs}` : ''}`, { quantity });
      setCart(data.data.items, data.data.subtotal);
    } catch {}
  }

  async function handleRemove(productId: string, variationId?: string, scaleId?: string) {
    try {
      const params = new URLSearchParams();
      if (variationId) params.set('variationId', variationId);
      if (scaleId) params.set('scaleId', scaleId);
      const qs = params.toString();
      const { data } = await api.delete(`/cart/items/${productId}${qs ? `?${qs}` : ''}`);
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
    } catch (err) {
      setCouponMsg((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Cupom invalido');
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
        {items.map((item) => {
          const itemKey = item.productId + (item.variationId ?? '') + (item.scaleId ?? '');
          return (
            <div key={itemKey} className="flex gap-4 border rounded-lg p-4">
              {/* Thumbnail */}
              {item.image && (
                <div className="relative w-16 h-16 rounded overflow-hidden shrink-0">
                  <Image src={item.image} alt={item.name} fill className="object-cover" sizes="64px" />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate">{item.name}</h3>

                {/* Variation */}
                {item.variationName && (
                  <p className="text-xs text-muted-foreground">
                    Modelo: {item.variationName}
                  </p>
                )}

                {/* Scale */}
                {item.scaleName && (
                  <p className="text-xs text-muted-foreground">
                    Escala: {item.scaleName}
                  </p>
                )}

                {/* Unit price */}
                <p className="text-sm text-muted-foreground mt-1">
                  {formatCurrency(item.price)} un.
                </p>
              </div>

              {/* Quantity controls */}
              <div className="flex items-center border rounded-md self-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    handleUpdateQuantity(item.productId, Math.max(1, item.quantity - 1), item.variationId, item.scaleId)
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
                    handleUpdateQuantity(item.productId, item.quantity + 1, item.variationId, item.scaleId)
                  }
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              {/* Line total + remove */}
              <div className="flex flex-col items-end justify-between self-stretch">
                <p className="font-medium text-sm">
                  {formatCurrency(item.price * item.quantity)}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => handleRemove(item.productId, item.variationId, item.scaleId)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Production time notice */}
      <div className="mt-4 flex items-start gap-2 bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>O prazo de entrega inclui o tempo de producao das miniaturas impressas em 3D.</p>
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

      {/* Shipping */}
      <div className="border rounded-lg p-6 space-y-3">
        <h2 className="font-semibold text-base mb-2">Calcular Frete</h2>
        <ShippingCalculator
          products={items.map((i) => ({ productId: i.productId, quantity: i.quantity }))}
          selectedQuote={selectedShipping}
          onSelectQuote={handleSelectShipping}
          onCepChange={handleCepChange}
          initialCep={savedCep}
        />
      </div>

      {/* Summary */}
      <div className="border rounded-lg p-6 space-y-3 mt-6">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Frete{selectedShipping ? ` (${selectedShipping.name})` : ''}
          </span>
          {selectedShipping ? (
            <span className={selectedShipping.price === 0 ? 'text-green-600 font-medium' : ''}>
              {selectedShipping.price === 0 ? 'Gratis' : formatCurrency(selectedShipping.price)}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">Calcule acima</span>
          )}
        </div>
        <Separator />
        <div className="flex justify-between font-bold text-lg">
          <span>Total</span>
          <span>{formatCurrency(subtotal + (selectedShipping?.price ?? 0))}</span>
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
