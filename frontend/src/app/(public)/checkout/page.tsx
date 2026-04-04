'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShippingCalculator, type ShippingQuote } from '@/components/shared/shipping-calculator';
import { CardPaymentForm, type CardPaymentFormRef } from '@/components/payment/card-payment-form';
import { api } from '@/lib/api-client';
import { useCartStore } from '@/store/cart-store';
import { useAuthStore } from '@/store/auth-store';
import { formatCurrency } from '@/lib/constants';

const PAYMENT_METHODS = [
  { id: 'pix', label: 'PIX', discount: '10% de desconto' },
  { id: 'boleto', label: 'Boleto', discount: '5% de desconto' },
  { id: 'credit_card', label: 'Cartão de Crédito', discount: '' },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clear } = useCartStore();
  const { user } = useAuthStore();
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const cardFormRef = useRef<CardPaymentFormRef>(null);

  // Personal data
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (user) {
      if (user.name) setFullName(user.name);
      if (user.email) setEmail(user.email);
    }
  }, [user]);

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
    if (!fullName.trim()) {
      setError('Preencha o nome completo.');
      return;
    }
    if (!cpf.replace(/\D/g, '') || cpf.replace(/\D/g, '').length !== 11) {
      setError('Preencha um CPF valido (11 digitos).');
      return;
    }
    if (!phone.replace(/\D/g, '') || phone.replace(/\D/g, '').length < 10) {
      setError('Preencha um telefone valido.');
      return;
    }
    if (!zipCode || !street || !number || !neighborhood || !city || !state) {
      setError('Preencha todos os campos do endereco.');
      return;
    }
    if (!selectedShipping) {
      setError('Selecione uma opcao de frete.');
      return;
    }

    setError('');
    setLoading(true);

    const cpfDigits = cpf.replace(/\D/g, '');
    const phoneDigits = phone.replace(/\D/g, '');

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
      // Tokenizar cartão (se necessário) — tudo em 1 clique
      let cardToken: string | undefined;
      let cardInstallments: number | undefined;
      let cardMethodId: string | undefined;

      if (paymentMethod === 'credit_card') {
        if (!cardFormRef.current) {
          setError('Formulario do cartao nao carregou. Recarregue a pagina.');
          setLoading(false);
          return;
        }
        try {
          const tokenData = await cardFormRef.current.tokenize();
          if (!tokenData) {
            setError('Erro ao processar cartao. Verifique os dados.');
            setLoading(false);
            return;
          }
          cardToken = tokenData.token;
          cardInstallments = tokenData.installments;
          cardMethodId = tokenData.paymentMethodId;
        } catch (cardErr) {
          setError((cardErr as Error).message || 'Dados do cartao invalidos.');
          setLoading(false);
          return;
        }
      }

      // 1. Criar pedido (backend recalcula preços do banco)
      const { data: orderData } = await api.post('/orders', {
        items: items.map((i) => ({
          productId: i.productId,
          variationId: i.variationId,
          quantity: i.quantity,
          price: i.price, // ignorado pelo backend — recalculado do DB
        })),
        subtotal, // ignorado pelo backend
        shipping: shippingCost,
        discount: paymentDiscount, // ignorado pelo backend
        total, // ignorado pelo backend
        paymentMethod,
        shippingAddress,
        shippingServiceName: selectedShipping.name,
      });

      const orderId = orderData.data?.id ?? orderData.id;

      // 2. Criar pagamento no Mercado Pago
      const { data: paymentData } = await api.post('/payments/create', {
        orderId,
        method: paymentMethod,
        cardToken,
        installments: cardInstallments,
        paymentMethodId: cardMethodId,
        payerEmail: email,
        payerCpf: cpfDigits,
        payerName: fullName.trim(),
      });

      // 3. Atualizar perfil (non-blocking)
      try {
        await api.put('/users/me', {
          name: fullName.trim(),
          cpf: cpfDigits,
          phone: phoneDigits,
        });
      } catch {
        // Non-blocking
      }

      // 4. Limpar carrinho
      await api.delete('/cart');
      clear();

      // 5. Redirecionar baseado no método
      const payment = paymentData.data;

      if (paymentMethod === 'credit_card' && payment?.status === 'APPROVED') {
        // Cartão aprovado → confirmação direto
        router.push(`/pedido/confirmacao/${orderId}`);
      } else {
        // PIX, Boleto, ou cartão pendente/rejeitado → página de pagamento
        router.push(`/pedido/pagamento/${orderId}`);
      }
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
          {/* Dados Pessoais */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dados Pessoais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome completo</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={email}
                    readOnly
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                      let formatted = digits;
                      if (digits.length > 9) {
                        formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
                      } else if (digits.length > 6) {
                        formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
                      } else if (digits.length > 3) {
                        formatted = `${digits.slice(0, 3)}.${digits.slice(3)}`;
                      }
                      setCpf(formatted);
                    }}
                    maxLength={14}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                      let formatted = digits;
                      if (digits.length > 6) {
                        formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
                      } else if (digits.length > 2) {
                        formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
                      }
                      setPhone(formatted);
                    }}
                    maxLength={15}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

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

              {/* Formulário de cartão inline */}
              {paymentMethod === 'credit_card' && (
                <div className="mt-4">
                  <CardPaymentForm
                    ref={cardFormRef}
                    amount={total}
                  />
                </div>
              )}
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
