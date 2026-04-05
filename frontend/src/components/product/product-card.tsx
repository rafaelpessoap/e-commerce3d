import Link from 'next/link';
import Image from 'next/image';
import { ROUTES, formatCurrency } from '@/lib/constants';
import { WishlistButton } from './wishlist-button';
import type { Product } from '@/types/product';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const images = product.images ?? [];
  const variations = product.variations ?? [];
  const mainImage = images.find((img) => img.isMain) ?? images[0];
  const mainImageUrl = mainImage?.mediaFile?.card ?? mainImage?.url ?? '';

  return (
    <Link
      href={ROUTES.product(product.slug)}
      className="group block overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-muted">
        {mainImage && mainImageUrl ? (
          <Image
            src={mainImageUrl}
            alt={mainImage.mediaFile?.alt ?? mainImage.altText ?? product.name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            Sem imagem
          </div>
        )}

        {product.featured && (
          <span className="absolute top-2 left-2 rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
            Destaque
          </span>
        )}

        {/* Wishlist */}
        <WishlistButton
          productId={product.id}
          productSlug={product.slug}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </div>

      {/* Info */}
      <div className="p-4">
        {product.category && (
          <p className="text-xs text-muted-foreground mb-1">
            {product.category.name}
          </p>
        )}

        <h3 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
          {product.name}
        </h3>

        {product.type === 'variable' && variations.length > 0 ? (() => {
          const prices = variations.map((v) => v.salePrice ?? v.price);
          const min = Math.min(...prices);
          const max = Math.max(...prices);
          return (
            <p className="mt-2 text-base font-bold text-primary">
              {min === max
                ? formatCurrency(min)
                : `${formatCurrency(min)} – ${formatCurrency(max)}`}
            </p>
          );
        })() : (
          <p className="mt-2 text-base font-bold">
            {product.salePrice && product.salePrice < product.basePrice ? (
              <>
                <span className="text-muted-foreground line-through text-sm font-normal mr-2">
                  {formatCurrency(product.basePrice)}
                </span>
                <span className="text-primary">{formatCurrency(product.salePrice)}</span>
              </>
            ) : (
              formatCurrency(product.basePrice)
            )}
          </p>
        )}

        {variations.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {variations.length} {variations.length > 1 ? 'variações' : 'variação'}
          </p>
        )}
      </div>
    </Link>
  );
}
