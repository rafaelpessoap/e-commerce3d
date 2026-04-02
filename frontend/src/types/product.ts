export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  content?: string;
  basePrice: number;
  sku?: string;
  isActive: boolean;
  featured: boolean;
  category?: Category;
  brand?: Brand;
  tags: Tag[];
  images: ProductImage[];
  variations: ProductVariation[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductImage {
  id: string;
  url: string;
  altText?: string;
  order: number;
  isMain: boolean;
}

export interface ProductVariation {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  scale: Scale;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: string;
  children?: Category[];
  _count?: { products: number };
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  color?: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  description?: string;
}

export interface Scale {
  id: string;
  name: string;
  code: string;
  baseSize: number;
  multiplier: number;
}
