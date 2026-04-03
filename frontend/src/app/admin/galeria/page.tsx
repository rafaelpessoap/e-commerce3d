'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { Upload, Trash2, Pencil, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pagination } from '@/components/shared/pagination';
import { api } from '@/lib/api-client';

interface MediaFile {
  id: string;
  filename: string;
  thumb: string;
  card: string;
  gallery: string;
  full: string;
  alt: string | null;
  title: string | null;
  description: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export default function AdminGalleryPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<MediaFile | null>(null);
  const [editAlt, setEditAlt] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'gallery', page, search],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, perPage: 24 };
      if (search) params.search = search;
      const { data } = await api.get('/media', { params });
      return data.data ? data : data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/media/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'gallery'] });
      setSelected(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...dto }: { id: string; alt?: string; title?: string; description?: string }) =>
      api.put(`/media/${id}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'gallery'] });
      setSelected(null);
    },
  });

  async function handleUpload(files: FileList | null) {
    if (!files) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        await api.post('/media/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }

    queryClient.invalidateQueries({ queryKey: ['admin', 'gallery'] });
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function openDetail(media: MediaFile) {
    setSelected(media);
    setEditAlt(media.alt ?? '');
    setEditTitle(media.title ?? '');
    setEditDesc(media.description ?? '');
  }

  function handleSaveMeta() {
    if (!selected) return;
    updateMutation.mutate({
      id: selected.id,
      alt: editAlt || undefined,
      title: editTitle || undefined,
      description: editDesc || undefined,
    });
  }

  const items = (data?.data ?? []) as MediaFile[];
  const meta = data?.meta ?? { total: 0, page: 1, perPage: 24, lastPage: 1 };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Galeria de Mídia</h1>
          <p className="text-sm text-muted-foreground mt-1">{meta.total} imagens</p>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={(e) => handleUpload(e.target.files)}
            className="hidden"
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {uploading ? 'Enviando...' : 'Upload'}
          </Button>
        </div>
      </div>

      {/* Search */}
      <form
        onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }}
        className="flex gap-2 mb-6 max-w-md"
      >
        <Input
          placeholder="Buscar por nome ou alt..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Button type="submit" variant="outline"><Search className="h-4 w-4" /></Button>
        {search && (
          <Button type="button" variant="ghost" onClick={() => { setSearch(''); setSearchInput(''); }}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </form>

      {/* Grid */}
      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma imagem encontrada.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {items.map((media) => (
            <button
              key={media.id}
              onClick={() => openDetail(media)}
              className="relative aspect-square rounded-lg overflow-hidden border hover:ring-2 hover:ring-primary transition-all group"
            >
              <Image
                src={media.card}
                alt={media.alt ?? media.filename}
                fill
                className="object-cover"
                sizes="200px"
              />
              {!media.alt && (
                <span className="absolute bottom-1 left-1 bg-destructive text-destructive-foreground text-[9px] px-1 rounded">
                  Sem ALT
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <Pagination page={page} lastPage={meta.lastPage} onPageChange={setPage} />

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.filename}</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="grid grid-cols-2 gap-4">
              {/* Preview */}
              <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                <Image src={selected.gallery} alt={selected.alt ?? ''} fill className="object-contain" sizes="400px" />
              </div>

              {/* SEO fields */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Alt (SEO + acessibilidade)</Label>
                  <Input value={editAlt} onChange={(e) => setEditAlt(e.target.value)} placeholder="Descrição da imagem para leitores de tela" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Título</Label>
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Título da imagem (hover)" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Descrição (SEO)</Label>
                  <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} placeholder="Descrição longa para SEO" />
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  {selected.width && selected.height && <p>Dimensão: {selected.width} × {selected.height}px</p>}
                  <p>Upload: {new Date(selected.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={handleSaveMeta} disabled={updateMutation.isPending}>
                    <Pencil className="h-3 w-3 mr-1" />
                    {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => { if (confirm('Deletar esta imagem?')) deleteMutation.mutate(selected.id); }}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />Deletar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
