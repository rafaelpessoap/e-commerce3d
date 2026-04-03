'use client';

import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { Upload, X, Star, Loader2, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export interface ProductImageData {
  id?: string;
  mediaFileId: string;
  thumb: string;
  card: string;
  gallery: string;
  full: string;
  alt?: string;
  isMain: boolean;
  order: number;
}

interface ImageUploadProps {
  images: ProductImageData[];
  onChange: (images: ProductImageData[]) => void;
}

export function ImageUpload({ images, onChange }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [gallerySearch, setGallerySearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Gallery picker data
  const { data: galleryData } = useQuery({
    queryKey: ['gallery-picker', gallerySearch],
    queryFn: async () => {
      const params: Record<string, string | number> = { perPage: 24 };
      if (gallerySearch) params.search = gallerySearch;
      const { data } = await api.get('/media', { params });
      return data.data ? data : data;
    },
    enabled: showGallery,
  });

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);

    const newImages = [...images];

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const { data } = await api.post('/media/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const media = data.data ?? data;
        newImages.push({
          mediaFileId: media.id,
          thumb: media.thumb,
          card: media.card,
          gallery: media.gallery,
          full: media.full,
          alt: media.alt ?? undefined,
          isMain: newImages.length === 0,
          order: newImages.length,
        });
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }

    onChange(newImages);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function selectFromGallery(media: { id: string; thumb: string; card: string; gallery: string; full: string; alt: string | null }) {
    const newImages = [...images];
    newImages.push({
      mediaFileId: media.id,
      thumb: media.thumb,
      card: media.card,
      gallery: media.gallery,
      full: media.full,
      alt: media.alt ?? undefined,
      isMain: newImages.length === 0,
      order: newImages.length,
    });
    onChange(newImages);
    setShowGallery(false);
  }

  function setAsMain(index: number) {
    onChange(images.map((img, i) => ({ ...img, isMain: i === index })));
  }

  function removeImage(index: number) {
    const updated = images.filter((_, i) => i !== index);
    if (updated.length > 0 && !updated.some((img) => img.isMain)) {
      updated[0].isMain = true;
    }
    onChange(updated);
  }

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={(e) => handleUpload(e.target.files)}
          className="hidden"
        />
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          {uploading ? 'Enviando...' : 'Upload Novo'}
        </Button>
        <Button type="button" variant="outline" onClick={() => setShowGallery(true)}>
          <ImageIcon className="h-4 w-4 mr-2" />
          Escolher da Galeria
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        As imagens são automaticamente convertidas para WebP em 4 tamanhos (thumb, card, galeria, full).
      </p>

      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {images.map((img, i) => (
            <div
              key={img.mediaFileId + i}
              className={cn(
                'relative aspect-square rounded-lg overflow-hidden border-2 group',
                img.isMain ? 'border-primary' : 'border-transparent',
              )}
            >
              <Image src={img.card} alt={img.alt ?? `Imagem ${i + 1}`} fill className="object-cover" sizes="200px" />

              {img.isMain && (
                <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded font-medium">
                  Principal
                </span>
              )}

              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {!img.isMain && (
                  <Button type="button" size="icon" variant="secondary" className="h-8 w-8" onClick={() => setAsMain(i)} title="Principal">
                    <Star className="h-4 w-4" />
                  </Button>
                )}
                <Button type="button" size="icon" variant="destructive" className="h-8 w-8" onClick={() => removeImage(i)} title="Remover">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gallery Picker Dialog */}
      <Dialog open={showGallery} onOpenChange={setShowGallery}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Escolher da Galeria</DialogTitle>
          </DialogHeader>

          <Input
            placeholder="Buscar por nome ou alt..."
            value={gallerySearch}
            onChange={(e) => setGallerySearch(e.target.value)}
            className="mb-4"
          />

          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {((galleryData?.data ?? []) as Array<{ id: string; thumb: string; card: string; gallery: string; full: string; alt: string | null; filename: string }>).map((media) => (
              <button
                key={media.id}
                onClick={() => selectFromGallery(media)}
                className="relative aspect-square rounded overflow-hidden border hover:ring-2 hover:ring-primary"
              >
                <Image src={media.card} alt={media.alt ?? media.filename} fill className="object-cover" sizes="120px" />
              </button>
            ))}
          </div>

          {((galleryData?.data ?? []) as Array<unknown>).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma imagem encontrada.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
