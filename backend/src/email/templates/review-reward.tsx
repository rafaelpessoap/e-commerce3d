import * as React from 'react';
import { Text, Section, Button } from '@react-email/components';
import { EmailLayout } from './layout';

interface ReviewRewardEmailProps {
  customerName: string;
  productName: string;
  couponCode: string;
  discountPercent: number;
}

const STORE_URL = process.env.FRONTEND_URL ?? 'https://elitepinup3d.com';

export function ReviewRewardEmail({
  customerName,
  productName,
  couponCode,
  discountPercent,
}: ReviewRewardEmailProps) {
  return (
    <EmailLayout preview={`Você ganhou ${discountPercent}% de desconto!`}>
      <Text style={heading}>Obrigado pela sua avaliação!</Text>
      <Text style={paragraph}>
        Olá, {customerName}! Sua avaliação do produto{' '}
        <strong>{productName}</strong> foi aprovada.
      </Text>
      <Text style={paragraph}>
        Como agradecimento, aqui está um cupom de{' '}
        <strong>{discountPercent}%</strong> de desconto para sua próxima compra:
      </Text>

      <Section style={couponSection}>
        <Text style={couponCodeStyle}>{couponCode}</Text>
      </Section>

      <Section style={buttonSection}>
        <Button style={button} href={`${STORE_URL}/produtos`}>
          Usar Meu Cupom
        </Button>
      </Section>

      <Text style={finePrint}>
        O cupom é válido para uma única utilização e não pode ser combinado com
        outras promoções.
      </Text>
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

const couponSection: React.CSSProperties = {
  textAlign: 'center' as const,
  margin: '24px 0',
  backgroundColor: '#1a1a2e',
  borderRadius: '8px',
  padding: '20px',
};

const couponCodeStyle: React.CSSProperties = {
  color: '#e0a526',
  fontSize: '28px',
  fontWeight: 'bold',
  fontFamily: 'monospace',
  letterSpacing: '2px',
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

const finePrint: React.CSSProperties = {
  fontSize: '12px',
  color: '#8898aa',
  lineHeight: '18px',
  margin: '16px 0 0',
};
