'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api-client';

export default function AdminTagsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [color, setColor] = useState('');

  const { data: tags, isLoading } = useQuery({
    queryKey: ['admin', 'tags'],
    queryFn: async () => { const { data } = await api.get('/tags'); return data.data ?? data; },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/tags', { name, color: color || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'tags'] }); setName(''); setColor(''); },
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Tags</h1>
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) createMutation.mutate(); }} className="flex gap-2 mb-6 max-w-md">
        <Input placeholder="Nova tag" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="#cor" value={color} onChange={(e) => setColor(e.target.value)} className="w-28" />
        <Button type="submit" disabled={createMutation.isPending}><Plus className="h-4 w-4 mr-2" />Criar</Button>
      </form>
      {isLoading ? <p className="text-muted-foreground">Carregando...</p> : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Slug</TableHead><TableHead>Cor</TableHead></TableRow></TableHeader>
            <TableBody>
              {tags?.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{t.slug}</TableCell>
                  <TableCell>{t.color ? <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: t.color }} /> : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
