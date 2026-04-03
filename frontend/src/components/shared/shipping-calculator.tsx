'use client';

import { useState } from 'react';
import { Loader2, Truck, Package } from 'lucide-react';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/constants';

export interface ShippingQuote {
  serviceId: number;
  name: string;
  company: string;
  price: number;
  deliveryDays: number;
  deliveryRange: { min: number; max: number };
}

interface ShippingCalculatorProps {
  products: Array<{ productId: string; quantity: number }>;
  selectedQuote?: ShippingQuote | null;
  onSelectQuote: (quote: ShippingQuote) => void;
  onCepChange?: (cep: string) => void;
  compact?: boolean;
}

export function ShippingCalculator({
  products,
  selectedQuote,
  onSelectQuote,
  onCepChange,
  compact = false,
}: ShippingCalculatorProps) {
  const [cep, setCep] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quotes, setQuotes] = useState<ShippingQuote[]>([]);
  const [freeShipping, setFreeShipping] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  async function handleCalculate(cepValue?: string) {
    const cleaned = (cepValue ?? cep).replace(/\D/g, '');
    if (cleaned.length !== 8) {
      setError('CEP deve ter 8 dígitos');
      return;
    }

    setLoading(true);
    setError('');
    setHasSearched(true);

    try {
      const { data } = await api.post('/shipping/quote', {
        zipCode: cleaned,
        products,
      });

      const result = data.data;
      setQuotes(result.quotes);
      setFreeShipping(result.freeShipping);
      onCepChange?.(cleaned);

      // Auto-select cheapest if none selected
      if (result.quotes.length > 0 && !selectedQuote) {
        const cheapest = result.quotes.reduce(
          (min: ShippingQuote, q: ShippingQuote) =>
            q.price < min.price ? q : min,
          result.quotes[0],
        );
        onSelectQuote(
          result.freeShipping ? { ...cheapest, price: 0 } : cheapest,
        );
      }
    } catch {
      setError('Erro ao calcular frete. Verifique o CEP.');
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  }

  function handleCepInput(value: string) {
    const cleaned = value.replace(/\D/g, '');
    setCep(cleaned);
    if (cleaned.length === 8) {
      handleCalculate(cleaned);
    }
  }

  return (
    <div className="space-y-3">
      {/* CEP input */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Digite seu CEP"
          value={cep}
          onChange={(e) => handleCepInput(e.target.value)}
          maxLength={9}
          className={`rounded-md border border-input bg-background px-3 py-2 text-sm ${compact ? 'flex-1' : 'w-40'}`}
        />
        <button
          onClick={() => handleCalculate()}
          disabled={loading || cep.replace(/\D/g, '').length !== 8}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Calcular'
          )}
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Free shipping badge */}
      {freeShipping && hasSearched && (
        <div className="bg-green-50 text-green-700 border border-green-200 rounded-md px-3 py-2 text-sm flex items-center gap-2">
          <Package className="h-4 w-4" />
          Frete grátis disponível para este CEP!
        </div>
      )}

      {/* Quotes list */}
      {hasSearched && quotes.length > 0 && (
        <div className="space-y-2">
          {quotes.map((quote) => {
            const displayPrice = freeShipping ? 0 : quote.price;
            const isSelected =
              selectedQuote?.serviceId === quote.serviceId;

            return (
              <label
                key={quote.serviceId}
                className={`flex items-center justify-between border rounded-lg p-3 cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-muted-foreground/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="shipping"
                    checked={isSelected}
                    onChange={() =>
                      onSelectQuote({ ...quote, price: displayPrice })
                    }
                    className="accent-primary"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium text-sm">
                        {quote.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({quote.company})
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {quote.deliveryRange.min === quote.deliveryRange.max
                        ? `${quote.deliveryRange.min} dias úteis`
                        : `${quote.deliveryRange.min}-${quote.deliveryRange.max} dias úteis`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {freeShipping ? (
                    <div>
                      <span className="text-xs text-muted-foreground line-through">
                        {formatCurrency(quote.price)}
                      </span>
                      <span className="text-sm font-bold text-green-600 ml-1">
                        Grátis
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm font-bold">
                      {formatCurrency(quote.price)}
                    </span>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      )}

      {hasSearched && !loading && quotes.length === 0 && !error && (
        <p className="text-xs text-muted-foreground">
          Nenhuma opção de frete disponível para este CEP.
        </p>
      )}
    </div>
  );
}
