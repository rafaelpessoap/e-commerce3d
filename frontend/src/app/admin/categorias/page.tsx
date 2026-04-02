'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
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

export default function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');

  const { data: categories, isLoading } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: async () => {
      const { data } = await api.get('/categories');
      return data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => api.post('/categories', { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
      setNewName('');
    },
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (newName.trim()) createMutation.mutate(newName);
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Categorias</h1>

      <form onSubmit={handleCreate} className="flex gap-2 mb-6 max-w-md">
        <Input
          placeholder="Nova categoria"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
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
                <TableHead>Slug</TableHead>
                <TableHead>Produtos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories?.map((cat: any) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {cat.slug}
                  </TableCell>
                  <TableCell>{cat._count?.products ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
