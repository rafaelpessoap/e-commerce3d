export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
export const API_TIMEOUT = parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT ?? '10000', 10);

export const SITE_NAME = 'Miniatures 3D';
export const SITE_DESCRIPTION = 'E-commerce de miniaturas 3D para colecionadores e jogadores de RPG';

export const ITEMS_PER_PAGE = 20;

export const ROUTES = {
  home: '/',
  products: '/produtos',
  product: (slug: string) => `/p/${slug}`,
  category: (slug: string) => `/c/${slug}`,
  tag: (slug: string) => `/t/${slug}`,
  brand: (slug: string) => `/m/${slug}`,
  search: '/busca',
  cart: '/carrinho',
  checkout: '/checkout',
  login: '/login',
  register: '/cadastro',
  account: '/minha-conta',
  orders: '/minha-conta/pedidos',
  wishlist: '/minha-conta/lista-de-desejos',
  admin: '/admin',
} as const;

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}
