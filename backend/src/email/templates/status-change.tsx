import * as React from 'react';
import { Text, Section, Button } from '@react-email/components';
import { EmailLayout } from './layout';

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Confirmado',
  PROCESSING: 'Em Produção',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
  RETURNED: 'Devolvido',
};

const STATUS_DESCRIPTIONS: Record<string, string> = {
  CONFIRMED: 'Seu pagamento foi confirmado e seu pedido está na fila de produção.',
  PROCESSING: 'Suas miniaturas estão sendo produzidas com carinho!',
  SHIPPED: 'Seu pedido foi despachado e está a caminho!',
  DELIVERED: 'Seu pedido foi entregue. Esperamos que goste!',
  CANCELLED: 'Seu pedido foi cancelado. Se tiver dúvidas, entre em contato.',
  RETURNED: 'Seu pedido foi devolvido. Entraremos em contato sobre o reembolso.',
};

interface StatusChangeEmailProps {
  customerName: string;
  orderNumber: string;
  newStatus: string;
  trackingCode?: string;
}

const STORE_URL = process.env.FRONTEND_URL ?? 'https://elitepinup3d.com';

export function StatusChangeEmail({
  customerName,
  orderNumber,
  newStatus,
  trackingCode,
}: StatusChangeEmailProps) {
  const label = STATUS_LABELS[newStatus] ?? newStatus;
  const description = STATUS_DESCRIPTIONS[newStatus] ?? '';

  return (
    <EmailLayout preview={`Pedido ${orderNumber} — ${label}`}>
      <Text style={heading}>Atualização do Pedido</Text>
      <Text style={paragraph}>
        Olá, {customerName}! Seu pedido <strong>{orderNumber}</strong> foi
        atualizado.
      </Text>

      <Section style={statusBadgeSection}>
        <Text style={statusBadge}>{label}</Text>
      </Section>

      {description && <Text style={paragraph}>{description}</Text>}

      {newStatus === 'SHIPPED' && trackingCode && (
        <Section style={trackingSection}>
          <Text style={trackingLabel}>Código de rastreio</Text>
          <Text style={trackingCodeStyle}>{trackingCode}</Text>
        </Section>
      )}

      <Section style={buttonSection}>
        <Button
          style={button}
          href={`${STORE_URL}/minha-conta/pedidos`}
        >
          Ver Detalhes do Pedido
        </Button>
      </Section>
    </EmailLayout>
  );
}

const heading: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#1a1a2e',
  margin: '0 0 16px',
};

const paragraph: React.CSSProperties = {
  fontSize: '16px',
  color: '#525f7f',
  lineHeight: '24px',
  margin: '0 0 16px',
};

const statusBadgeSection: React.CSSProperties = {
  textAlign: 'center' as const,
  margin: '16px 0',
};

const statusBadge: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#e0a526',
  color: '#1a1a2e',
  fontWeight: 'bold',
  fontSize: '18px',
  padding: '8px 24px',
  borderRadius: '20px',
};

const trackingSection: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  borderRadius: '6px',
  padding: '12px 16px',
  margin: '16px 0',
};

const trackingLabel: React.CSSProperties = {
  fontSize: '12px',
  color: '#8898aa',
  margin: '0 0 4px',
  textTransform: 'uppercase' as const,
};

const trackingCodeStyle: React.CSSProperties = {
  fontSize: '20px',
  color: '#1a1a2e',
  fontWeight: 'bold',
  fontFamily: 'monospace',
  margin: '0',
};

const buttonSection: React.CSSProperties = {
  textAlign: 'center' as const,
  margin: '24px 0',
};

const button: React.CSSProperties = {
  backgroundColor: '#e0a526',
  color: '#1a1a2e',
  fontWeight: 'bold',
  padding: '12px 24px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontSize: '16px',
};
