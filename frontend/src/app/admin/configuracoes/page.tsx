'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Save, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';

function extractError(err: unknown): string {
  const resp = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data;
  return resp?.error?.message ?? 'Erro desconhecido';
}

interface SettingsCardProps {
  title: string;
  fields: Array<{
    key: string;
    label: string;
    type?: string;
    placeholder?: string;
    suffix?: string;
  }>;
  values: Record<string, string>;
}

function SettingsCard({ title, fields, values }: SettingsCardProps) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Build initial values from server data
  const serverValues: Record<string, string> = {};
  for (const f of fields) {
    serverValues[f.key] = values[f.key] ?? '';
  }

  const [local, setLocal] = useState<Record<string, string>>(serverValues);

  // Track if server values changed (new fetch)
  const serverKey = fields.map((f) => values[f.key] ?? '').join('|');
  const [lastServerKey, setLastServerKey] = useState(serverKey);
  if (serverKey !== lastServerKey) {
    setLastServerKey(serverKey);
    setLocal(serverValues);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string> = {};
      for (const f of fields) {
        payload[f.key] = local[f.key] ?? '';
      }
      await api.put('/shipping/settings', payload);
    },
    onSuccess: () => {
      setError('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (err) => setError(extractError(err)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 text-sm">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs">{f.label}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type={f.type ?? 'text'}
                  placeholder={f.placeholder}
                  value={local[f.key] ?? ''}
                  onChange={(e) =>
                    setLocal((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                />
                {f.suffix && (
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {f.suffix}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          size="sm"
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saved ? 'Salvo!' : 'Salvar'}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AdminSettingsPage() {
  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => {
      const { data } = await api.get('/shipping/settings');
      return (data.data ?? {}) as Record<string, string>;
    },
  });

  const values = settings ?? {};

  if (isLoading) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6">Configurações</h1>
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Configurações</h1>

      <div className="space-y-6 max-w-2xl">
        <SettingsCard
          title="Loja"
          values={values}
          fields={[
            {
              key: 'store_name',
              label: 'Nome da loja',
              placeholder: 'ElitePinup3D',
            },
            {
              key: 'contact_email',
              label: 'Email de contato',
              type: 'email',
              placeholder: 'contato@elitepinup3d.com.br',
            },
          ]}
        />

        <SettingsCard
          title="Descontos por Pagamento"
          values={values}
          fields={[
            {
              key: 'pix_discount',
              label: 'Desconto PIX',
              type: 'number',
              placeholder: '10',
              suffix: '%',
            },
            {
              key: 'boleto_discount',
              label: 'Desconto Boleto',
              type: 'number',
              placeholder: '5',
              suffix: '%',
            },
          ]}
        />

        <SettingsCard
          title="Produção"
          values={values}
          fields={[
            {
              key: 'base_production_days',
              label: 'Prazo base de produção',
              type: 'number',
              placeholder: '3',
              suffix: 'dias úteis',
            },
          ]}
        />
      </div>
    </div>
  );
}
