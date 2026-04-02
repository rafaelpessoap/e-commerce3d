'use client';

import { useState } from 'react';
import { Search, CheckCircle, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';

const STATUS_ORDER = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  PROCESSING: 'Em Produção',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
};

export default function TrackingPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOrder(null);
    setLoading(true);

    try {
      const { data } = await api.get(`/orders/track/${orderNumber.toUpperCase()}`);
      setOrder(data);
    } catch {
      setError('Pedido não encontrado. Verifique o número e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const currentIndex = order ? STATUS_ORDER.indexOf(order.status) : -1;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold mb-2">Rastreamento de Pedido</h1>
      <p className="text-muted-foreground mb-8">
        Informe o número do pedido para acompanhar o status.
      </p>

      <form onSubmit={handleSearch} className="flex gap-2 mb-8">
        <div className="flex-1 space-y-2">
          <Label htmlFor="orderNumber">Número do Pedido</Label>
          <Input
            id="orderNumber"
            placeholder="ORD-20260402-ABC123"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="self-end" disabled={loading}>
          <Search className="h-4 w-4 mr-2" />
          {loading ? 'Buscando...' : 'Rastrear'}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {order && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-mono">{order.number}</CardTitle>
              <Badge>{STATUS_LABELS[order.status] ?? order.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Pedido em {new Date(order.createdAt).toLocaleDateString('pt-BR')}
            </p>
          </CardHeader>
          <CardContent>
            {/* Timeline */}
            <div className="flex items-center gap-1 mb-6">
              {STATUS_ORDER.map((status, i) => {
                const reached = i <= currentIndex;
                return (
                  <div key={status} className="flex items-center gap-1 flex-1">
                    {reached ? (
                      <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/30 shrink-0" />
                    )}
                    <span className={`text-xs ${reached ? 'font-medium' : 'text-muted-foreground'}`}>
                      {STATUS_LABELS[status]}
                    </span>
                    {i < STATUS_ORDER.length - 1 && (
                      <div className={`flex-1 h-0.5 ${i < currentIndex ? 'bg-primary' : 'bg-muted'}`} />
                    )}
                  </div>
                );
              })}
            </div>

            {order.trackingCode && (
              <p className="text-sm">
                Código de rastreio: <span className="font-mono font-medium">{order.trackingCode}</span>
              </p>
            )}

            {/* History */}
            {order.statusHistory?.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-medium">Histórico</h3>
                {order.statusHistory.map((entry: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div>
                      <p>{STATUS_LABELS[entry.toStatus] ?? entry.toStatus}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
