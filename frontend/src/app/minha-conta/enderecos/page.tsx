'use client';
import type { ApiRecord } from '@/types/api';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Star, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { api } from '@/lib/api-client';

function AddressForm({ onSubmit, onCancel, defaults, submitLabel, loading }: {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  defaults?: ApiRecord;
  submitLabel: string;
  loading: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {!defaults && (
          <div className="space-y-1">
            <Label className="text-xs">CEP</Label>
            <Input name="postalCode" placeholder="00000000" maxLength={9} required />
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs">Estado</Label>
          <Input name="state" placeholder="SP" maxLength={2} required defaultValue={defaults?.state ?? ''} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Rua</Label>
        <Input name="street" required defaultValue={defaults?.street ?? ''} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Numero</Label>
          <Input name="number" required defaultValue={defaults?.number ?? ''} />
        </div>
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Complemento</Label>
          <Input name="complement" defaultValue={defaults?.complement ?? ''} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Bairro</Label>
          <Input name="neighborhood" required defaultValue={defaults?.neighborhood ?? ''} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Cidade</Label>
          <Input name="city" required defaultValue={defaults?.city ?? ''} />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? 'Salvando...' : submitLabel}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export default function AddressesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: ApiRecord & { id: string }) => api.put(`/addresses/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      setEditingId(null);
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => api.put(`/addresses/${id}`, { isDefault: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['addresses'] }),
  });

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const isFirst = !addresses?.length;
    createMutation.mutate({
      postalCode: (fd.get('postalCode') as string).replace(/\D/g, ''),
      street: fd.get('street'),
      number: fd.get('number'),
      complement: fd.get('complement') || undefined,
      neighborhood: fd.get('neighborhood'),
      city: fd.get('city'),
      state: fd.get('state'),
      isDefault: isFirst,
    });
  }

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingId) return;
    const fd = new FormData(e.currentTarget);
    updateMutation.mutate({
      id: editingId,
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
        <Button size="sm" onClick={() => { setShowForm(!showForm); setEditingId(null); }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-lg">Novo Endereco</CardTitle></CardHeader>
          <CardContent>
            <AddressForm
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
              submitLabel="Salvar"
              loading={createMutation.isPending}
            />
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
            <div
              key={addr.id}
              className={`border rounded-lg p-4 ${
                addr.isDefault ? 'border-primary bg-primary/5' : ''
              }`}
            >
              {editingId === addr.id ? (
                <AddressForm
                  onSubmit={handleUpdate}
                  onCancel={() => setEditingId(null)}
                  defaults={addr}
                  submitLabel="Atualizar"
                  loading={updateMutation.isPending}
                />
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">
                          {addr.street}, {addr.number}
                          {addr.complement ? ` - ${addr.complement}` : ''}
                        </p>
                        {addr.isDefault && (
                          <Badge variant="secondary">
                            <Star className="h-3 w-3 mr-1 fill-current" />
                            Principal
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {addr.neighborhood} - {addr.city}/{addr.state} - CEP {addr.postalCode}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => { setEditingId(addr.id); setShowForm(false); }}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          if (addr.isDefault) {
                            alert('Defina outro endereco como principal antes de excluir este.');
                            return;
                          }
                          deleteMutation.mutate(addr.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {!addr.isDefault && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => setDefaultMutation.mutate(addr.id)}
                      disabled={setDefaultMutation.isPending}
                    >
                      <Star className="h-3.5 w-3.5 mr-2" />
                      Definir como principal
                    </Button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
