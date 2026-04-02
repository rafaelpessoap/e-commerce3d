import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Termos de Uso' };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold mb-6">Termos de Uso</h1>
      <div className="prose max-w-none text-muted-foreground">
        <p>Ao utilizar este site, você concorda com os seguintes termos e condições.</p>
        <h2>1. Uso do Site</h2>
        <p>O conteúdo deste site é destinado exclusivamente para uso pessoal e não comercial. É proibida a reprodução sem autorização.</p>
        <h2>2. Conta do Usuário</h2>
        <p>Você é responsável por manter a segurança da sua conta e senha. Notifique-nos imediatamente sobre qualquer uso não autorizado.</p>
        <h2>3. Produtos e Preços</h2>
        <p>Os preços podem ser alterados sem aviso prévio. Todas as transações são processadas em Reais (BRL).</p>
        <h2>4. Propriedade Intelectual</h2>
        <p>Todos os modelos 3D, imagens e conteúdo são de propriedade da loja ou licenciados de terceiros.</p>
      </div>
    </div>
  );
}
