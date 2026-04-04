'use client';

import { useState } from 'react';
import { Loader2, Truck, Package } from 'lucide-react';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/constants';

interface Variation {
  id: string;
  name: string;
  price: number;
  salePrice?: number | null;
  image?: string;
  scale?: { name: string };
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
  productType: string;
  variations: Variation[];
}

export function ProductVariationsAndShipping({ productId, productType, variations }: Props) {
  const [selectedVariation, setSelectedVariation] = useState<Variation | null>(null);
  const [cep, setCep] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quotes, setQuotes] = useState<ShippingQuote[]>([]);
  const [freeShipping, setFreeShipping] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const isVariable = productType === 'variable' && variations.length > 0;
  const needsVariation = isVariable && !selectedVariation;

  async function handleCalculate(cepValue?: string) {
    const cleaned = (cepValue ?? cep).replace(/\D/g, '');
    if (cleaned.length !== 8) {
      setError('CEP deve ter 8 digitos');
      return;
    }

    if (needsVariation) {
      setError('Selecione uma escala para calcular o frete');
      return;
    }

    setLoading(true);
    setError('');
    setHasSearched(true);

    try {
      const { data } = await api.post('/shipping/quote', {
        zipCode: cleaned,
        products: [{
          productId,
          variationId: selectedVariation?.id,
          quantity: 1,
        }],
      });

      const result = data.data;
      setQuotes(result.quotes);
      setFreeShipping(result.freeShipping);
    } catch (err: unknown) {
      const resp = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data;
      const msg = resp?.error?.message ?? 'Erro ao calcular frete. Verifique o CEP e tente novamente.';
      setError(msg);
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  }

  function handleCepInput(value: string) {
    const cleaned = value.replace(/\D/g, '');
    setCep(cleaned);
    if (cleaned.length === 8 && !needsVariation) {
      handleCalculate(cleaned);
    }
  }

  function handleSelectAndRecalc(variation: Variation) {
    setSelectedVariation(variation);
    setQuotes([]);
    setHasSearched(false);
    const cleaned = cep.replace(/\D/g, '');
    if (cleaned.length === 8) {
      // Calcular direto com a variação selecionada
      setLoading(true);
      setError('');
      setHasSearched(true);
      api.post('/shipping/quote', {
        zipCode: cleaned,
        products: [{
          productId,
          variationId: variation.id,
          quantity: 1,
        }],
      }).then(({ data }) => {
        const result = data.data;
        setQuotes(result.quotes);
        setFreeShipping(result.freeShipping);
      }).catch((err: unknown) => {
        const resp = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data;
        const msg = resp?.error?.message ?? 'Erro ao calcular frete. Verifique o CEP e tente novamente.';
        setError(msg);
        setQuotes([]);
      }).finally(() => {
        setLoading(false);
      });
    }
  }

  return (
    <>
      {/* Variation Selector */}
      {isVariable && (
        <div className="mt-6">
          <h3 className="text-sm font-medium mb-3">Escalas disponiveis</h3>
          <div className="flex flex-wrap gap-2">
            {variations.map((v) => {
              const isSelected = selectedVariation?.id === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => handleSelectAndRecalc(v)}
                  className={`rounded border px-3 py-2 text-sm cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'hover:border-primary'
                  }`}
                >
                  <span className="font-medium">{v.scale?.name ?? v.name}</span>
                  <span className="text-muted-foreground ml-2">
                    {formatCurrency(v.salePrice ?? v.price)}
                  </span>
                </button>
              );
            })}
          </div>
          {selectedVariation && (
            <div className="mt-3">
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(selectedVariation.salePrice ?? selectedVariation.price)}
              </p>
              {selectedVariation.salePrice && selectedVariation.salePrice < selectedVariation.price && (
                <p className="text-sm text-muted-foreground line-through">
                  {formatCurrency(selectedVariation.price)}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                ou {formatCurrency((selectedVariation.salePrice ?? selectedVariation.price) * 0.9)} no PIX (10% off)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Shipping Calculator */}
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
            onClick={() => handleCalculate()}
            disabled={loading || cep.replace(/\D/g, '').length !== 8 || needsVariation}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Calcular'}
          </button>
        </div>

        {needsVariation && cep.replace(/\D/g, '').length === 8 && (
          <p className="text-xs text-amber-600 mt-2">Selecione uma escala acima para calcular o frete</p>
        )}

        {error && <p className="text-xs text-destructive mt-2">{error}</p>}

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
              <div
                key={quote.serviceId}
                className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3 text-sm items-center"
              >
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

        {hasSearched && !loading && quotes.length === 0 && !error && (
          <p className="text-xs text-muted-foreground mt-2">
            Nenhuma opcao de frete para este CEP.
          </p>
        )}
      </div>
    </>
  );
}
