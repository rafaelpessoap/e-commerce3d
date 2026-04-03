'use client';
import type { ApiRecord } from '@/types/api';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api-client';

function extractError(err: unknown): string {
  const resp = (err as { response?: { data?: { error?: { message?: string; details?: string[] }; message?: string } } })?.response?.data;
  if (resp?.error?.details?.length) return resp.error.details.join(', ');
  return resp?.error?.message ?? resp?.message ?? 'Erro desconhecido';
}

export default function AdminBrandsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const { data: brands, isLoading } = useQuery({
    queryKey: ['admin', 'brands'],
    queryFn: async () => { const { data } = await api.get('/brands'); return data.data ?? data; },
  });

  const createMutation = useMutation({
    mutationFn: (n: string) => api.post('/brands', { name: n }),
    onSuccess: () => { setError(''); queryClient.invalidateQueries({ queryKey: ['admin', 'brands'] }); setName(''); },
    onError: (err) => { setError(extractError(err)); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name: n }: { id: string; name: string }) => api.put(`/brands/${id}`, { name: n }),
    onSuccess: () => { setError(''); setEditingId(null); queryClient.invalidateQueries({ queryKey: ['admin', 'brands'] }); },
    onError: (err) => { setError(extractError(err)); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/brands/${id}`),
    onSuccess: () => { setError(''); queryClient.invalidateQueries({ queryKey: ['admin', 'brands'] }); },
    onError: (err) => { setError(extractError(err)); },
  });

  function startEdit(brand: ApiRecord) {
    setEditingId(brand.id as string);
    setEditName(brand.name as string);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
  }

  function saveEdit() {
    if (editingId && editName.trim()) {
      updateMutation.mutate({ id: editingId, name: editName });
    }
  }

  function handleDelete(brand: ApiRecord) {
    if (confirm(`Excluir marca "${brand.name}"?`)) {
      deleteMutation.mutate(brand.id as string);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Marcas</h1>
      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) createMutation.mutate(name); }} className="flex gap-2 mb-6 max-w-md">
        <Input placeholder="Nova marca" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" disabled={createMutation.isPending}><Plus className="h-4 w-4 mr-2" />Criar</Button>
      </form>
      {isLoading ? <p className="text-muted-foreground">Carregando...</p> : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Slug</TableHead><TableHead className="w-[80px]">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {brands?.map((b: ApiRecord) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">
                    {editingId === b.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                          className="h-8"
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveEdit} disabled={updateMutation.isPending}>
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEdit}>
                          <X className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    ) : (
                      <span className="cursor-pointer hover:text-primary hover:underline" onClick={() => startEdit(b)}>{b.name as string}</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{b.slug as string}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(b)} disabled={deleteMutation.isPending}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
