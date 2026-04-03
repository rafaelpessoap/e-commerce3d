'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';

function extractError(err: unknown): string {
  const resp = (err as { response?: { data?: { error?: { message?: string; details?: string[] }; message?: string } } })?.response?.data;
  if (resp?.error?.details?.length) return resp.error.details.join(', ');
  return resp?.error?.message ?? resp?.message ?? 'Erro desconhecido';
}

export default function AdminAttributesPage() {
  const queryClient = useQueryClient();
  const [newAttrName, setNewAttrName] = useState('');
  const [newValueFor, setNewValueFor] = useState<string | null>(null);
  const [newValueText, setNewValueText] = useState('');
  const [error, setError] = useState('');

  const { data: attributes, isLoading } = useQuery({
    queryKey: ['admin', 'attributes'],
    queryFn: async () => {
      const { data } = await api.get('/attributes');
      return data.data ?? data;
    },
  });

  const createAttr = useMutation({
    mutationFn: (name: string) => api.post('/attributes', { name }),
    onSuccess: async () => {
      setError('');
      await queryClient.refetchQueries({ queryKey: ['admin', 'attributes'] });
      setNewAttrName('');
    },
    onError: (err) => { setError(extractError(err)); },
  });

  const deleteAttr = useMutation({
    mutationFn: (id: string) => api.delete(`/attributes/${id}`),
    onSuccess: async () => { setError(''); await queryClient.refetchQueries({ queryKey: ['admin', 'attributes'] }); },
    onError: (err) => { setError(extractError(err)); },
  });

  const createValue = useMutation({
    mutationFn: ({ attrId, value }: { attrId: string; value: string }) =>
      api.post(`/attributes/${attrId}/values`, { value }),
    onSuccess: async () => {
      setError('');
      setNewValueText('');
      await queryClient.refetchQueries({ queryKey: ['admin', 'attributes'] });
    },
    onError: (err) => { setError(extractError(err)); },
  });

  const deleteValue = useMutation({
    mutationFn: (valueId: string) => api.delete(`/attributes/values/${valueId}`),
    onSuccess: async () => { setError(''); await queryClient.refetchQueries({ queryKey: ['admin', 'attributes'] }); },
    onError: (err) => { setError(extractError(err)); },
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Atributos</h1>
      <p className="text-muted-foreground mb-6">
        Gerencie atributos e seus valores. Exemplos: Arma (Espada, Adaga), Raça (Elfo, Humano).
      </p>

      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Create attribute */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newAttrName.trim()) createAttr.mutate(newAttrName);
        }}
        className="flex gap-2 mb-8 max-w-md"
      >
        <Input
          placeholder="Nome do atributo (ex: Arma)"
          value={newAttrName}
          onChange={(e) => setNewAttrName(e.target.value)}
        />
        <Button type="submit" disabled={createAttr.isPending || !newAttrName.trim()}>
          <Plus className="h-4 w-4 mr-2" />
          Criar
        </Button>
      </form>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <div className="space-y-4">
          {(attributes as Array<{
            id: string;
            name: string;
            slug: string;
            values: Array<{ id: string; value: string; slug: string }>;
          }>)?.map((attr) => (
            <Card key={attr.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{attr.name}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => {
                      if (confirm(`Deletar atributo "${attr.name}" e todos os valores?`)) {
                        deleteAttr.mutate(attr.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Values */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {attr.values.map((val) => (
                    <Badge key={val.id} variant="secondary" className="gap-1 pr-1">
                      {val.value}
                      <button
                        onClick={() => deleteValue.mutate(val.id)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}

                  {attr.values.length === 0 && (
                    <span className="text-xs text-muted-foreground">Nenhum valor cadastrado</span>
                  )}
                </div>

                {/* Add value */}
                {newValueFor === attr.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newValueText.trim()) {
                        createValue.mutate({ attrId: attr.id, value: newValueText });
                      }
                    }}
                    className="flex gap-2"
                  >
                    <Input
                      placeholder="Novo valor (ex: Espada)"
                      value={newValueText}
                      onChange={(e) => setNewValueText(e.target.value)}
                      autoFocus
                      className="max-w-xs"
                    />
                    <Button type="submit" size="sm" disabled={createValue.isPending}>
                      Adicionar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setNewValueFor(null);
                        setNewValueText('');
                      }}
                    >
                      Cancelar
                    </Button>
                  </form>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setNewValueFor(attr.id);
                      setNewValueText('');
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Adicionar valor
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
