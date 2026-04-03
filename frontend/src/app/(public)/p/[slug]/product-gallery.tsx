'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface GalleryImage {
  id?: string;
  url?: string;
  altText?: string;
  isMain?: boolean;
  mediaFile?: {
    thumb: string;
    card: string;
    gallery: string;
    full: string;
    alt?: string;
  };
}

interface ProductGalleryProps {
  images: GalleryImage[];
  productName: string;
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="relative aspect-square overflow-hidden rounded-lg bg-muted flex items-center justify-center">
        <p className="text-muted-foreground">Sem imagem</p>
      </div>
    );
  }

  const current = images[selectedIndex] ?? images[0];

  // Support both old (url) and new (mediaFile.gallery) format
  function getMainUrl(img: GalleryImage): string {
    return img.mediaFile?.gallery ?? img.url ?? '';
  }

  function getThumbUrl(img: GalleryImage): string {
    return img.mediaFile?.thumb ?? img.url ?? '';
  }

  function getAlt(img: GalleryImage): string {
    return img.mediaFile?.alt ?? img.altText ?? productName;
  }

  return (
    <div>
      {/* Main image */}
      <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
        <Image
          src={getMainUrl(current)}
          alt={getAlt(current)}
          fill
          className="object-cover"
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
        />
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {images.map((img, i) => (
            <button
              key={img.id ?? i}
              onClick={() => setSelectedIndex(i)}
              className={cn(
                'relative aspect-square overflow-hidden rounded border-2 transition-colors',
                i === selectedIndex ? 'border-primary' : 'border-transparent hover:border-muted-foreground/30',
              )}
            >
              <Image
                src={getThumbUrl(img)}
                alt={getAlt(img)}
                fill
                className="object-cover"
                sizes="80px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
