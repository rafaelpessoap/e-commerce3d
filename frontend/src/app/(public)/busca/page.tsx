'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/product/product-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Pagination } from '@/components/shared/pagination';
import { api } from '@/lib/api-client';
import { ITEMS_PER_PAGE } from '@/lib/constants';
import type { Product } from '@/types/product';
import type { PaginatedResponse } from '@/types/api';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['search', search, page],
    queryFn: async () => {
      // Usa Elasticsearch via /api/v1/search
      const { data } = await api.get<PaginatedResponse<Product>>('/search', {
        params: { q: search, page, perPage: ITEMS_PER_PAGE },
      });
      return data;
    },
    enabled: search.length > 0,
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(query);
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-6">Buscar Produtos</h1>

      {/* Search form */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-xl mb-8">
        <Input
          placeholder="O que você procura?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" disabled={!query.trim()}>
          <Search className="h-4 w-4 mr-2" />
          Buscar
        </Button>
      </form>

      {/* Results */}
      {isLoading && (
        <p className="text-muted-foreground">Buscando...</p>
      )}

      {data && data.data.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            {data.meta.total} resultado{data.meta.total !== 1 ? 's' : ''} para &quot;{search}&quot;
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {data.data.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <Pagination
            page={page}
            lastPage={data.meta.lastPage}
            onPageChange={setPage}
          />
        </>
      )}

      {data && data.data.length === 0 && (
        <EmptyState
          title="Nenhum resultado"
          description={`Não encontramos produtos para "${search}". Tente outro termo.`}
        />
      )}

      {!search && !isLoading && (
        <EmptyState
          title="Digite algo para buscar"
          description="Use a barra acima para encontrar miniaturas."
        />
      )}
    </div>
  );
}
