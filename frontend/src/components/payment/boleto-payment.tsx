'use client';

import { useState } from 'react';
import { Copy, CheckCircle, ExternalLink, FileText, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BoletoPaymentProps {
  orderId: string;
  boletoUrl: string;
  barcode: string;
  expiresAt: string;
  amount: number;
}

export function BoletoPayment({
  boletoUrl,
  barcode,
  expiresAt,
  amount,
}: BoletoPaymentProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopyBarcode() {
    try {
      await navigator.clipboard.writeText(barcode);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = barcode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }

  const expirationDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';

  return (
    <div className="space-y-6">
      <div className="text-center">
        <FileText className="h-12 w-12 text-primary mx-auto mb-3" />
        <h2 className="text-xl font-bold mb-2">Boleto Gerado</h2>
        <p className="text-muted-foreground text-sm">
          O boleto foi gerado com sucesso. Pague ate a data de vencimento.
        </p>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {boletoUrl && (
          <Button
            className="w-full"
            onClick={() => window.open(boletoUrl, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir Boleto
          </Button>
        )}

        {barcode && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Codigo de Barras</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={barcode}
                readOnly
                className="flex-1 rounded-md border border-input bg-muted px-3 py-2 text-xs font-mono truncate"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyBarcode}
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
        )}
      </div>

      {/* Info */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Valor</span>
          <span className="font-bold">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)}
          </span>
        </div>
        {expirationDate && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Vencimento
            </span>
            <span className="font-medium">{expirationDate}</span>
          </div>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
        Apos o pagamento, o pedido sera confirmado automaticamente em ate 2 dias uteis.
      </div>
    </div>
  );
}
