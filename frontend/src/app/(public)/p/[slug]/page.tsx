import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { formatCurrency, ROUTES } from '@/lib/constants';
import { EmptyState } from '@/components/shared/empty-state';
import { ProductCard } from '@/components/product/product-card';
import { WishlistButton } from '@/components/product/wishlist-button';
import { ReviewsSection } from '@/components/product/reviews-section';
import { AddToCartButton } from './add-to-cart-button';
import { ProductGallery } from './product-gallery';
import type { Product } from '@/types/product';
import type { ApiResponse } from '@/types/api';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { data } = await api.get<ApiResponse<Product>>(`/products/${slug}`);
    const p = data.data ?? data;
    return {
      title: p.name,
      description: p.shortDescription ?? p.description,
    };
  } catch {
    return { title: 'Produto' };
  }
}

async function getProduct(slug: string) {
  try {
    const { data } = await api.get(`/products/${slug}`);
    return data.data ?? data;
  } catch {
    return null;
  }
}

async function getRelatedProducts(categoryId: string | undefined, productId: string) {
  if (!categoryId) return [];
  try {
    const { data } = await api.get('/products', {
      params: { categoryId, perPage: 4 },
    });
    const items = data.data ?? [];
    // Exclui o próprio produto
    return items.filter((p: { id: string }) => p.id !== productId).slice(0, 4);
  } catch {
    return [];
  }
}

async function getDeliveryInfo(productId: string) {
  try {
    const { data } = await api.get(`/products/${productId}/delivery-info`);
    return data.data ?? data;
  } catch {
    return { baseDays: 3, extraDays: 0, totalDays: 3 };
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

  const [related, delivery] = await Promise.all([
    getRelatedProducts(product.categoryId, product.id),
    getDeliveryInfo(product.id),
  ]);

  const images = product.images ?? [];
  const variations = product.variations ?? [];
  const tags = product.tags ?? [];
  const attributes = product.attributes ?? [];
  const currentPrice = product.salePrice ?? product.basePrice;
  const hasDiscount = product.salePrice && product.salePrice < product.basePrice;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Gallery */}
        <ProductGallery images={images} productName={product.name} />

        {/* Info */}
        <div>
          {product.category && (
            <Link href={ROUTES.category(product.category.slug)} className="text-sm text-muted-foreground hover:text-primary">
              {product.category.name}
            </Link>
          )}

          <h1 className="text-3xl font-bold mt-1">{product.name}</h1>

          {product.brand && (
            <Link href={ROUTES.brand(product.brand.slug)} className="text-sm text-muted-foreground hover:text-primary mt-1 block">
              por {product.brand.name}
            </Link>
          )}

          {/* Price */}
          <div className="mt-6">
            {hasDiscount && (
              <p className="text-lg text-muted-foreground line-through">
                {formatCurrency(product.basePrice)}
              </p>
            )}
            <p className="text-3xl font-bold text-primary">
              {formatCurrency(currentPrice)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              ou {formatCurrency(currentPrice * 0.9)} no PIX (10% off)
            </p>
          </div>

          {/* Short description */}
          {product.shortDescription && (
            <p className="mt-4 text-sm text-muted-foreground">{product.shortDescription}</p>
          )}

          {/* Variations */}
          {variations.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium mb-3">Escalas disponíveis</h3>
              <div className="flex flex-wrap gap-2">
                {variations.map((v: { id: string; name: string; price: number; salePrice?: number; image?: string; scale: { name: string } }) => (
                  <div key={v.id} className="rounded border px-3 py-2 text-sm cursor-pointer hover:border-primary transition-colors">
                    <span className="font-medium">{v.scale?.name ?? v.name}</span>
                    <span className="text-muted-foreground ml-2">
                      {formatCurrency(v.salePrice ?? v.price)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {tags.map((tag: { id: string; name: string; slug: string; color?: string }) => (
                <Link
                  key={tag.id}
                  href={ROUTES.tag(tag.slug)}
                  className="rounded-full bg-secondary px-3 py-1 text-xs hover:opacity-80"
                  style={tag.color ? { backgroundColor: tag.color + '20', color: tag.color } : undefined}
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          )}

          {/* Add to cart + Wishlist */}
          <div className="mt-8 flex items-start gap-3">
            <div className="flex-1">
              <AddToCartButton productId={product.id} productName={product.name} />
            </div>
            <WishlistButton productId={product.id} productSlug={product.slug} className="h-12 w-12" />
          </div>

          {/* Delivery info */}
          <div className="mt-6 bg-muted/50 rounded-lg p-4 text-sm">
            <p>
              📦 Entrega em <span className="font-bold">{delivery.totalDays} dias úteis</span>
              {delivery.extraDays > 0 && (
                <span className="text-muted-foreground"> (3 base + {delivery.extraDays} adicionais)</span>
              )}
            </p>
          </div>

          {/* Attributes */}
          {attributes.length > 0 && (
            <div className="mt-8 border-t pt-6">
              <h3 className="text-sm font-medium mb-3">Características</h3>
              <div className="space-y-2">
                {attributes.map((pa: { id: string; attributeValue: { value: string; attribute: { name: string } } }) => (
                  <div key={pa.id} className="flex text-sm">
                    <span className="text-muted-foreground w-32">{pa.attributeValue.attribute.name}</span>
                    <span className="font-medium">{pa.attributeValue.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="mt-8 border-t pt-6">
            <h3 className="text-sm font-medium mb-3">Descrição</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
          </div>

          {product.content && (
            <div className="mt-6">
              <div className="prose prose-sm max-w-none text-muted-foreground" dangerouslySetInnerHTML={{ __html: product.content }} />
            </div>
          )}
        </div>
      </div>

      {/* Reviews */}
      <ReviewsSection productId={product.id} />

      {/* Related Products */}
      {related.length > 0 && (
        <div className="mt-16 border-t pt-12">
          <h2 className="text-2xl font-bold mb-6">Produtos Relacionados</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {related.map((p: Product) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
