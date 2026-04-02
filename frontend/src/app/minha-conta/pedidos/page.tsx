'use client';
import type { ApiRecord } from '@/types/api';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label: 'Pendente', variant: 'outline' },
  CONFIRMED: { label: 'Confirmado', variant: 'secondary' },
  PROCESSING: { label: 'Em Produção', variant: 'default' },
  SHIPPED: { label: 'Enviado', variant: 'default' },
  DELIVERED: { label: 'Entregue', variant: 'secondary' },
  CANCELLED: { label: 'Cancelado', variant: 'destructive' },
  RETURNED: { label: 'Devolvido', variant: 'destructive' },
};

export default function OrdersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-orders'],
    queryFn: async () => {
      const { data } = await api.get('/orders', { params: { perPage: 50 } });
      return data;
    },
  });

  if (isLoading) {
    return <p className="text-muted-foreground">Carregando pedidos...</p>;
  }

  const orders = data?.data ?? [];

  if (orders.length === 0) {
    return (
      <EmptyState
        title="Nenhum pedido"
        description="Você ainda não fez nenhum pedido."
      />
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Meus Pedidos</h1>

      <div className="space-y-4">
        {orders.map((order: ApiRecord) => {
          const status = STATUS_LABELS[order.status] ?? { label: order.status, variant: 'outline' as const };

          return (
            <Link
              key={order.id}
              href={`/minha-conta/pedidos/${order.id}`}
              className="flex items-center justify-between border rounded-lg p-4 hover:shadow-sm transition-shadow"
            >
              <div>
                <p className="font-medium text-sm font-mono">{order.number}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <Badge variant={status.variant}>{status.label}</Badge>
                <span className="font-bold text-sm">
                  {formatCurrency(order.total)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
