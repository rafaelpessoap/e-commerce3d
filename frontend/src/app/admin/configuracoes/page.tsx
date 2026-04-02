'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SITE_NAME } from '@/lib/constants';

export default function AdminSettingsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Configurações</h1>

      <div className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader><CardTitle className="text-lg">Loja</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Nome:</span> {SITE_NAME}</p>
            <p><span className="text-muted-foreground">Backend:</span> {process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Descontos por Pagamento</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">PIX:</span> 10% de desconto</p>
            <p><span className="text-muted-foreground">Boleto:</span> 5% de desconto</p>
            <p><span className="text-muted-foreground">Cartão:</span> Sem desconto</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Produção</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Prazo:</span> 3 dias úteis após confirmação</p>
            <p><span className="text-muted-foreground">Escalas:</span> 28mm, 32mm, 54mm, 75mm</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
