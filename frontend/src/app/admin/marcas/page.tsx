'use client';
import type { ApiRecord } from '@/types/api';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api-client';

export default function AdminBrandsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  const { data: brands, isLoading } = useQuery({
    queryKey: ['admin', 'brands'],
    queryFn: async () => { const { data } = await api.get('/brands'); return data.data ?? data; },
  });

  const createMutation = useMutation({
    mutationFn: (n: string) => api.post('/brands', { name: n }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'brands'] }); setName(''); },
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Marcas</h1>
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) createMutation.mutate(name); }} className="flex gap-2 mb-6 max-w-md">
        <Input placeholder="Nova marca" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" disabled={createMutation.isPending}><Plus className="h-4 w-4 mr-2" />Criar</Button>
      </form>
      {isLoading ? <p className="text-muted-foreground">Carregando...</p> : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Slug</TableHead></TableRow></TableHeader>
            <TableBody>
              {brands?.map((b: ApiRecord) => (
                <TableRow key={b.id}><TableCell className="font-medium">{b.name}</TableCell><TableCell className="font-mono text-xs text-muted-foreground">{b.slug}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
