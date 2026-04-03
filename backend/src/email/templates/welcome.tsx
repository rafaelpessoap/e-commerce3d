import * as React from 'react';
import { Text, Button, Section } from '@react-email/components';
import { EmailLayout } from './layout';

interface WelcomeEmailProps {
  name: string;
}

const STORE_URL = process.env.FRONTEND_URL ?? 'https://elitepinup3d.com';

export function WelcomeEmail({ name }: WelcomeEmailProps) {
  return (
    <EmailLayout preview={`Bem-vindo à ElitePinup3D, ${name}!`}>
      <Text style={heading}>Bem-vindo, {name}!</Text>
      <Text style={paragraph}>
        Sua conta foi criada com sucesso. Agora você pode explorar nosso
        catálogo exclusivo de miniaturas 3D, acompanhar seus pedidos e muito
        mais.
      </Text>
      <Section style={buttonSection}>
        <Button style={button} href={`${STORE_URL}/produtos`}>
          Explorar Catálogo
        </Button>
      </Section>
      <Text style={paragraph}>
        Se tiver alguma dúvida, responda este email que teremos prazer em
        ajudar.
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
