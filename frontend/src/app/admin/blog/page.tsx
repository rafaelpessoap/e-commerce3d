'use client';

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

export default function AdminBlogPage() {
  const queryClient = useQueryClient();

  const { data: posts, isLoading } = useQuery({
    queryKey: ['admin', 'blog'],
    queryFn: async () => {
      const { data } = await api.get('/blog/admin/all');
      return data.data;
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => api.put(`/blog/${id}/publish`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'blog'] }),
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: string) => api.put(`/blog/${id}/unpublish`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'blog'] }),
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Blog</h1>

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
              {posts?.map((post: any) => (
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
