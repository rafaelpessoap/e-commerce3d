import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Trocas e Devoluções' };

export default function ReturnsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold mb-6">Trocas e Devoluções</h1>
      <div className="prose max-w-none text-muted-foreground">
        <h2>Defeito de Impressão</h2>
        <p>Se sua miniatura chegou com defeito de impressão (camadas visíveis, partes faltando, quebra durante envio), reenviamos sem custo adicional. Envie fotos do defeito para nosso suporte.</p>
        <h2>Prazo</h2>
        <p>Você tem até 7 dias corridos após o recebimento para solicitar troca ou devolução.</p>
        <h2>Como Solicitar</h2>
        <p>Entre em contato pelo email ou página de contato informando o número do pedido e fotos do produto.</p>
        <h2>Reembolso</h2>
        <p>Reembolsos são processados em até 10 dias úteis após a aprovação, pelo mesmo método de pagamento utilizado na compra.</p>
      </div>
    </div>
  );
}
