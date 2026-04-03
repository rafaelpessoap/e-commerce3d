'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/lib/utils';

interface WishlistButtonProps {
  productId: string;
  productSlug: string;
  className?: string;
}

export function WishlistButton({
  productId,
  productSlug,
  className,
}: WishlistButtonProps) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [added, setAdded] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault(); // Prevent Link navigation
    e.stopPropagation();

    if (!isAuthenticated) {
      // Redirect to login with return URL + wishlist action
      router.push(
        `/login?returnTo=${encodeURIComponent(`/p/${productSlug}`)}&wishlist=${productId}`,
      );
      return;
    }

    setLoading(true);
    try {
      if (added) {
        await api.delete(`/wishlist/${productId}`);
        setAdded(false);
      } else {
        await api.post(`/wishlist/${productId}`);
        setAdded(true);
      }
    } catch {
      // ConflictException = already in wishlist
      setAdded(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        'h-8 w-8 rounded-full bg-background/80 backdrop-blur hover:bg-background',
        className,
      )}
      onClick={handleClick}
      disabled={loading}
      aria-label={added ? 'Remover da lista de desejos' : 'Adicionar à lista de desejos'}
    >
      <Heart
        className={cn(
          'h-4 w-4 transition-colors',
          added ? 'fill-red-500 text-red-500' : 'text-muted-foreground',
        )}
      />
    </Button>
  );
}
