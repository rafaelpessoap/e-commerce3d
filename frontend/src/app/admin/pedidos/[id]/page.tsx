'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/constants';
import { useState } from 'react';

const NEXT_STATUS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['RETURNED'],
};

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [newStatus, setNewStatus] = useState('');

  const { data: order, isLoading } = useQuery({
    queryKey: ['admin', 'order', id],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${id}`);
      return data.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: (status: string) =>
      api.put(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'order', id] });
      setNewStatus('');
    },
  });

  if (isLoading) {
    return <p className="text-muted-foreground">Carregando...</p>;
  }

  if (!order) {
    return <p className="text-muted-foreground">Pedido não encontrado.</p>;
  }

  const possibleTransitions = NEXT_STATUS[order.status] ?? [];

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{order.number}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(order.createdAt).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        <Badge className="text-lg px-4 py-1">{order.status}</Badge>
      </div>

      {/* Update status */}
      {possibleTransitions.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Atualizar Status</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Select value={newStatus} onValueChange={(v) => setNewStatus(v ?? '')}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Novo status" />
              </SelectTrigger>
              <SelectContent>
                {possibleTransitions.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => updateMutation.mutate(newStatus)}
              disabled={!newStatus || updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Atualizando...' : 'Atualizar'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Items */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Itens</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {order.items?.map((item: any) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>{item.product?.name ?? 'Produto'} x{item.quantity}</span>
              <span className="font-medium">
                {formatCurrency(item.price * item.quantity)}
              </span>
            </div>
          ))}
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-sm text-primary">
              <span>Desconto</span>
              <span>-{formatCurrency(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      {order.statusHistory?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {order.statusHistory.map((entry: any, i: number) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div>
                    <p className="font-medium">
                      {entry.fromStatus ?? '—'} → {entry.toStatus}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
