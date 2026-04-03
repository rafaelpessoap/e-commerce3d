'use client';
import type { ApiRecord } from '@/types/api';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export default function AdminScalesPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [baseSize, setBaseSize] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editBaseSize, setEditBaseSize] = useState('');
  const [editMultiplier, setEditMultiplier] = useState('');

  const { data: scales, isLoading } = useQuery({
    queryKey: ['admin', 'scales'],
    queryFn: async () => {
      const { data } = await api.get('/scales');
      return data.data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/scales', {
        name,
        code,
        baseSize: parseFloat(baseSize),
      }),
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'scales'] });
      setName('');
      setCode('');
      setBaseSize('');
    },
    onError: (err) => { setError(extractError(err)); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...dto }: { id: string; name: string; code: string; baseSize: number; multiplier: number }) =>
      api.put(`/scales/${id}`, dto),
    onSuccess: () => {
      setError('');
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'scales'] });
    },
    onError: (err) => { setError(extractError(err)); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/scales/${id}`),
    onSuccess: () => { setError(''); queryClient.invalidateQueries({ queryKey: ['admin', 'scales'] }); },
    onError: (err) => { setError(extractError(err)); },
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate();
  }

  function startEdit(scale: ApiRecord) {
    setEditingId(scale.id as string);
    setEditName(scale.name as string);
    setEditCode(scale.code as string);
    setEditBaseSize(String(scale.baseSize));
    setEditMultiplier(String(scale.multiplier));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function saveEdit() {
    if (editingId && editName.trim() && editCode.trim()) {
      updateMutation.mutate({
        id: editingId,
        name: editName,
        code: editCode,
        baseSize: parseFloat(editBaseSize),
        multiplier: parseFloat(editMultiplier),
      });
    }
  }

  function handleDelete(scale: ApiRecord) {
    if (confirm(`Excluir escala "${scale.name}"?`)) {
      deleteMutation.mutate(scale.id as string);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Escalas</h1>

      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="flex gap-3 mb-6 items-end max-w-2xl">
        <div className="space-y-1">
          <Label className="text-xs">Nome</Label>
          <Input
            placeholder="Heroic (28mm)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Código</Label>
          <Input
            placeholder="HEROIC_28"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tamanho (mm)</Label>
          <Input
            type="number"
            placeholder="28"
            value={baseSize}
            onChange={(e) => setBaseSize(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={createMutation.isPending}>
          <Plus className="h-4 w-4 mr-2" />
          Criar
        </Button>
      </form>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead>Multiplicador</TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scales?.map((scale: ApiRecord) => (
                <TableRow key={scale.id}>
                  <TableCell className="font-medium">
                    {editingId === scale.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                          className="h-8"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <span className="cursor-pointer hover:text-primary hover:underline" onClick={() => startEdit(scale)}>{scale.name as string}</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {editingId === scale.id ? (
                      <Input
                        value={editCode}
                        onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                        className="h-8"
                      />
                    ) : (
                      scale.code as string
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === scale.id ? (
                      <Input
                        type="number"
                        value={editBaseSize}
                        onChange={(e) => setEditBaseSize(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                        className="h-8 w-24"
                      />
                    ) : (
                      `${scale.baseSize}mm`
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === scale.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.1"
                          value={editMultiplier}
                          onChange={(e) => setEditMultiplier(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                          className="h-8 w-24"
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveEdit} disabled={updateMutation.isPending}>
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEdit}>
                          <X className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    ) : (
                      `${scale.multiplier}x`
                    )}
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(scale)} disabled={deleteMutation.isPending}>
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
