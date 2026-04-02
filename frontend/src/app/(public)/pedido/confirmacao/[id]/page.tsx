import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrderConfirmationPage({ params }: Props) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
      <h1 className="text-3xl font-bold mb-2">Pedido Confirmado!</h1>
      <p className="text-muted-foreground mb-2">
        Seu pedido foi recebido com sucesso.
      </p>
      <p className="text-sm text-muted-foreground mb-8">
        ID do pedido: <span className="font-mono">{id}</span>
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href={ROUTES.orders}>
          <Button>Ver Meus Pedidos</Button>
        </Link>
        <Link href={ROUTES.home}>
          <Button variant="outline">Continuar Comprando</Button>
        </Link>
      </div>
    </div>
  );
}
