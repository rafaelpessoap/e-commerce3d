'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { api } from '@/lib/api-client';

interface AuditEntry {
  id: string;
  productId: string;
  variationId?: string;
  variation?: { name: string } | null;
  quantityBefore: number;
  quantityAfter: number;
  delta: number;
  reservedBefore?: number;
  reservedAfter?: number;
  reason: string;
  referenceId?: string;
  createdAt: string;
}

const REASON_LABELS: Record<string, string> = {
  ORDER_RESERVED: 'Pedido criado (reserva)',
  ORDER_CONFIRMED: 'Pagamento confirmado',
  ORDER_CANCELLED: 'Pedido cancelado',
  PAYMENT_FAILED: 'Pagamento falhou',
  ADMIN_ADJUSTMENT: 'Ajuste manual',
};

export function StockAuditLog({ productId }: { productId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['stock-log', productId],
    queryFn: async () => {
      const { data } = await api.get(`/stock/${productId}/log`);
      return (data.data ?? data) as AuditEntry[];
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando historico...</p>;
  }

  const logs = data ?? [];

  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma movimentacao de estoque registrada.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground mb-3">
        Ultimas {logs.length} movimentacoes (maximo 30)
      </p>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2 font-medium">Data</th>
              <th className="text-left p-2 font-medium">Variacao</th>
              <th className="text-left p-2 font-medium">Motivo</th>
              <th className="text-right p-2 font-medium">Antes</th>
              <th className="text-center p-2 font-medium">Delta</th>
              <th className="text-right p-2 font-medium">Depois</th>
              <th className="text-left p-2 font-medium">Ref</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t">
                <td className="p-2 text-muted-foreground whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="p-2 text-xs text-muted-foreground">
                  {log.variation?.name ?? (log.variationId ? log.variationId.slice(0, 8) : 'Produto')}
                </td>
                <td className="p-2">
                  {REASON_LABELS[log.reason] ?? log.reason}
                </td>
                <td className="p-2 text-right font-mono">
                  {log.quantityBefore}
                </td>
                <td className="p-2 text-center">
                  <span
                    className={`inline-flex items-center gap-0.5 font-mono font-medium ${
                      log.delta > 0
                        ? 'text-green-600'
                        : log.delta < 0
                          ? 'text-red-600'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {log.delta > 0 ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : log.delta < 0 ? (
                      <ArrowDown className="h-3 w-3" />
                    ) : (
                      <Minus className="h-3 w-3" />
                    )}
                    {log.delta > 0 ? `+${log.delta}` : log.delta === 0 ? 'reserva' : log.delta}
                  </span>
                </td>
                <td className="p-2 text-right font-mono">
                  {log.quantityAfter}
                </td>
                <td className="p-2 text-muted-foreground text-xs truncate max-w-[120px]">
                  {log.referenceId?.slice(0, 12) ?? '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
