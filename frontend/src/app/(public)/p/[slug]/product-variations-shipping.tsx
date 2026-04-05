'use client';

import { useState } from 'react';
import { Loader2, Truck, Package, ShoppingCart, Minus, Plus, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { useCartStore } from '@/store/cart-store';
import { formatCurrency } from '@/lib/constants';
import { WishlistButton } from '@/components/product/wishlist-button';

interface Variation {
  id: string;
  name: string;
  price: number;
  salePrice?: number | null;
  image?: string;
  stock: number;
}

interface ScaleItem {
  id: string;
  name: string;
  percentageIncrease: number;
  sortOrder: number;
}

interface ScaleData {
  id: string;
  name: string;
  items: ScaleItem[];
}

interface ShippingQuote {
  serviceId: number;
  name: string;
  company: string;
  price: number;
  deliveryDays: number;
  deliveryRange: { min: number; max: number };
}

interface Props {
  productId: string;
  productSlug: string;
  productType: string;
  productName: string;
  basePrice: number;
  salePrice?: number | null;
  variations: Variation[];
  scaleData: ScaleData | null;
}

export function ProductVariationsAndShipping({
  productId,
  productSlug,
  productType,
  productName,
  basePrice,
  salePrice,
  variations,
  scaleData,
}: Props) {
  const setCart = useCartStore((s) => s.setCart);

  // Variation state
  const [selectedVariation, setSelectedVariation] = useState<Variation | null>(null);
  const isVariable = productType === 'variable' && variations.length > 0;

  // Scale state
  const hasScales = scaleData !== null && scaleData.items.length > 0;
  const [selectedScaleItem, setSelectedScaleItem] = useState<ScaleItem | null>(
    hasScales ? scaleData!.items.find((i) => i.percentageIncrease === 0) ?? scaleData!.items[0] : null,
  );

  // Cart state
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  // Shipping state
  const [cep, setCep] = useState('');
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState('');
  const [quotes, setQuotes] = useState<ShippingQuote[]>([]);
  const [freeShipping, setFreeShipping] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // ── Price calculation ──
  const rawBasePrice = isVariable
    ? (selectedVariation ? (selectedVariation.salePrice ?? selectedVariation.price) : 0)
    : (salePrice ?? basePrice);

  const scalePercentage = selectedScaleItem?.percentageIncrease ?? 0;
  const finalPrice = hasScales && scalePercentage > 0
    ? Math.round(rawBasePrice * (1 + scalePercentage / 100) * 100) / 100
    : rawBasePrice;

  const scaleExtraPrice = finalPrice - rawBasePrice;

  // Can add to cart?
  const canAdd = (!isVariable || selectedVariation !== null) && finalPrice > 0;

  // ── Handlers ──

  function handleSelectVariation(v: Variation) {
    setSelectedVariation(v);
    setQuotes([]);
    setHasSearched(false);
    // Recalc shipping if CEP already entered
    const cleaned = cep.replace(/\D/g, '');
    if (cleaned.length === 8) {
      doShippingCalc(cleaned, v.id);
    }
  }

  async function handleAddToCart() {
    if (!canAdd) return;
    setAddingToCart(true);
    try {
      const { data } = await api.post('/cart/items', {
        productId,
        variationId: selectedVariation?.id,
        scaleId: selectedScaleItem?.id,
        quantity,
      });
      setCart(data.data.items, data.data.subtotal);
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
    } catch {
      // TODO: toast
    } finally {
      setAddingToCart(false);
    }
  }

  async function doShippingCalc(cleanedCep: string, variationId?: string) {
    setShippingLoading(true);
    setShippingError('');
    setHasSearched(true);
    try {
      const { data } = await api.post('/shipping/quote', {
        zipCode: cleanedCep,
        products: [{
          productId,
          variationId: variationId ?? selectedVariation?.id,
          quantity: 1,
        }],
      });
      const result = data.data;
      setQuotes(result.quotes);
      setFreeShipping(result.freeShipping);
    } catch {
      setShippingError('Erro ao calcular frete. Verifique o CEP.');
      setQuotes([]);
    } finally {
      setShippingLoading(false);
    }
  }

  function handleCepInput(value: string) {
    const cleaned = value.replace(/\D/g, '');
    setCep(cleaned);
    if (cleaned.length === 8 && canAdd) {
      doShippingCalc(cleaned);
    }
  }

  function handleCalculate() {
    const cleaned = cep.replace(/\D/g, '');
    if (cleaned.length !== 8) {
      setShippingError('CEP deve ter 8 digitos');
      return;
    }
    if (isVariable && !selectedVariation) {
      setShippingError('Selecione uma variacao primeiro');
      return;
    }
    doShippingCalc(cleaned);
  }

  return (
    <>
      {/* ── Price Display ── */}
      <div className="mt-6">
        {isVariable && !selectedVariation ? (
          <p className="text-lg text-muted-foreground">
            A partir de{' '}
            <span className="text-2xl font-bold text-primary">
              {formatCurrency(Math.min(...variations.map((v) => v.salePrice ?? v.price)))}
            </span>
          </p>
        ) : (
          <>
            {finalPrice > 0 && (
              <>
                <p className="text-3xl font-bold text-primary">
                  {formatCurrency(finalPrice)}
                </p>
                {hasScales && scaleExtraPrice > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Preco base: {formatCurrency(rawBasePrice)} + escala: +{formatCurrency(scaleExtraPrice)}
                  </p>
                )}
                <p className="text-sm text-muted-foreground mt-1">
                  ou {formatCurrency(finalPrice * 0.9)} no PIX (10% off)
                </p>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Variation Dropdown ── */}
      {isVariable && (
        <div className="mt-6">
          <label className="text-sm font-medium flex items-center gap-2">
            Modelo:
            <select
              value={selectedVariation?.id ?? ''}
              onChange={(e) => {
                const v = variations.find((v) => v.id === e.target.value);
                if (v) handleSelectVariation(v);
              }}
              className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Escolha uma opcao</option>
              {variations.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} — {formatCurrency(v.salePrice ?? v.price)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* ── Scale Radio Buttons ── */}
      {hasScales && (
        <div className="mt-6">
          <h3 className="text-sm font-medium">Escala</h3>
          <p className="text-xs text-muted-foreground mb-3">Selecione a escala de impressao</p>
          <div className="space-y-2">
            {scaleData!.items
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((item) => {
                const isSelected = selectedScaleItem?.id === item.id;
                const extraPct = item.percentageIncrease;
                const extraPrice = rawBasePrice > 0
                  ? Math.round(rawBasePrice * extraPct / 100 * 100) / 100
                  : 0;

                return (
                  <label
                    key={item.id}
                    className={`flex items-center gap-3 border rounded-lg px-4 py-3 cursor-pointer transition-colors ${
                      isSelected ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="scale"
                      checked={isSelected}
                      onChange={() => setSelectedScaleItem(item)}
                      className="accent-primary"
                    />
                    <div className="flex-1">
                      <span className="font-medium text-sm">{item.name}</span>
                      {extraPct > 0 && (
                        <span className="text-xs text-muted-foreground ml-2">
                          +{extraPct}% sobre o base
                        </span>
                      )}
                    </div>
                    {extraPct > 0 && rawBasePrice > 0 && (
                      <span className="text-sm font-medium text-primary">
                        +{formatCurrency(extraPrice)}
                      </span>
                    )}
                  </label>
                );
              })}
          </div>
        </div>
      )}

      {/* ── Shipping Calculator ── */}
      <div className="mt-6 border rounded-lg p-4">
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Truck className="h-4 w-4" />
          Calcular frete
        </h3>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Digite seu CEP"
            value={cep}
            onChange={(e) => handleCepInput(e.target.value)}
            maxLength={9}
            className="w-36 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={handleCalculate}
            disabled={shippingLoading || cep.replace(/\D/g, '').length !== 8}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {shippingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Calcular'}
          </button>
        </div>

        {shippingError && <p className="text-xs text-destructive mt-2">{shippingError}</p>}

        {freeShipping && hasSearched && (
          <div className="bg-green-50 text-green-700 border border-green-200 rounded-md px-3 py-2 text-sm flex items-center gap-2 mt-3">
            <Package className="h-4 w-4" />
            Frete gratis para este CEP!
          </div>
        )}

        {hasSearched && quotes.length > 0 && (
          <div className="mt-3 border rounded-lg overflow-hidden divide-y">
            <div className="grid grid-cols-[1fr_auto] gap-4 px-4 py-2 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <span>Tipo de entrega</span>
              <span>Custo</span>
            </div>
            {[...quotes].sort((a, b) => a.price - b.price).map((quote) => (
              <div key={quote.serviceId} className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3 text-sm items-center">
                <div>
                  <span className="font-medium">{quote.name}</span>
                  <span className="text-muted-foreground ml-1">
                    (Entrega em ate {quote.deliveryRange.max} dias uteis)
                  </span>
                </div>
                <div className="text-right font-bold whitespace-nowrap">
                  {freeShipping ? (
                    <span>
                      <span className="text-muted-foreground line-through font-normal text-xs mr-1">{formatCurrency(quote.price)}</span>
                      <span className="text-green-600">Gratis</span>
                    </span>
                  ) : (
                    <span className="text-primary">{formatCurrency(quote.price)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {hasSearched && !shippingLoading && quotes.length === 0 && !shippingError && (
          <p className="text-xs text-muted-foreground mt-2">Nenhuma opcao de frete para este CEP.</p>
        )}
      </div>

      {/* ── Quantity + Add to Cart + Wishlist ── */}
      <div className="mt-8 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Quantidade:</span>
          <div className="flex items-center border rounded-md">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-10 text-center text-sm font-medium">{quantity}</span>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setQuantity(quantity + 1)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <WishlistButton productId={productId} productSlug={productSlug} className="h-10 w-10 ml-auto" />
        </div>

        <Button
          size="lg"
          className="w-full"
          onClick={handleAddToCart}
          disabled={addingToCart || !canAdd}
        >
          <ShoppingCart className="mr-2 h-5 w-5" />
          {addedToCart ? 'Adicionado!' : addingToCart ? 'Adicionando...' : 'Adicionar ao Carrinho'}
        </Button>

        {isVariable && !selectedVariation && (
          <p className="text-xs text-center text-muted-foreground">Selecione um modelo para adicionar ao carrinho</p>
        )}
      </div>
    </>
  );
}
