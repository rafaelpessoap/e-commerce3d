'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
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

function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false; // 111.111.111-11 etc.
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  return remainder === parseInt(digits[10]);
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clear, setCart } = useCartStore();
  const { user } = useAuthStore();
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [loading, setLoading] = useState(false);
  const [cartLoading, setCartLoading] = useState(true);
  const [error, setError] = useState('');
  const cardFormRef = useRef<CardPaymentFormRef>(null);

  // Reload cart from backend on mount (handles page refresh)
  useEffect(() => {
    api.get('/cart')
      .then(({ data }) => setCart(data.data.items, data.data.subtotal))
      .catch(() => {})
      .finally(() => setCartLoading(false));
  }, [setCart]);

  // Personal data
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (user) {
      if (user.name) setFullName(user.name);
      if (user.email) setEmail(user.email);
      if (user.cpf) {
        const d = user.cpf.replace(/\D/g, '');
        if (d.length === 11) setCpf(`${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`);
      }
      if (user.phone) {
        const d = user.phone.replace(/\D/g, '');
        if (d.length >= 10) setPhone(d.length === 11 ? `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}` : `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`);
      }
    }
  }, [user]);

  // Shipping — restore from cart if available
  const [selectedShipping, setSelectedShipping] = useState<ShippingQuote | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('cartShipping');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  // Saved addresses
  interface SavedAddress {
    id: string;
    postalCode: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    isDefault?: boolean;
  }
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [addressMode, setAddressMode] = useState<'saved' | 'new'>('new');
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  // Address fields — restore CEP from cart
  const [zipCode, setZipCode] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('cartShippingCep') ?? '';
  });
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState('');

  // Load saved addresses
  useEffect(() => {
    api.get('/addresses').then(({ data }) => {
      const addrs = data.data ?? [];
      setSavedAddresses(addrs);
      if (addrs.length > 0) {
        setAddressMode('saved');
        const defaultAddr = addrs.find((a: SavedAddress) => a.isDefault) ?? addrs[0];
        selectSavedAddress(defaultAddr);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectSavedAddress = useCallback((addr: SavedAddress) => {
    setSelectedAddressId(addr.id);
    setZipCode(addr.postalCode);
    setStreet(addr.street);
    setNumber(addr.number);
    setComplement(addr.complement ?? '');
    setNeighborhood(addr.neighborhood);
    setCity(addr.city);
    setState(addr.state);
    // Reset shipping when address changes
    setSelectedShipping(null);
  }, []);

  // Auto-fill address if CEP was saved from cart (only for new address mode)
  useEffect(() => {
    if (addressMode === 'new' && zipCode.length === 8) {
      handleCepLookup(zipCode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!isValidCpf(cpf)) {
      setError('CPF inválido. Verifique os dígitos.');
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

      // 1. Criar pedido (backend recalcula tudo via PricingService)
      const { data: orderData } = await api.post('/orders', {
        items: items.map((i) => ({
          productId: i.productId,
          variationId: i.variationId,
          scaleId: i.scaleId,
          quantity: i.quantity,
        })),
        shipping: shippingCost,
        shippingZipCode: zipCode,
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

      // 4. Limpar carrinho + shipping cache
      await api.delete('/cart');
      clear();
      localStorage.removeItem('cartShipping');
      localStorage.removeItem('cartShippingCep');

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

  if (cartLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">
        Carregando checkout...
      </div>
    );
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
              {/* Saved addresses */}
              {savedAddresses.length > 0 && (
                <div className="space-y-2">
                  {savedAddresses.map((addr) => (
                    <label
                      key={addr.id}
                      className={`flex items-start gap-3 border rounded-lg p-4 cursor-pointer transition-colors ${
                        addressMode === 'saved' && selectedAddressId === addr.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-muted-foreground/30'
                      }`}
                    >
                      <input
                        type="radio"
                        name="address"
                        checked={addressMode === 'saved' && selectedAddressId === addr.id}
                        onChange={() => {
                          setAddressMode('saved');
                          selectSavedAddress(addr);
                        }}
                        className="accent-primary mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {addr.street}, {addr.number}
                          {addr.complement ? ` - ${addr.complement}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {addr.neighborhood} - {addr.city}/{addr.state} - CEP {addr.postalCode}
                        </p>
                      </div>
                      {addr.isDefault && (
                        <span className="text-xs text-primary font-medium shrink-0">Padrão</span>
                      )}
                    </label>
                  ))}

                  {/* New address option */}
                  <label
                    className={`flex items-center gap-3 border rounded-lg p-4 cursor-pointer transition-colors ${
                      addressMode === 'new'
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-muted-foreground/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      checked={addressMode === 'new'}
                      onChange={() => {
                        setAddressMode('new');
                        setSelectedAddressId(null);
                        setZipCode('');
                        setStreet('');
                        setNumber('');
                        setComplement('');
                        setNeighborhood('');
                        setCity('');
                        setState('');
                        setSelectedShipping(null);
                      }}
                      className="accent-primary"
                    />
                    <Plus className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Novo endereço</span>
                  </label>
                </div>
              )}

              {/* New address form */}
              {(addressMode === 'new' || savedAddresses.length === 0) && (
                <div className="space-y-4">
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
                </div>
              )}
            </CardContent>
          </Card>

          {/* Frete — auto-calculated from address CEP */}
          {zipCode.replace(/\D/g, '').length >= 8 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Opções de Frete</CardTitle>
              </CardHeader>
              <CardContent>
                <ShippingCalculator
                  products={cartProducts}
                  selectedQuote={selectedShipping}
                  onSelectQuote={setSelectedShipping}
                  externalCep={zipCode}
                  compact
                />
              </CardContent>
            </Card>
          )}

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
              {items.map((item) => {
                const key = `${item.productId}-${item.variationId ?? ''}-${item.scaleId ?? ''}`;
                return (
                  <div key={key} className="flex gap-3 text-sm">
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-12 h-12 object-cover rounded border flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.name}</p>
                      {item.variationName && (
                        <p className="text-xs text-muted-foreground">Modelo: {item.variationName}</p>
                      )}
                      {item.scaleName && (
                        <p className="text-xs text-muted-foreground">Escala: {item.scaleName}</p>
                      )}
                      <p className="text-xs text-muted-foreground">Qtd: {item.quantity}</p>
                    </div>
                    <span className="font-medium flex-shrink-0">{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                );
              })}

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
