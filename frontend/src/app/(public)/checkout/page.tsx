'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';
import { useCartStore } from '@/store/cart-store';
import { formatCurrency } from '@/lib/constants';

const PAYMENT_METHODS = [
  { id: 'pix', label: 'PIX', discount: '10% de desconto' },
  { id: 'boleto', label: 'Boleto', discount: '5% de desconto' },
  { id: 'credit_card', label: 'Cartão de Crédito', discount: '' },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clear } = useCartStore();
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [zipCode, setZipCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const discount =
    paymentMethod === 'pix'
      ? subtotal * 0.1
      : paymentMethod === 'boleto'
        ? subtotal * 0.05
        : 0;
  const total = Math.round((subtotal - discount) * 100) / 100;

  async function handlePlaceOrder() {
    setError('');
    setLoading(true);

    try {
      // Criar pedido
      const { data: orderData } = await api.post('/orders', {
        items: items.map((i) => ({
          productId: i.productId,
          variationId: i.variationId,
          quantity: i.quantity,
          price: i.price,
        })),
        subtotal,
        discount,
        total,
        paymentMethod,
      });

      // Criar pagamento
      await api.post('/payments/create', {
        orderId: orderData.data.id,
        method: paymentMethod,
      });

      // Limpar carrinho
      await api.delete('/cart');
      clear();

      router.push(`/pedido/confirmacao/${orderData.data.id}`);
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao finalizar pedido');
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-muted-foreground">Seu carrinho está vazio.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Endereço */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Endereço de Entrega</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="zipCode">CEP</Label>
                <Input
                  id="zipCode"
                  placeholder="00000000"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value.replace(/\D/g, ''))}
                  maxLength={8}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Selecione um endereço cadastrado ou adicione um novo na sua conta.
              </p>
            </CardContent>
          </Card>

          {/* Pagamento */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Método de Pagamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {PAYMENT_METHODS.map((method) => (
                <label
                  key={method.id}
                  className={`flex items-center justify-between border rounded-lg p-4 cursor-pointer transition-colors ${
                    paymentMethod === method.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-muted-foreground/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="payment"
                      value={method.id}
                      checked={paymentMethod === method.id}
                      onChange={() => setPaymentMethod(method.id)}
                      className="accent-primary"
                    />
                    <span className="font-medium text-sm">{method.label}</span>
                  </div>
                  {method.discount && (
                    <span className="text-xs text-primary font-medium">
                      {method.discount}
                    </span>
                  )}
                </label>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Resumo */}
        <div>
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle className="text-lg">Resumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.productId}
                  className="flex justify-between text-sm"
                >
                  <span className="text-muted-foreground truncate max-w-[60%]">
                    {item.name} x{item.quantity}
                  </span>
                  <span>{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}

              <Separator />

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between text-sm text-primary">
                  <span>Desconto ({paymentMethod.toUpperCase()})</span>
                  <span>-{formatCurrency(discount)}</span>
                </div>
              )}

              <Separator />

              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button
                size="lg"
                className="w-full mt-4"
                onClick={handlePlaceOrder}
                disabled={loading}
              >
                {loading ? 'Finalizando...' : 'Confirmar Pedido'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
