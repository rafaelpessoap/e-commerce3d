'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Upload, X, Star, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export interface ProductImageData {
  id?: string;
  url: string;
  key?: string;
  altText?: string;
  isMain: boolean;
  order: number;
}

interface ImageUploadProps {
  images: ProductImageData[];
  onChange: (images: ProductImageData[]) => void;
}

export function ImageUpload({ images, onChange }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

        const result = data.data ?? data;
        newImages.push({
          url: result.url,
          key: result.key,
          isMain: newImages.length === 0, // First image is main
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

  function setAsMain(index: number) {
    const updated = images.map((img, i) => ({
      ...img,
      isMain: i === index,
    }));
    onChange(updated);
  }

  function removeImage(index: number) {
    const updated = images.filter((_, i) => i !== index);
    // If removed image was main, set first as main
    if (updated.length > 0 && !updated.some((img) => img.isMain)) {
      updated[0].isMain = true;
    }
    onChange(updated);
  }

  return (
    <div className="space-y-4">
      {/* Upload button */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={(e) => handleUpload(e.target.files)}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          {uploading ? 'Enviando...' : 'Adicionar Imagens'}
        </Button>
        <p className="text-xs text-muted-foreground mt-1">
          JPG, PNG, WebP ou GIF. Máximo 10MB por arquivo.
        </p>
      </div>

      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {images.map((img, i) => (
            <div
              key={img.url}
              className={cn(
                'relative aspect-square rounded-lg overflow-hidden border-2 group',
                img.isMain ? 'border-primary' : 'border-transparent',
              )}
            >
              <Image
                src={img.url}
                alt={img.altText ?? `Imagem ${i + 1}`}
                fill
                className="object-cover"
                sizes="200px"
              />

              {/* Main badge */}
              {img.isMain && (
                <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded font-medium">
                  Principal
                </span>
              )}

              {/* Actions overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {!img.isMain && (
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8"
                    onClick={() => setAsMain(i)}
                    title="Definir como principal"
                  >
                    <Star className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="h-8 w-8"
                  onClick={() => removeImage(i)}
                  title="Remover"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
