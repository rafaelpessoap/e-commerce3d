import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'FAQ' };

const FAQS = [
  { q: 'Qual o prazo de produção?', a: 'O prazo de produção é de 3 dias úteis após a confirmação do pagamento.' },
  { q: 'Quais escalas estão disponíveis?', a: 'Trabalhamos com 28mm (Heroic), 32mm, 54mm, 75mm e escalas customizadas sob consulta.' },
  { q: 'Posso pagar com PIX?', a: 'Sim! Pagamentos via PIX têm 10% de desconto aplicado automaticamente no checkout.' },
  { q: 'Como rastreio meu pedido?', a: 'Após o envio, você receberá o código de rastreio por email. Também pode acompanhar em Minha Conta > Pedidos.' },
  { q: 'Vocês fazem frete grátis?', a: 'Sim! Para algumas regiões, pedidos acima de um valor mínimo têm frete grátis. Consulte no checkout.' },
  { q: 'Como funciona a garantia?', a: 'Se a miniatura chegar com defeito de impressão, reenviamos sem custo. Consulte nossa política de trocas.' },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold mb-8">Perguntas Frequentes</h1>
      <div className="space-y-6">
        {FAQS.map((faq, i) => (
          <div key={i} className="border-b pb-6 last:border-0">
            <h3 className="font-semibold text-lg">{faq.q}</h3>
            <p className="text-muted-foreground mt-2">{faq.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
