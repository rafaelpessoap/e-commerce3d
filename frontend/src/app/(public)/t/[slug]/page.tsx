import type { Metadata } from 'next';
import { api } from '@/lib/api-client';
import { ProductCard } from '@/components/product/product-card';
import { EmptyState } from '@/components/shared/empty-state';
import type { Product } from '@/types/product';
import type { PaginatedResponse } from '@/types/api';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug.charAt(0).toUpperCase() + slug.slice(1) };
}

async function getProducts(tagSlug: string) {
  try {
    const { data } = await api.get<PaginatedResponse<Product>>('/products', {
      params: { search: tagSlug, perPage: 20 },
    });
    return data;
  } catch {
    return { data: [] as Product[], meta: { total: 0, page: 1, perPage: 20, lastPage: 1 } };
  }
}

export default async function TagPage({ params }: Props) {
  const { slug } = await params;
  const products = await getProducts(slug);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">#{slug}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {products.meta.total} produto{products.meta.total !== 1 ? 's' : ''}
        </p>
      </div>

      {products.data.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {products.data.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <EmptyState title="Nenhum produto" description="Nenhum produto com esta tag." />
      )}
    </div>
  );
}
