'use client';
import type { ApiRecord } from '@/types/api';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Truck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/constants';

interface ShippingMethodRow {
  serviceId: number;
  name: string;
  company: string;
  isActive: boolean;
  displayName: string;
  extraDays: number;
}

export default function AdminShippingPage() {
  const queryClient = useQueryClient();
  const [zipStart, setZipStart] = useState('');
  const [zipEnd, setZipEnd] = useState('');
  const [minValue, setMinValue] = useState('');
  const [cepSaved, setCepSaved] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/shipping/methods/sync');
      return data.data as { synced: number };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'shipping-methods'] });
      setSyncMessage(`${result.synced} transportadoras sincronizadas`);
      setTimeout(() => setSyncMessage(''), 4000);
    },
    onError: (err: unknown) => {
      const resp = (err as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data;
      const msg = resp?.error?.message ?? resp?.message ?? 'Erro ao sincronizar transportadoras';
      setSyncMessage(msg);
      setTimeout(() => setSyncMessage(''), 6000);
    },
  });

  // ─── CEP de origem ─────────────────────────────────────────
  const { data: settings } = useQuery({
    queryKey: ['admin', 'shipping-settings'],
    queryFn: async () => {
      const { data } = await api.get('/shipping/settings');
      return data.data;
    },
  });

  const [shopCep, setShopCep] = useState('');
  const displayCep = shopCep || settings?.shopCep || '';

  const saveCepMutation = useMutation({
    mutationFn: () => api.put('/shipping/settings', { shopCep: displayCep }),
    onSuccess: () => {
      setCepSaved(true);
      setTimeout(() => setCepSaved(false), 2000);
    },
  });

  // ─── Métodos de envio ──────────────────────────────────────
  const { data: methods, isLoading: methodsLoading } = useQuery({
    queryKey: ['admin', 'shipping-methods'],
    queryFn: async () => {
      const { data } = await api.get('/shipping/methods');
      return data.data as ShippingMethodRow[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (method: ShippingMethodRow) =>
      api.put(`/shipping/methods/${method.serviceId}`, {
        name: method.name,
        company: method.company,
        isActive: method.isActive,
        displayName: method.displayName || undefined,
        extraDays: method.extraDays,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'shipping-methods'] });
    },
  });

  function handleToggle(method: ShippingMethodRow) {
    toggleMutation.mutate({ ...method, isActive: !method.isActive });
  }

  function handleUpdateMethod(method: ShippingMethodRow, field: string, value: string | number) {
    toggleMutation.mutate({ ...method, [field]: value });
  }

  // ─── Regras de frete grátis ────────────────────────────────
  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ['admin', 'shipping-rules'],
    queryFn: async () => {
      const { data } = await api.get('/shipping/free-rules');
      return data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/shipping/free-rules', {
        zipCodeStart: zipStart.replace(/\D/g, ''),
        zipCodeEnd: zipEnd.replace(/\D/g, ''),
        minOrderValue: parseFloat(minValue),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'shipping-rules'] });
      setZipStart('');
      setZipEnd('');
      setMinValue('');
    },
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Configurações de Frete</h1>

      {/* CEP de Origem */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">CEP de Origem</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">CEP da loja (origem dos envios)</Label>
              <Input
                placeholder="01001000"
                value={displayCep}
                onChange={(e) => setShopCep(e.target.value.replace(/\D/g, ''))}
                maxLength={8}
                className="w-40 font-mono"
              />
            </div>
            <Button
              onClick={() => saveCepMutation.mutate()}
              disabled={saveCepMutation.isPending}
              size="sm"
            >
              <Save className="h-4 w-4 mr-2" />
              {cepSaved ? 'Salvo!' : 'Salvar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Métodos de Envio */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Métodos de Envio (Melhor Envio)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Habilite os métodos que deseja oferecer. Edite o nome de exibição e dias adicionais por método.
            </p>
            <div className="flex items-center gap-3">
              {syncMessage && (
                <span className="text-sm text-muted-foreground">{syncMessage}</span>
              )}
              <Button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                size="sm"
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar Transportadoras'}
              </Button>
            </div>
          </div>

          {methodsLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : !methods?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma transportadora cadastrada.</p>
              <p className="text-sm mt-1">Clique em &quot;Sincronizar Transportadoras&quot; para buscar os servicos disponiveis.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Ativo</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Transportadora</TableHead>
                    <TableHead>Nome de Exibição</TableHead>
                    <TableHead className="w-28">Dias Extras</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {methods?.map((method) => (
                    <TableRow key={method.serviceId} className={!method.isActive ? 'opacity-50' : ''}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={method.isActive}
                          onChange={() => handleToggle(method)}
                          className="accent-primary h-4 w-4"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{method.name}</TableCell>
                      <TableCell className="text-muted-foreground">{method.company}</TableCell>
                      <TableCell>
                        <Input
                          placeholder={method.name}
                          defaultValue={method.displayName}
                          className="h-8 text-sm"
                          onBlur={(e) =>
                            handleUpdateMethod(method, 'displayName', e.target.value)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          defaultValue={method.extraDays}
                          className="h-8 text-sm w-20"
                          onBlur={(e) =>
                            handleUpdateMethod(
                              method,
                              'extraDays',
                              parseInt(e.target.value, 10) || 0,
                            )
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Regras de Frete Grátis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Regras de Frete Grátis</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="flex gap-2 mb-4 items-end flex-wrap"
          >
            <div className="space-y-1">
              <Label className="text-xs">CEP Início</Label>
              <Input
                placeholder="01000000"
                value={zipStart}
                onChange={(e) => setZipStart(e.target.value)}
                required
                className="w-32 font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CEP Fim</Label>
              <Input
                placeholder="09999999"
                value={zipEnd}
                onChange={(e) => setZipEnd(e.target.value)}
                required
                className="w-32 font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Valor Mínimo (R$)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="150"
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
                required
                className="w-28"
              />
            </div>
            <Button type="submit" disabled={createMutation.isPending} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Criar
            </Button>
          </form>

          {rulesLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CEP Início</TableHead>
                    <TableHead>CEP Fim</TableHead>
                    <TableHead>Valor Mínimo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules?.map((r: ApiRecord) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono">{r.zipCodeStart}</TableCell>
                      <TableCell className="font-mono">{r.zipCodeEnd}</TableCell>
                      <TableCell>{formatCurrency(r.minOrderValue)}</TableCell>
                      <TableCell>
                        <Badge variant={r.isActive ? 'default' : 'secondary'}>
                          {r.isActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
