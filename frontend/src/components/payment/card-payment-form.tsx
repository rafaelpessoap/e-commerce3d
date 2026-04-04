'use client';

import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? '';

export interface CardPaymentFormRef {
  tokenize: () => Promise<{
    token: string;
    installments: number;
    paymentMethodId: string;
  } | null>;
}

interface CardPaymentFormProps {
  amount: number;
}

interface InstallmentOption {
  installments: number;
  installment_amount: number;
  total_amount: number;
  recommended_message: string;
}

export const CardPaymentForm = forwardRef<CardPaymentFormRef, CardPaymentFormProps>(
  function CardPaymentForm({ amount }, ref) {
  const [cardNumber, setCardNumber] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [cvv, setCvv] = useState('');
  const [holderName, setHolderName] = useState('');
  const [holderCpf, setHolderCpf] = useState('');
  const [installmentsList, setInstallmentsList] = useState<InstallmentOption[]>([]);
  const [selectedInstallments, setSelectedInstallments] = useState(1);
  const [paymentMethodId, setPaymentMethodId] = useState('');
  // MercadoPago JS SDK is untyped — suppress any warnings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mpRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !MP_PUBLIC_KEY) return;

    async function loadMP() {
      try {
        const { loadMercadoPago } = await import('@mercadopago/sdk-js');
        await loadMercadoPago();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mpRef.current = new (window as any).MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' });
      } catch (err) {
        console.error('Failed to load MercadoPago SDK:', err);
      }
    }

    loadMP();
  }, []);

  useImperativeHandle(ref, () => ({
    async tokenize() {
      if (!mpRef.current) {
        throw new Error('SDK de pagamento nao carregado. Recarregue a pagina.');
      }

      const cleanedCard = cardNumber.replace(/\D/g, '');
      if (cleanedCard.length < 13) throw new Error('Numero do cartao invalido');
      if (!expMonth || !expYear) throw new Error('Preencha a validade do cartao');
      if (!cvv || cvv.length < 3) throw new Error('CVV invalido');
      if (!holderName.trim()) throw new Error('Preencha o nome no cartao');

      const token = await mpRef.current.createCardToken({
        cardNumber: cleanedCard,
        cardholderName: holderName,
        cardExpirationMonth: expMonth,
        cardExpirationYear: `20${expYear}`,
        securityCode: cvv,
        identificationType: 'CPF',
        identificationNumber: holderCpf.replace(/\D/g, ''),
      });

      if (!token?.id) {
        throw new Error('Erro ao processar cartao. Verifique os dados.');
      }

      return {
        token: token.id,
        installments: selectedInstallments,
        paymentMethodId: paymentMethodId || 'visa',
      };
    },
  }));

  if (!MP_PUBLIC_KEY) {
    return (
      <div className="text-sm text-destructive p-4 border rounded-lg">
        Pagamento com cartao indisponivel no momento.
      </div>
    );
  }

  async function handleCardNumberChange(value: string) {
    const cleaned = value.replace(/\D/g, '');
    let formatted = cleaned;
    if (cleaned.length > 12) {
      formatted = `${cleaned.slice(0, 4)} ${cleaned.slice(4, 8)} ${cleaned.slice(8, 12)} ${cleaned.slice(12, 16)}`;
    } else if (cleaned.length > 8) {
      formatted = `${cleaned.slice(0, 4)} ${cleaned.slice(4, 8)} ${cleaned.slice(8)}`;
    } else if (cleaned.length > 4) {
      formatted = `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
    }
    setCardNumber(formatted);

    if (cleaned.length >= 6 && mpRef.current) {
      try {
        const result = await mpRef.current.getInstallments({
          amount: String(amount),
          bin: cleaned.slice(0, 6),
        });
        if (result && result.length > 0) {
          setPaymentMethodId(result[0].payment_method_id ?? '');
          setInstallmentsList(result[0].payer_costs ?? []);
        }
      } catch {
        // Silent
      }
    }
  }

  return (
    <div className="space-y-4 border rounded-lg p-4">
      <div className="space-y-2">
        <Label>Numero do cartao</Label>
        <Input
          placeholder="0000 0000 0000 0000"
          value={cardNumber}
          onChange={(e) => handleCardNumberChange(e.target.value)}
          maxLength={19}
          className="font-mono"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>Mes</Label>
          <Input
            placeholder="MM"
            value={expMonth}
            onChange={(e) => setExpMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
            maxLength={2}
          />
        </div>
        <div className="space-y-2">
          <Label>Ano</Label>
          <Input
            placeholder="AA"
            value={expYear}
            onChange={(e) => setExpYear(e.target.value.replace(/\D/g, '').slice(0, 2))}
            maxLength={2}
          />
        </div>
        <div className="space-y-2">
          <Label>CVV</Label>
          <Input
            placeholder="123"
            value={cvv}
            onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
            maxLength={4}
            type="password"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Nome no cartao</Label>
        <Input
          placeholder="Como aparece no cartao"
          value={holderName}
          onChange={(e) => setHolderName(e.target.value.toUpperCase())}
        />
      </div>

      <div className="space-y-2">
        <Label>CPF do titular</Label>
        <Input
          placeholder="000.000.000-00"
          value={holderCpf}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
            let formatted = digits;
            if (digits.length > 9) formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
            else if (digits.length > 6) formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
            else if (digits.length > 3) formatted = `${digits.slice(0, 3)}.${digits.slice(3)}`;
            setHolderCpf(formatted);
          }}
          maxLength={14}
        />
      </div>

      {installmentsList.length > 0 && (
        <div className="space-y-2">
          <Label>Parcelas</Label>
          <select
            value={selectedInstallments}
            onChange={(e) => setSelectedInstallments(parseInt(e.target.value, 10))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {installmentsList.map((opt) => (
              <option key={opt.installments} value={opt.installments}>
                {opt.recommended_message || `${opt.installments}x de R$${opt.installment_amount.toFixed(2)}`}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
});
