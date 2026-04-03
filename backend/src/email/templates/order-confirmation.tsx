import * as React from 'react';
import { Text, Section, Row, Column, Hr, Button } from '@react-email/components';
import { EmailLayout } from './layout';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface OrderConfirmationEmailProps {
  orderNumber: string;
  customerName: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  paymentMethod: string;
}

const STORE_URL = process.env.FRONTEND_URL ?? 'https://elitepinup3d.com';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function OrderConfirmationEmail({
  orderNumber,
  customerName,
  items,
  subtotal,
  shipping,
  discount,
  total,
  paymentMethod,
}: OrderConfirmationEmailProps) {
  return (
    <EmailLayout preview={`Pedido ${orderNumber} confirmado!`}>
      <Text style={heading}>Pedido Confirmado!</Text>
      <Text style={paragraph}>
        Olá, {customerName}! Seu pedido <strong>{orderNumber}</strong> foi
        recebido com sucesso.
      </Text>

      {/* Items */}
      <Section style={tableSection}>
        <Text style={sectionTitle}>Itens do Pedido</Text>
        {items.map((item, index) => (
          <Row key={index} style={itemRow}>
            <Column style={itemName}>
              {item.name} × {item.quantity}
            </Column>
            <Column style={itemPrice}>
              R$ {formatCurrency(item.price * item.quantity)}
            </Column>
          </Row>
        ))}
      </Section>

      <Hr style={hrStyle} />

      {/* Totals */}
      <Section style={totalsSection}>
        <Row style={totalRow}>
          <Column style={totalLabel}>Subtotal</Column>
          <Column style={totalValue}>R$ {formatCurrency(subtotal)}</Column>
        </Row>
        <Row style={totalRow}>
          <Column style={totalLabel}>Frete</Column>
          <Column style={totalValue}>
            {shipping > 0 ? `R$ ${formatCurrency(shipping)}` : 'Grátis'}
          </Column>
        </Row>
        {discount > 0 && (
          <Row style={totalRow}>
            <Column style={totalLabel}>Desconto</Column>
            <Column style={{ ...totalValue, color: '#22c55e' }}>
              -R$ {formatCurrency(discount)}
            </Column>
          </Row>
        )}
        <Hr style={hrStyle} />
        <Row style={totalRow}>
          <Column style={{ ...totalLabel, fontWeight: 'bold', fontSize: '18px' }}>
            Total
          </Column>
          <Column style={{ ...totalValue, fontWeight: 'bold', fontSize: '18px' }}>
            R$ {formatCurrency(total)}
          </Column>
        </Row>
      </Section>

      {/* Payment method */}
      <Section style={infoSection}>
        <Text style={infoLabel}>Método de pagamento</Text>
        <Text style={infoValue}>{paymentMethod}</Text>
      </Section>

      <Section style={buttonSection}>
        <Button
          style={button}
          href={`${STORE_URL}/minha-conta/pedidos`}
        >
          Acompanhar Pedido
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

const sectionTitle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#8898aa',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 12px',
};

const tableSection: React.CSSProperties = {
  margin: '16px 0',
};

const itemRow: React.CSSProperties = {
  padding: '8px 0',
};

const itemName: React.CSSProperties = {
  fontSize: '14px',
  color: '#1a1a2e',
};

const itemPrice: React.CSSProperties = {
  fontSize: '14px',
  color: '#1a1a2e',
  textAlign: 'right' as const,
};

const hrStyle: React.CSSProperties = {
  borderColor: '#e6ebf1',
  margin: '12px 0',
};

const totalsSection: React.CSSProperties = {
  margin: '8px 0',
};

const totalRow: React.CSSProperties = {
  padding: '4px 0',
};

const totalLabel: React.CSSProperties = {
  fontSize: '14px',
  color: '#525f7f',
};

const totalValue: React.CSSProperties = {
  fontSize: '14px',
  color: '#1a1a2e',
  textAlign: 'right' as const,
};

const infoSection: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  borderRadius: '6px',
  padding: '12px 16px',
  margin: '16px 0',
};

const infoLabel: React.CSSProperties = {
  fontSize: '12px',
  color: '#8898aa',
  margin: '0 0 4px',
  textTransform: 'uppercase' as const,
};

const infoValue: React.CSSProperties = {
  fontSize: '16px',
  color: '#1a1a2e',
  fontWeight: 'bold',
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
