'use client';
import type { ApiRecord } from '@/types/api';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api-client';

function extractError(err: unknown): string {
  const resp = (err as { response?: { data?: { error?: { message?: string; details?: string[] }; message?: string } } })?.response?.data;
  if (resp?.error?.details?.length) return resp.error.details.join(', ');
  return resp?.error?.message ?? resp?.message ?? 'Erro desconhecido';
}

export default function AdminTagsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const { data: tags, isLoading } = useQuery({
    queryKey: ['admin', 'tags'],
    queryFn: async () => { const { data } = await api.get('/tags'); return data.data ?? data; },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/tags', { name, color: color || undefined }),
    onSuccess: () => { setError(''); queryClient.invalidateQueries({ queryKey: ['admin', 'tags'] }); setName(''); setColor(''); },
    onError: (err) => { setError(extractError(err)); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name: string; color?: string } }) =>
      api.put(`/tags/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tags'] });
      setEditingId(null);
      setError('');
    },
    onError: (err) => { setError(extractError(err)); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tags/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tags'] });
      setError('');
    },
    onError: (err) => { setError(extractError(err)); },
  });

  function startEditing(t: ApiRecord) {
    setEditingId(t.id as string);
    setEditName(t.name as string);
    setEditColor((t.color as string) ?? '');
  }

  function handleUpdate() {
    if (editingId && editName.trim()) {
      updateMutation.mutate({ id: editingId, body: { name: editName, color: editColor || undefined } });
    }
  }

  function handleDelete(t: ApiRecord) {
    if (confirm(`Excluir a tag "${t.name}"?`)) {
      deleteMutation.mutate(t.id as string);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Tags</h1>
      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) createMutation.mutate(); }} className="flex gap-2 mb-6 max-w-md">
        <Input placeholder="Nova tag" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="#cor" value={color} onChange={(e) => setColor(e.target.value)} className="w-28" />
        <Button type="submit" disabled={createMutation.isPending}><Plus className="h-4 w-4 mr-2" />Criar</Button>
      </form>
      {isLoading ? <p className="text-muted-foreground">Carregando...</p> : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags?.map((t: ApiRecord) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">
                    {editingId === t.id ? (
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
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          placeholder="#cor"
                          className="h-8 w-28"
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
                        onClick={() => startEditing(t)}
                      >
                        {t.name as string}
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{t.slug}</TableCell>
                  <TableCell>{t.color ? <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: t.color as string }} /> : '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEditing(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(t)} disabled={deleteMutation.isPending}>
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
