import type { Metadata } from 'next';
import { api } from '@/lib/api-client';
import { ProductCard } from '@/components/product/product-card';
import { EmptyState } from '@/components/shared/empty-state';
import type { Product, Brand } from '@/types/product';
import type { ApiResponse, PaginatedResponse } from '@/types/api';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { data } = await api.get<ApiResponse<Brand>>(`/brands/${slug}`);
    return { title: data.data.name, description: data.data.description ?? `Produtos da marca ${data.data.name}` };
  } catch {
    return { title: 'Marca' };
  }
}

async function getBrand(slug: string) {
  try {
    const { data } = await api.get<ApiResponse<Brand>>(`/brands/${slug}`);
    return data.data;
  } catch {
    return null;
  }
}

async function getProducts(brandId: string) {
  try {
    const { data } = await api.get<PaginatedResponse<Product>>('/products', { params: { brandId, perPage: 20 } });
    return data;
  } catch {
    return { data: [] as Product[], meta: { total: 0, page: 1, perPage: 20, lastPage: 1 } };
  }
}

export default async function BrandPage({ params }: Props) {
  const { slug } = await params;
  const brand = await getBrand(slug);

  if (!brand) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16">
        <EmptyState title="Marca não encontrada" description="A marca que você procura não existe." />
      </div>
    );
  }

  const products = await getProducts(brand.id);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{brand.name}</h1>
        {brand.description && <p className="mt-2 text-muted-foreground">{brand.description}</p>}
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
        <EmptyState title="Nenhum produto" description="Esta marca ainda não possui produtos." />
      )}
    </div>
  );
}
