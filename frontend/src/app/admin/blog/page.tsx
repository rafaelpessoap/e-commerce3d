'use client';
import type { ApiRecord } from '@/types/api';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

export default function AdminBlogPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const { data: posts, isLoading } = useQuery({
    queryKey: ['admin', 'blog'],
    queryFn: async () => {
      const { data } = await api.get('/blog/admin/all');
      return data.data;
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => api.put(`/blog/${id}/publish`),
    onSuccess: () => { setError(''); queryClient.invalidateQueries({ queryKey: ['admin', 'blog'] }); },
    onError: (err) => { setError(extractError(err)); },
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: string) => api.put(`/blog/${id}/unpublish`),
    onSuccess: () => { setError(''); queryClient.invalidateQueries({ queryKey: ['admin', 'blog'] }); },
    onError: (err) => { setError(extractError(err)); },
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Blog</h1>

      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 mb-4 text-sm">
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
                <TableHead>Título</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-[120px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts?.map((post: ApiRecord) => (
                <TableRow key={post.id}>
                  <TableCell className="font-medium">{post.title}</TableCell>
                  <TableCell>
                    <Badge variant={post.isPublished ? 'default' : 'secondary'}>
                      {post.isPublished ? 'Publicado' : 'Rascunho'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(post.createdAt).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    {post.isPublished ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => unpublishMutation.mutate(post.id)}
                      >
                        Despublicar
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => publishMutation.mutate(post.id)}
                      >
                        Publicar
                      </Button>
                    )}
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
