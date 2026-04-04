'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { Upload, Trash2, Pencil, Loader2, Search, X, ZoomIn, Check } from 'lucide-react';
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

function extractError(err: unknown): string {
  const resp = (err as { response?: { data?: { error?: { message?: string; details?: string[] }; message?: string } } })?.response?.data;
  if (resp?.error?.details?.length) return resp.error.details.join(', ');
  return resp?.error?.message ?? resp?.message ?? 'Erro desconhecido';
}

export default function AdminGalleryPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [error, setError] = useState('');

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAlt, setEditAlt] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Zoom modal state
  const [zoomMedia, setZoomMedia] = useState<MediaFile | null>(null);

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
      queryClient.refetchQueries({ queryKey: ['admin', 'gallery'] });
      setError('');
    },
    onError: (err) => { setError(extractError(err)); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...dto }: { id: string; alt?: string; title?: string; description?: string }) =>
      api.put(`/media/${id}`, dto),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['admin', 'gallery'] });
      setEditingId(null);
      setError('');
    },
    onError: (err) => { setError(extractError(err)); },
  });

  async function handleUpload(files: FileList | null) {
    if (!files) return;
    setUploading(true);
    setUploadError('');

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        await api.post('/media/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } catch (err) {
        const msg = extractError(err);
        setUploadError(`Falha ao enviar "${file.name}": ${msg}`);
      }
    }

    await queryClient.refetchQueries({ queryKey: ['admin', 'gallery'] });
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function startEditing(media: MediaFile) {
    setEditingId(media.id);
    setEditAlt(media.alt ?? '');
    setEditTitle(media.title ?? '');
    setEditDesc(media.description ?? '');
  }

  function handleSaveMeta() {
    if (!editingId) return;
    updateMutation.mutate({
      id: editingId,
      alt: editAlt || undefined,
      title: editTitle || undefined,
      description: editDesc || undefined,
    });
  }

  function handleDelete(media: MediaFile) {
    if (confirm(`Deletar "${media.filename}"?`)) {
      deleteMutation.mutate(media.id);
    }
  }

  const items = (data?.data ?? []) as MediaFile[];
  const meta = data?.meta ?? { total: 0, page: 1, perPage: 24, lastPage: 1 };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Galeria de Midia</h1>
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

      {uploadError && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 mb-4 text-sm">
          {uploadError}
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

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

      {/* List */}
      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma imagem encontrada.</p>
      ) : (
        <div className="border rounded-lg divide-y">
          {items.map((media) => (
            <div key={media.id}>
              {/* Row */}
              <div className="flex items-center gap-4 px-4 py-3">
                {/* Thumbnail */}
                <div className="relative w-[60px] h-[60px] flex-shrink-0 rounded-md overflow-hidden bg-muted">
                  <Image
                    src={media.thumb}
                    alt={media.alt ?? media.filename}
                    fill
                    className="object-cover"
                    sizes="60px"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{media.filename}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {media.alt ? media.alt : <span className="text-destructive">Sem ALT</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {media.width && media.height ? `${media.width} x ${media.height}px` : 'Dimensao desconhecida'}
                    {' \u00B7 '}
                    {new Date(media.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setZoomMedia(media)}
                  >
                    <ZoomIn className="h-4 w-4 mr-1" />
                    Ampliar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => editingId === media.id ? setEditingId(null) : startEditing(media)}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(media)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Excluir
                  </Button>
                </div>
              </div>

              {/* Inline edit panel */}
              {editingId === media.id && (
                <div className="px-4 pb-4 pt-1 bg-muted/30 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-3xl">
                    <div className="space-y-1">
                      <Label className="text-xs">Alt (SEO + acessibilidade)</Label>
                      <Input
                        value={editAlt}
                        onChange={(e) => setEditAlt(e.target.value)}
                        placeholder="Descricao da imagem"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Titulo</Label>
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Titulo da imagem (hover)"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Descricao (SEO)</Label>
                      <Textarea
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        rows={1}
                        placeholder="Descricao longa para SEO"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={handleSaveMeta} disabled={updateMutation.isPending}>
                      <Check className="h-3 w-3 mr-1" />
                      {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Pagination page={page} lastPage={meta.lastPage} onPageChange={setPage} />

      {/* Zoom Dialog */}
      <Dialog open={!!zoomMedia} onOpenChange={(open) => !open && setZoomMedia(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{zoomMedia?.filename}</DialogTitle>
          </DialogHeader>
          {zoomMedia && (
            <div className="flex items-center justify-center overflow-auto">
              <img
                src={zoomMedia.full}
                alt={zoomMedia.alt ?? zoomMedia.filename}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
