'use client';

import { useState } from 'react';
import { Loader2, Truck, Package } from 'lucide-react';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/constants';

interface ShippingQuote {
  serviceId: number;
  name: string;
  company: string;
  price: number;
  deliveryDays: number;
  deliveryRange: { min: number; max: number };
}

export function ProductShipping({ productId }: { productId: string }) {
  const [cep, setCep] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quotes, setQuotes] = useState<ShippingQuote[]>([]);
  const [freeShipping, setFreeShipping] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  async function handleCalculate(cepValue?: string) {
    const cleaned = (cepValue ?? cep).replace(/\D/g, '');
    if (cleaned.length !== 8) {
      setError('CEP deve ter 8 digitos');
      return;
    }

    setLoading(true);
    setError('');
    setHasSearched(true);

    try {
      const { data } = await api.post('/shipping/quote', {
        zipCode: cleaned,
        products: [{ productId, quantity: 1 }],
      });

      const result = data.data;
      setQuotes(result.quotes);
      setFreeShipping(result.freeShipping);
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
          disabled={loading || cep.replace(/\D/g, '').length !== 8}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Calcular'}
        </button>
      </div>

      {error && <p className="text-xs text-destructive mt-2">{error}</p>}

      {freeShipping && hasSearched && (
        <div className="bg-green-50 text-green-700 border border-green-200 rounded-md px-3 py-2 text-sm flex items-center gap-2 mt-3">
          <Package className="h-4 w-4" />
          Frete gratis para este CEP!
        </div>
      )}

      {hasSearched && quotes.length > 0 && (
        <div className="space-y-2 mt-3">
          {quotes.map((quote) => (
            <div
              key={quote.serviceId}
              className="flex items-center justify-between border rounded-md px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium">{quote.name}</span>
                <span className="text-xs text-muted-foreground ml-1">({quote.company})</span>
                <p className="text-xs text-muted-foreground">
                  {quote.deliveryRange.min === quote.deliveryRange.max
                    ? `${quote.deliveryRange.min} dias uteis`
                    : `${quote.deliveryRange.min}-${quote.deliveryRange.max} dias uteis`}
                </p>
              </div>
              <div className="text-right">
                {freeShipping ? (
                  <div>
                    <span className="text-xs text-muted-foreground line-through">{formatCurrency(quote.price)}</span>
                    <span className="text-sm font-bold text-green-600 ml-1">Gratis</span>
                  </div>
                ) : (
                  <span className="font-bold">{formatCurrency(quote.price)}</span>
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
  );
}
