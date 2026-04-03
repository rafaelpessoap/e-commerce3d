'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { StarRating } from './star-rating';

interface ReviewsSectionProps {
  productId: string;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  images: string | null;
  createdAt: string;
  user: { name: string | null };
}

export function ReviewsSection({ productId }: ReviewsSectionProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['reviews', productId],
    queryFn: async () => {
      const { data } = await api.get(`/products/${productId}/reviews`);
      return data.data ?? data;
    },
  });

  if (isLoading) return null;

  const reviews: Review[] = data?.reviews ?? [];
  const average: number = data?.average ?? 0;
  const count: number = data?.count ?? 0;

  if (count === 0) return null;

  return (
    <div className="mt-16 border-t pt-12">
      <div className="flex items-center gap-4 mb-8">
        <h2 className="text-2xl font-bold">Avaliações</h2>
        <div className="flex items-center gap-2">
          <StarRating rating={average} size={20} />
          <span className="text-sm text-muted-foreground">
            {average.toFixed(1)} ({count} {count === 1 ? 'avaliação' : 'avaliações'})
          </span>
        </div>
      </div>

      <div className="space-y-6">
        {reviews.map((review) => {
          const images: string[] = review.images ? JSON.parse(review.images) : [];

          return (
            <div key={review.id} className="border-b pb-6 last:border-0">
              <div className="flex items-center gap-3 mb-2">
                <StarRating rating={review.rating} size={14} />
                <span className="text-sm font-medium">{review.user.name ?? 'Anônimo'}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(review.createdAt).toLocaleDateString('pt-BR')}
                </span>
              </div>

              {review.comment && (
                <p className="text-sm text-muted-foreground">{review.comment}</p>
              )}

              {images.length > 0 && (
                <div className="flex gap-2 mt-3">
                  {images.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Foto da avaliação ${i + 1}`}
                      className="w-20 h-20 rounded object-cover border"
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
