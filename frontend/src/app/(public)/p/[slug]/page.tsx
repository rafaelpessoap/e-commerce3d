import type { Metadata } from 'next';
import Image from 'next/image';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/constants';
import { EmptyState } from '@/components/shared/empty-state';
import { AddToCartButton } from './add-to-cart-button';
import type { Product } from '@/types/product';
import type { ApiResponse } from '@/types/api';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { data } = await api.get<ApiResponse<Product>>(`/products/${slug}`);
    return {
      title: data.data.name,
      description: data.data.description,
    };
  } catch {
    return { title: 'Produto' };
  }
}

async function getProduct(slug: string) {
  try {
    const { data } = await api.get<ApiResponse<Product>>(`/products/${slug}`);
    return data.data;
  } catch {
    return null;
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16">
        <EmptyState title="Produto não encontrado" description="O produto que você procura não existe ou foi removido." />
      </div>
    );
  }

  const mainImage = product.images.find((img) => img.isMain) ?? product.images[0];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Gallery */}
        <div>
          <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
            {mainImage ? (
              <Image
                src={mainImage.url}
                alt={mainImage.altText ?? product.name}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Sem imagem
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {product.images.length > 1 && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {product.images.map((img) => (
                <div key={img.id} className="relative aspect-square overflow-hidden rounded border bg-muted">
                  <Image
                    src={img.url}
                    alt={img.altText ?? ''}
                    fill
                    className="object-cover"
                    sizes="100px"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          {product.category && (
            <p className="text-sm text-muted-foreground mb-2">
              {product.category.name}
            </p>
          )}

          <h1 className="text-3xl font-bold">{product.name}</h1>

          {product.brand && (
            <p className="text-sm text-muted-foreground mt-1">
              por {product.brand.name}
            </p>
          )}

          <div className="mt-6">
            <p className="text-3xl font-bold text-primary">
              {formatCurrency(product.basePrice)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              ou {formatCurrency(product.basePrice * 0.9)} no PIX (10% off)
            </p>
          </div>

          {/* Escalas / Variações */}
          {product.variations.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium mb-3">Escalas disponíveis</h3>
              <div className="flex flex-wrap gap-2">
                {product.variations.map((v) => (
                  <div
                    key={v.id}
                    className="rounded border px-3 py-2 text-sm cursor-pointer hover:border-primary transition-colors"
                  >
                    <span className="font-medium">{v.scale.name}</span>
                    <span className="text-muted-foreground ml-2">
                      {formatCurrency(v.price)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {product.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {product.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full bg-secondary px-3 py-1 text-xs"
                  style={tag.color ? { backgroundColor: tag.color + '20', color: tag.color } : undefined}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Add to cart */}
          <div className="mt-8">
            <AddToCartButton productId={product.id} productName={product.name} />
          </div>

          {/* Description */}
          <div className="mt-8 border-t pt-8">
            <h3 className="text-sm font-medium mb-3">Descrição</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {product.description}
            </p>
          </div>

          {product.content && (
            <div className="mt-6">
              <div
                className="prose prose-sm max-w-none text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: product.content }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
