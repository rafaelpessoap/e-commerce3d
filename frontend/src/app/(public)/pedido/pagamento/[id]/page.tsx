'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PixPayment } from '@/components/payment/pix-payment';
import { BoletoPayment } from '@/components/payment/boleto-payment';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/constants';

interface PaymentData {
  id: string;
  orderId: string;
  method: string;
  status: string;
  amount: number;
  discount: number;
  pixQrCode?: string;
  pixCopiaECola?: string;
  boletoUrl?: string;
  boletoBarcode?: string;
  expiresAt?: string;
  cardLastFour?: string;
  installments?: number;
  paidAt?: string;
}

export default function PaymentPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchPayment() {
      try {
        const { data } = await api.get(`/payments/${orderId}/status`);
        const p = data.data;
        if (!p) {
          setError('Pagamento nao encontrado.');
          return;
        }
        setPayment(p);

        // Cartão aprovado → vai direto para confirmação
        if (p.method === 'credit_card' && p.status === 'APPROVED') {
          router.replace(`/pedido/confirmacao/${orderId}`);
        }
      } catch {
        setError('Erro ao carregar dados do pagamento.');
      } finally {
        setLoading(false);
      }
    }

    fetchPayment();
  }, [orderId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Erro</h2>
        <p className="text-muted-foreground">{error || 'Pagamento nao encontrado.'}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/')}>
          Voltar para a loja
        </Button>
      </div>
    );
  }

  // Credit card rejected
  if (payment.method === 'credit_card' && payment.status === 'FAILED') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Pagamento Recusado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O pagamento com cartao final {payment.cardLastFour ?? '****'} foi recusado.
              Por favor, tente novamente com outro cartao ou escolha outro metodo de pagamento.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => router.push('/checkout')}>
                Voltar ao checkout
              </Button>
              <Button onClick={() => router.push('/')}>
                Continuar comprando
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pagamento</CardTitle>
          <p className="text-sm text-muted-foreground">
            Valor: {formatCurrency(payment.amount)}
            {payment.discount > 0 && (
              <span className="text-primary ml-2">
                (desconto de {formatCurrency(payment.discount)})
              </span>
            )}
          </p>
        </CardHeader>
        <CardContent>
          {payment.method === 'pix' && payment.pixQrCode && payment.pixCopiaECola && (
            <PixPayment
              orderId={orderId}
              qrCodeBase64={payment.pixQrCode}
              copiaECola={payment.pixCopiaECola}
              expiresAt={payment.expiresAt ?? ''}
              amount={payment.amount}
            />
          )}

          {payment.method === 'boleto' && (
            <BoletoPayment
              orderId={orderId}
              boletoUrl={payment.boletoUrl ?? ''}
              barcode={payment.boletoBarcode ?? ''}
              expiresAt={payment.expiresAt ?? ''}
              amount={payment.amount}
            />
          )}

          {payment.method === 'credit_card' && payment.status === 'PENDING' && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Processando pagamento...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
