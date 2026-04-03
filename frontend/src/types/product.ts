export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  content?: string;
  type?: string; // "simple" | "variable"
  basePrice: number;
  salePrice?: number;
  sku?: string;
  gtin?: string;
  manageStock?: boolean;
  stock?: number;
  weight?: number;
  width?: number;
  height?: number;
  length?: number;
  extraDays?: number;
  isActive: boolean;
  featured: boolean;
  categoryId?: string;
  category?: Category;
  brandId?: string;
  brand?: Brand;
  tags: Tag[];
  images: ProductImage[];
  variations: ProductVariation[];
  attributes?: ProductAttribute[];
  relatedProducts?: RelatedProduct[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductImage {
  id: string;
  url?: string; // legacy
  altText?: string;
  order: number;
  isMain: boolean;
  mediaFileId?: string;
  mediaFile?: MediaFile;
}

export interface MediaFile {
  id: string;
  filename: string;
  thumb: string;
  card: string;
  gallery: string;
  full: string;
  alt?: string;
  title?: string;
  description?: string;
  width?: number;
  height?: number;
}

export interface ProductVariation {
  id: string;
  name: string;
  sku: string;
  gtin?: string;
  price: number;
  salePrice?: number;
  stock: number;
  image?: string;
  scale: Scale;
}

export interface ProductAttribute {
  id: string;
  attributeValueId: string;
  attributeValue: {
    id: string;
    value: string;
    attribute: {
      id: string;
      name: string;
    };
  };
}

export interface RelatedProduct {
  id: string;
  type: string;
  targetId: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: string;
  children?: Category[];
  extraDays?: number;
  _count?: { products: number };
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  color?: string;
  extraDays?: number;
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
