'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ProductCard } from '@/components/product/product-card';
import { Pagination } from '@/components/shared/pagination';
import { EmptyState } from '@/components/shared/empty-state';
import { FilterSidebar } from '@/components/shared/filter-sidebar';
import { api } from '@/lib/api-client';
import { ITEMS_PER_PAGE } from '@/lib/constants';
import type { Product } from '@/types/product';
import type { PaginatedResponse } from '@/types/api';

export default function ProductsPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<{
    attributeValueIds: string[];
    brandId?: string;
    priceMin?: number;
    priceMax?: number;
  }>({ attributeValueIds: [] });

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, filters],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, perPage: ITEMS_PER_PAGE };
      if (filters.brandId) params.brandId = filters.brandId;
      if (filters.attributeValueIds.length) params.attributes = filters.attributeValueIds.join(',');
      if (filters.priceMin) params.priceMin = filters.priceMin;
      if (filters.priceMax) params.priceMax = filters.priceMax;

      const { data } = await api.get<PaginatedResponse<Product>>('/products', { params });
      return data;
    },
  });

  function handleFilterChange(newFilters: typeof filters) {
    setFilters(newFilters);
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-2">Produtos</h1>
      <p className="text-muted-foreground mb-8">
        {data?.meta?.total ?? 0} produto{(data?.meta?.total ?? 0) !== 1 ? 's' : ''}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8">
        {/* Sidebar */}
        <aside className="hidden lg:block">
          <FilterSidebar onFilterChange={handleFilterChange} />
        </aside>

        {/* Products */}
        <div>
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : data && data.data.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
                {data.data.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <Pagination page={page} lastPage={data.meta.lastPage} onPageChange={setPage} />
            </>
          ) : (
            <EmptyState title="Nenhum produto" description="Nenhum produto encontrado com estes filtros." />
          )}
        </div>
      </div>
    </div>
  );
}
