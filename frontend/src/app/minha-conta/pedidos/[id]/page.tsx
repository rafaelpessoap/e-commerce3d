'use client';
import type { ApiRecord } from '@/types/api';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { StarRating } from '@/components/product/star-rating';
import { CheckCircle, Circle, Star } from 'lucide-react';
import { useState } from 'react';

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
          <div key={item.id} className="flex items-center justify-between text-sm">
            <span>
              {item.product?.name ?? 'Produto'} x{item.quantity}
            </span>
            <div className="flex items-center gap-3">
              <span className="font-medium">
                {formatCurrency(item.price * item.quantity)}
              </span>
              {data.status === 'DELIVERED' && (
                <ReviewButton productId={item.productId} productName={item.product?.name} orderId={data.id} />
              )}
            </div>
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

function ReviewButton({ productId, productName, orderId }: { productId: string; productName?: string; orderId: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit() {
    if (rating === 0) return;
    setSending(true);
    try {
      await api.post('/reviews', { productId, orderId, rating, comment: comment || undefined });
      setSent(true);
    } catch {
      // Pode já ter avaliado
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return <span className="text-xs text-muted-foreground">✅ Avaliado</span>;
  }

  return (
    <>
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setOpen(true)}>
        <Star className="h-3 w-3 mr-1" />Avaliar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Avaliar {productName ?? 'Produto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center">
              <StarRating rating={rating} size={32} interactive onChange={setRating} />
            </div>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Conte como foi sua experiência..." rows={3} />
            <p className="text-xs text-muted-foreground">Após aprovação, você receberá um cupom de 5% de desconto.</p>
            <Button onClick={handleSubmit} disabled={rating === 0 || sending} className="w-full">
              {sending ? 'Enviando...' : 'Enviar Avaliação'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
