'use client';
import type { ApiRecord } from '@/types/api';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Circle } from 'lucide-react';

const STATUS_ORDER = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${id}`);
      return data.data;
    },
  });

  if (isLoading) {
    return <p className="text-muted-foreground">Carregando...</p>;
  }

  if (!data) {
    return <p className="text-muted-foreground">Pedido não encontrado.</p>;
  }

  const currentIndex = STATUS_ORDER.indexOf(data.status);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Pedido {data.number}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(data.createdAt).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <Badge>{data.status}</Badge>
      </div>

      {/* Timeline */}
      <div className="mb-8">
        <h2 className="text-sm font-medium mb-4">Status</h2>
        <div className="flex items-center gap-1">
          {STATUS_ORDER.map((status, i) => {
            const reached = i <= currentIndex;
            return (
              <div key={status} className="flex items-center gap-1 flex-1">
                {reached ? (
                  <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground/30 shrink-0" />
                )}
                <span
                  className={`text-xs ${reached ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
                >
                  {status === 'PENDING'
                    ? 'Pendente'
                    : status === 'CONFIRMED'
                      ? 'Confirmado'
                      : status === 'PROCESSING'
                        ? 'Produção'
                        : status === 'SHIPPED'
                          ? 'Enviado'
                          : 'Entregue'}
                </span>
                {i < STATUS_ORDER.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 ${i < currentIndex ? 'bg-primary' : 'bg-muted'}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Separator className="my-6" />

      {/* Items */}
      <h2 className="text-sm font-medium mb-4">Itens</h2>
      <div className="space-y-3">
        {data.items?.map((item: ApiRecord) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span>
              {item.product?.name ?? 'Produto'} x{item.quantity}
            </span>
            <span className="font-medium">
              {formatCurrency(item.price * item.quantity)}
            </span>
          </div>
        ))}
      </div>

      <Separator className="my-6" />

      {/* Totals */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatCurrency(data.subtotal)}</span>
        </div>
        {data.shipping > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Frete</span>
            <span>{formatCurrency(data.shipping)}</span>
          </div>
        )}
        {data.discount > 0 && (
          <div className="flex justify-between text-sm text-primary">
            <span>Desconto</span>
            <span>-{formatCurrency(data.discount)}</span>
          </div>
        )}
        <Separator />
        <div className="flex justify-between font-bold text-lg">
          <span>Total</span>
          <span>{formatCurrency(data.total)}</span>
        </div>
      </div>
    </div>
  );
}
