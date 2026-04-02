'use client';
import type { ApiRecord } from '@/types/api';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
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

export default function AdminScalesPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [baseSize, setBaseSize] = useState('');

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
      queryClient.invalidateQueries({ queryKey: ['admin', 'scales'] });
      setName('');
      setCode('');
      setBaseSize('');
    },
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate();
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Escalas</h1>

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {scales?.map((scale: ApiRecord) => (
                <TableRow key={scale.id}>
                  <TableCell className="font-medium">{scale.name}</TableCell>
                  <TableCell className="font-mono text-xs">{scale.code}</TableCell>
                  <TableCell>{scale.baseSize}mm</TableCell>
                  <TableCell>{scale.multiplier}x</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
