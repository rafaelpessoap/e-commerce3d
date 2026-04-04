'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Copy, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';

interface PixPaymentProps {
  orderId: string;
  qrCodeBase64: string;
  copiaECola: string;
  expiresAt: string;
  amount: number;
}

export function PixPayment({
  orderId,
  qrCodeBase64,
  copiaECola,
  expiresAt,
  amount,
}: PixPaymentProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<string>('PENDING');
  const [timeLeft, setTimeLeft] = useState('');

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const expires = new Date(expiresAt).getTime();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeft('Expirado');
        clearInterval(interval);
        return;
      }

      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  // Poll payment status
  const pollStatus = useCallback(async () => {
    try {
      const { data } = await api.get(`/payments/${orderId}/status`);
      const payment = data.data;
      if (payment?.status === 'APPROVED') {
        setStatus('APPROVED');
        setTimeout(() => router.push(`/pedido/confirmacao/${orderId}`), 1500);
      } else if (payment?.status === 'FAILED' || payment?.status === 'CANCELLED') {
        setStatus(payment.status);
      }
    } catch {
      // Silent — polling will retry
    }
  }, [orderId, router]);

  useEffect(() => {
    if (status !== 'PENDING') return;
    const interval = setInterval(pollStatus, 5000);
    return () => clearInterval(interval);
  }, [status, pollStatus]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(copiaECola);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = copiaECola;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }

  if (status === 'APPROVED') {
    return (
      <div className="text-center py-8">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-green-700 mb-2">Pagamento Confirmado!</h2>
        <p className="text-muted-foreground">Redirecionando para a confirmacao do pedido...</p>
        <Loader2 className="h-5 w-5 animate-spin mx-auto mt-4" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold mb-2">Pague com PIX</h2>
        <p className="text-muted-foreground text-sm">
          Escaneie o QR Code ou copie o codigo para pagar
        </p>
      </div>

      {/* QR Code */}
      {qrCodeBase64 && (
        <div className="flex justify-center">
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <img
              src={`data:image/png;base64,${qrCodeBase64}`}
              alt="QR Code PIX"
              className="w-64 h-64"
            />
          </div>
        </div>
      )}

      {/* Copia e Cola */}
      <div className="space-y-2">
        <label className="text-sm font-medium">PIX Copia e Cola</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={copiaECola}
            readOnly
            className="flex-1 rounded-md border border-input bg-muted px-3 py-2 text-xs font-mono truncate"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="shrink-0"
          >
            {copied ? (
              <><CheckCircle className="h-4 w-4 mr-1 text-green-500" /> Copiado</>
            ) : (
              <><Copy className="h-4 w-4 mr-1" /> Copiar</>
            )}
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Valor</span>
          <span className="font-bold">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> Expira em
          </span>
          <span className={`font-mono font-bold ${timeLeft === 'Expirado' ? 'text-destructive' : 'text-amber-600'}`}>
            {timeLeft || 'Calculando...'}
          </span>
        </div>
      </div>

      {/* Polling indicator */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Aguardando confirmacao do pagamento...
      </div>
    </div>
  );
}
