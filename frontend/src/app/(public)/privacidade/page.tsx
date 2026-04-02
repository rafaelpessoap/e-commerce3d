import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Política de Privacidade' };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold mb-6">Política de Privacidade</h1>
      <div className="prose max-w-none text-muted-foreground">
        <p>Sua privacidade é importante para nós. Esta política explica como coletamos, usamos e protegemos seus dados.</p>
        <h2>1. Dados Coletados</h2>
        <p>Coletamos nome, email, endereço de entrega e dados de pagamento necessários para processar pedidos.</p>
        <h2>2. Uso dos Dados</h2>
        <p>Seus dados são usados exclusivamente para: processar pedidos, enviar notificações de status, melhorar nossos serviços.</p>
        <h2>3. Proteção</h2>
        <p>Senhas são armazenadas com hash bcrypt. Dados de pagamento são processados pelo Mercado Pago e nunca armazenados em nossos servidores.</p>
        <h2>4. Cookies</h2>
        <p>Utilizamos cookies essenciais para autenticação e carrinho de compras. Não utilizamos cookies de rastreamento de terceiros.</p>
      </div>
    </div>
  );
}
