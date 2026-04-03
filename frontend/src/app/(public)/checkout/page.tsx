'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShippingCalculator, type ShippingQuote } from '@/components/shared/shipping-calculator';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Shipping
  const [selectedShipping, setSelectedShipping] = useState<ShippingQuote | null>(null);

  // Address fields
  const [zipCode, setZipCode] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState('');

  // Cálculo: desconto NUNCA se aplica ao frete
  const shippingCost = selectedShipping?.price ?? 0;
  const paymentDiscount =
    paymentMethod === 'pix'
      ? subtotal * 0.1
      : paymentMethod === 'boleto'
        ? subtotal * 0.05
        : 0;
  const total = Math.round((subtotal - paymentDiscount + shippingCost) * 100) / 100;

  async function handleCepLookup(cep: string) {
    const cleaned = cep.replace(/\D/g, '');
    setZipCode(cleaned);

    if (cleaned.length !== 8) {
      setCepError('');
      return;
    }

    setCepLoading(true);
    setCepError('');

    try {
      const { data } = await api.get(`/addresses/cep/${cleaned}`);
      const addr = data.data ?? data;
      if (addr?.street) setStreet(addr.street);
      if (addr?.neighborhood) setNeighborhood(addr.neighborhood);
      if (addr?.city) setCity(addr.city);
      if (addr?.state) setState(addr.state);
    } catch {
      setCepError('CEP não encontrado. Preencha manualmente.');
    } finally {
      setCepLoading(false);
    }
  }

  async function handlePlaceOrder() {
    if (!zipCode || !street || !number || !neighborhood || !city || !state) {
      setError('Preencha todos os campos do endereço.');
      return;
    }
    if (!selectedShipping) {
      setError('Selecione uma opção de frete.');
      return;
    }

    setError('');
    setLoading(true);

    const shippingAddress = JSON.stringify({
      zipCode,
      street,
      number,
      complement,
      neighborhood,
      city,
      state,
    });

    try {
      const { data: orderData } = await api.post('/orders', {
        items: items.map((i) => ({
          productId: i.productId,
          variationId: i.variationId,
          quantity: i.quantity,
          price: i.price,
        })),
        subtotal,
        shipping: shippingCost,
        discount: paymentDiscount,
        total,
        paymentMethod,
        shippingAddress,
        shippingServiceName: selectedShipping.name,
      });

      await api.post('/payments/create', {
        orderId: orderData.data?.id ?? orderData.id,
        method: paymentMethod,
      });

      await api.delete('/cart');
      clear();

      router.push(`/pedido/confirmacao/${orderData.data?.id ?? orderData.id}`);
    } catch (err) {
      const resp = (err as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data;
      setError(resp?.error?.message ?? resp?.message ?? 'Erro ao finalizar pedido');
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

  const cartProducts = items.map((i) => ({
    productId: i.productId,
    quantity: i.quantity,
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Endereço */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Endereço de Entrega</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* CEP */}
              <div className="space-y-2">
                <Label htmlFor="zipCode">CEP</Label>
                <div className="flex gap-2">
                  <Input
                    id="zipCode"
                    placeholder="00000-000"
                    value={zipCode}
                    onChange={(e) => handleCepLookup(e.target.value)}
                    maxLength={9}
                    className="max-w-[160px]"
                  />
                  {cepLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground self-center" />}
                </div>
                {cepError && <p className="text-xs text-destructive">{cepError}</p>}
              </div>

              {/* Rua + Número */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="street">Rua</Label>
                  <Input
                    id="street"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Rua, Avenida..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="number">Número</Label>
                  <Input
                    id="number"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="123"
                  />
                </div>
              </div>

              {/* Complemento */}
              <div className="space-y-2">
                <Label htmlFor="complement">Complemento <span className="text-muted-foreground">(opcional)</span></Label>
                <Input
                  id="complement"
                  value={complement}
                  onChange={(e) => setComplement(e.target.value)}
                  placeholder="Apto, bloco..."
                />
              </div>

              {/* Bairro + Cidade + Estado */}
              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="neighborhood">Bairro</Label>
                  <Input
                    id="neighborhood"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">UF</Label>
                  <Input
                    id="state"
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase())}
                    maxLength={2}
                    placeholder="SP"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Frete */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Opções de Frete</CardTitle>
            </CardHeader>
            <CardContent>
              {zipCode.length >= 8 ? (
                <ShippingCalculator
                  products={cartProducts}
                  selectedQuote={selectedShipping}
                  onSelectQuote={setSelectedShipping}
                  compact
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Preencha o CEP acima para ver as opções de frete.
                </p>
              )}
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
                <div key={`${item.productId}-${item.variationId ?? ''}`} className="flex justify-between text-sm">
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

              {/* Frete */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Frete{selectedShipping ? ` (${selectedShipping.name})` : ''}
                </span>
                {selectedShipping ? (
                  <span className={shippingCost === 0 ? 'text-green-600 font-medium' : ''}>
                    {shippingCost === 0 ? 'Grátis' : formatCurrency(shippingCost)}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">Calcule acima</span>
                )}
              </div>

              {paymentDiscount > 0 && (
                <div className="flex justify-between text-sm text-primary">
                  <span>Desconto ({paymentMethod.toUpperCase()})</span>
                  <span>-{formatCurrency(paymentDiscount)}</span>
                </div>
              )}

              <Separator />

              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>

              {selectedShipping && selectedShipping.deliveryDays > 0 && (
                <p className="text-xs text-muted-foreground">
                  Prazo de entrega: {selectedShipping.deliveryRange?.min}-{selectedShipping.deliveryRange?.max} dias úteis
                </p>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                size="lg"
                className="w-full mt-4"
                onClick={handlePlaceOrder}
                disabled={loading || !selectedShipping || !zipCode}
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
