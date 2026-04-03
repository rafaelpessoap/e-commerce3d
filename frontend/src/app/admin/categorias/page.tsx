'use client';
import type { ApiRecord } from '@/types/api';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api-client';

function extractError(err: unknown): string {
  const resp = (err as { response?: { data?: { error?: { message?: string; details?: string[] }; message?: string } } })?.response?.data;
  if (resp?.error?.details?.length) return resp.error.details.join(', ');
  return resp?.error?.message ?? resp?.message ?? 'Erro desconhecido';
}

export default function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newExtraDays, setNewExtraDays] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editExtraDays, setEditExtraDays] = useState('');

  const { data: categories, isLoading } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: async () => {
      const { data } = await api.get('/categories');
      return data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; extraDays?: number }) => api.post('/categories', body),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['admin', 'categories'] });
      setNewName('');
      setNewExtraDays('');
      setError('');
    },
    onError: (err) => {
      setError(extractError(err));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name: string; extraDays?: number } }) =>
      api.put(`/categories/${id}`, body),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['admin', 'categories'] });
      setEditingId(null);
      setError('');
    },
    onError: (err) => {
      setError(extractError(err));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['admin', 'categories'] });
      setError('');
    },
    onError: (err) => {
      setError(extractError(err));
    },
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (newName.trim()) {
      createMutation.mutate({
        name: newName,
        extraDays: newExtraDays ? parseInt(newExtraDays, 10) : undefined,
      });
    }
  }

  function startEditing(cat: ApiRecord) {
    setEditingId(cat.id as string);
    setEditName(cat.name as string);
    setEditExtraDays(cat.extraDays != null ? String(cat.extraDays) : '');
  }

  function handleUpdate() {
    if (editingId && editName.trim()) {
      updateMutation.mutate({
        id: editingId,
        body: {
          name: editName,
          extraDays: editExtraDays ? parseInt(editExtraDays, 10) : undefined,
        },
      });
    }
  }

  function handleDelete(cat: ApiRecord) {
    if (confirm(`Excluir a categoria "${cat.name}"?`)) {
      deleteMutation.mutate(cat.id as string);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Categorias</h1>

      <form onSubmit={handleCreate} className="flex gap-2 mb-4 max-w-lg">
        <Input
          placeholder="Nova categoria"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Input
          type="number"
          placeholder="Dias prod."
          value={newExtraDays}
          onChange={(e) => setNewExtraDays(e.target.value)}
          className="w-28"
          min={0}
        />
        <Button type="submit" disabled={createMutation.isPending}>
          <Plus className="h-4 w-4 mr-2" />
          Criar
        </Button>
      </form>

      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 mb-4 text-sm max-w-md">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Produtos</TableHead>
                <TableHead>Dias Producao</TableHead>
                <TableHead className="w-24">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories?.map((cat: ApiRecord) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium">
                    {editingId === cat.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdate();
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                        />
                        <Input
                          type="number"
                          value={editExtraDays}
                          onChange={(e) => setEditExtraDays(e.target.value)}
                          placeholder="Dias"
                          className="h-8 w-20"
                          min={0}
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleUpdate} disabled={updateMutation.isPending}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="hover:underline cursor-pointer text-left"
                        onClick={() => startEditing(cat)}
                      >
                        {cat.name as string}
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {cat.slug}
                  </TableCell>
                  <TableCell>{cat._count?.products ?? 0}</TableCell>
                  <TableCell>{cat.extraDays != null ? String(cat.extraDays) : '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEditing(cat)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(cat)} disabled={deleteMutation.isPending}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
