'use client';
import type { ApiRecord } from '@/types/api';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { api } from '@/lib/api-client';

export default function AddressesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: addresses, isLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: async () => {
      const { data } = await api.get('/addresses');
      return data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/addresses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['addresses'] }),
  });

  const createMutation = useMutation({
    mutationFn: (data: ApiRecord) => api.post('/addresses', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      setShowForm(false);
    },
  });

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      postalCode: (fd.get('postalCode') as string).replace(/\D/g, ''),
      street: fd.get('street'),
      number: fd.get('number'),
      complement: fd.get('complement') || undefined,
      neighborhood: fd.get('neighborhood'),
      city: fd.get('city'),
      state: fd.get('state'),
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Enderecos</h1>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-lg">Novo Endereco</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">CEP</Label>
                  <Input name="postalCode" placeholder="00000000" maxLength={9} required />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Estado</Label>
                  <Input name="state" placeholder="SP" maxLength={2} required />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rua</Label>
                <Input name="street" required />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Numero</Label>
                  <Input name="number" required />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Complemento</Label>
                  <Input name="complement" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Bairro</Label>
                  <Input name="neighborhood" required />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cidade</Label>
                  <Input name="city" required />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" size="sm" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : !addresses?.length ? (
        <EmptyState title="Nenhum endereco" description="Adicione um endereco de entrega." />
      ) : (
        <div className="space-y-3">
          {addresses.map((addr: ApiRecord) => (
            <div key={addr.id} className="flex items-start justify-between border rounded-lg p-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">
                    {addr.street}, {addr.number}
                    {addr.complement ? ` - ${addr.complement}` : ''}
                  </p>
                  {addr.isDefault && <Badge variant="secondary"><Star className="h-3 w-3 mr-1" />Padrao</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {addr.neighborhood} - {addr.city}/{addr.state} - CEP {addr.postalCode}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive shrink-0"
                onClick={() => deleteMutation.mutate(addr.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
