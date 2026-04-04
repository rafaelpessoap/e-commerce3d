'use client';

import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react';
import { Loader2 } from 'lucide-react';

const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? '';

// Init SDK once at module level (not in effect)
let mpInitialized = false;
if (typeof window !== 'undefined' && MP_PUBLIC_KEY && !mpInitialized) {
  initMercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' });
  mpInitialized = true;
}

interface CardPaymentFormProps {
  amount: number;
  onSubmit: (data: {
    token: string;
    installments: number;
    paymentMethodId: string;
    issuerId: string;
  }) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

export function CardPaymentForm({
  amount,
  onSubmit,
  onError,
  disabled,
}: CardPaymentFormProps) {
  if (!MP_PUBLIC_KEY || !mpInitialized) {
    return (
      <div className="text-sm text-destructive p-4 border rounded-lg">
        Pagamento com cartao indisponivel no momento.
      </div>
    );
  }

  return (
    <div className={disabled ? 'opacity-50 pointer-events-none' : ''}>
      <CardPayment
        initialization={{ amount }}
        onSubmit={async (formData) => {
          try {
            onSubmit({
              token: formData.token,
              installments: formData.installments,
              paymentMethodId: formData.payment_method_id,
              issuerId: formData.issuer_id,
            });
          } catch {
            onError('Erro ao processar cartao. Tente novamente.');
          }
        }}
        onError={(error) => {
          console.error('MP CardPayment error:', error);
          onError('Erro no formulario de pagamento. Verifique os dados.');
        }}
        customization={{
          paymentMethods: {
            maxInstallments: 12,
            minInstallments: 1,
          },
          visual: {
            style: {
              theme: 'default',
            },
          },
        }}
      />
    </div>
  );
}
