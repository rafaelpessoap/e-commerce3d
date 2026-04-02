# Schema Prisma Completo - E-commerce de Miniaturas 3D

## Schema Prisma 7.x (PostgreSQL)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
  previewFeatures = ["fullTextSearch"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================================
// ENUMS
// ============================================================================

enum UserRole {
  CUSTOMER
  ADMIN
}

enum ProductType {
  SIMPLE
  VARIABLE
  BUNDLE
}

enum ProductStatus {
  DRAFT
  ACTIVE
  INACTIVE
}

enum PriceModifierType {
  PERCENTAGE
  FIXED_ADD
  FIXED_PRICE
}

enum ScaleRuleScope {
  GLOBAL
  CATEGORY
  TAG
  PRODUCT
}

enum DiscountType {
  PERCENTAGE
  FIXED
}

enum CouponType {
  PERCENTAGE
  FIXED
  FREE_SHIPPING
}

enum OrderStatus {
  PENDING_PAYMENT
  PAYMENT_APPROVED
  PAYMENT_REJECTED
  PRODUCTION_QUEUE
  PRODUCING
  PACKAGING
  SHIPPED
  DELIVERED
  CANCELLED
  REFUNDED
}

enum PaymentMethodDiscountType {
  PERCENTAGE
  FIXED
}

enum SeoEntityType {
  PRODUCT
  CATEGORY
  TAG
  BRAND
  PAGE
  BLOG_POST
}

enum BlogPostStatus {
  DRAFT
  PUBLISHED
}

// ============================================================================
// USERS & ADDRESSES
// ============================================================================

model User {
  id                String    @id @default(cuid())
  email             String    @unique
  password          String    // hashed password
  name              String
  role              UserRole  @default(CUSTOMER)
  isActive          Boolean   @default(true)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Relations
  addresses         Address[]
  orders            Order[]
  wishlistItems     WishlistItem[]
  couponUsages      CouponUsage[]
  blogPosts         BlogPost[]
  auditLogs         AuditLog[]

  @@map("users")
}

model Address {
  id                String    @id @default(cuid())
  userId            String
  street            String
  number            String
  complement        String?
  neighborhood      String
  city              String
  state             String    @db.Char(2)
  zipCode           String    @db.Char(8)
  country           String    @default("BR")
  isDefault         Boolean   @default(false)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Relations
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("addresses")
}

// ============================================================================
// CATEGORIES & TAXONOMIES
// ============================================================================

model Category {
  id                String    @id @default(cuid())
  parentId          String?
  name              String
  slug              String    @unique
  description       String?
  image             String?
  sortOrder         Int       @default(0)
  isActive          Boolean   @default(true)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Relations
  parent            Category? @relation("CategoryHierarchy", fields: [parentId], references: [id], onDelete: SetNull)
  children          Category[] @relation("CategoryHierarchy")
  products          Product[]
  scaleRules        ScaleRule[]
  couponCategories  CouponCategory[]
  seoMetadata       SeoMetadata?

  @@index([parentId])
  @@index([slug])
  @@index([isActive])
  @@map("categories")
}

model Tag {
  id                String    @id @default(cuid())
  name              String
  slug              String    @unique
  isActive          Boolean   @default(true)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Relations
  productTags       ProductTag[]
  scaleRules        ScaleRule[]
  seoMetadata       SeoMetadata?

  @@index([slug])
  @@index([isActive])
  @@map("tags")
}

model Brand {
  id                String    @id @default(cuid())
  name              String
  slug              String    @unique
  description       String?
  logo              String?
  banner            String?
  isActive          Boolean   @default(true)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Relations
  products          Product[]
  seoMetadata       SeoMetadata?

  @@index([slug])
  @@index([isActive])
  @@map("brands")
}

// ============================================================================
// PRODUCTS & VARIATIONS
// ============================================================================

model Product {
  id                String    @id @default(cuid())
  name              String
  slug              String    @unique
  description       String?
  shortDescription  String?
  sku               String?   @unique
  price             Decimal   @db.Decimal(10, 2)
  salePrice         Decimal?  @db.Decimal(10, 2)
  stock             Int       @default(0)
  weight            Decimal?  @db.Decimal(8, 3)  // grams
  width             Decimal?  @db.Decimal(8, 2)  // cm
  height            Decimal?  @db.Decimal(8, 2)  // cm
  length            Decimal?  @db.Decimal(8, 2)  // cm
  type              ProductType @default(SIMPLE)
  status            ProductStatus @default(DRAFT)
  categoryId        String
  brandId           String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?  // soft delete

  // Relations
  category          Category  @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  brand             Brand?    @relation(fields: [brandId], references: [id], onDelete: SetNull)
  variations        ProductVariation[]
  images            ProductImage[]
  productTags       ProductTag[]
  scaleRules        ScaleRule[]
  bundleAsParent    ProductBundle?  // if type=BUNDLE, this product is the bundle
  bundleItems       BundleItem[]     // items inside a bundle
  orderItems        OrderItem[]
  wishlistItems     WishlistItem[]
  couponProducts    CouponProduct[]
  seoMetadata       SeoMetadata?

  @@index([status, categoryId])
  @@index([slug])
  @@index([sku])
  @@index([status, createdAt])
  @@index([categoryId])
  @@index([brandId])
  @@index([deletedAt])
  @@map("products")
}

model ProductTag {
  productId         String
  tagId             String

  // Relations
  product           Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  tag               Tag       @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([productId, tagId])
  @@index([tagId])
  @@map("product_tags")
}

model ProductVariation {
  id                String    @id @default(cuid())
  productId         String
  sku               String?   @unique
  price             Decimal   @db.Decimal(10, 2)
  salePrice         Decimal?  @db.Decimal(10, 2)
  stock             Int       @default(0)
  weight            Decimal?  @db.Decimal(8, 3)
  width             Decimal?  @db.Decimal(8, 2)
  height            Decimal?  @db.Decimal(8, 2)
  length            Decimal?  @db.Decimal(8, 2)
  attributes        Json      // {"color": "Red", "material": "Resin", "size": "Large"}
  isActive          Boolean   @default(true)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Relations
  product           Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  images            ProductImage[]
  orderItems        OrderItem[]
  bundleItems       BundleItem[]

  @@index([productId])
  @@index([sku])
  @@map("product_variations")
}

model ProductImage {
  id                String    @id @default(cuid())
  productId         String?
  variationId       String?
  url               String
  thumbnailUrl      String?   // 150x150
  mediumUrl         String?   // 500x500
  largeUrl          String?   // 1200x1200
  altText           String?
  sortOrder         Int       @default(0)
  isPrimary         Boolean   @default(false)
  createdAt         DateTime  @default(now())

  // Relations
  product           Product?  @relation(fields: [productId], references: [id], onDelete: Cascade)
  variation         ProductVariation? @relation(fields: [variationId], references: [id], onDelete: Cascade)

  @@index([productId])
  @@index([variationId])
  @@map("product_images")
}

// ============================================================================
// SCALES & SCALE RULES
// ============================================================================

model Scale {
  id                String    @id @default(cuid())
  name              String    @unique  // "28mm", "32mm", "1:72"
  slug              String    @unique
  sortOrder         Int       @default(0)
  isActive          Boolean   @default(true)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Relations
  scaleRules        ScaleRule[]

  @@map("scales")
}

model ScaleRule {
  id                String    @id @default(cuid())
  scaleId           String
  scope             ScaleRuleScope
  scopeId           String?   // categoryId, tagId, or productId depending on scope
  priceModifier     PriceModifierType
  modifierValue     Decimal   @db.Decimal(10, 2)
  isDefault         Boolean   @default(false)
  sortOrder         Int       @default(0)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Relations
  scale             Scale     @relation(fields: [scaleId], references: [id], onDelete: Cascade)
  category          Category? @relation(fields: [scopeId], references: [id], onDelete: Cascade)
  tag               Tag?      @relation(fields: [scopeId], references: [id], onDelete: Cascade)
  product           Product?  @relation(fields: [scopeId], references: [id], onDelete: Cascade)

  @@unique([scope, scopeId, scaleId])
  @@index([scaleId])
  @@index([scope])
  @@map("scale_rules")
}

// ============================================================================
// BUNDLES
// ============================================================================

model ProductBundle {
  id                String    @id @default(cuid())
  productId         String    @unique  // each bundle is a product itself
  discount          DiscountType
  discountValue     Decimal   @db.Decimal(10, 2)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Relations
  product           Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  items             BundleItem[]

  @@index([productId])
  @@map("product_bundles")
}

model BundleItem {
  id                String    @id @default(cuid())
  bundleId          String
  productId         String
  variationId       String?
  quantity          Int       @default(1)
  sortOrder         Int       @default(0)
  createdAt         DateTime  @default(now())

  // Relations
  bundle            ProductBundle @relation(fields: [bundleId], references: [id], onDelete: Cascade)
  product           Product   @relation(fields: [productId], references: [id], onDelete: Restrict)
  variation         ProductVariation? @relation(fields: [variationId], references: [id], onDelete: SetNull)

  @@index([bundleId])
  @@index([productId])
  @@index([variationId])
  @@map("bundle_items")
}

// ============================================================================
// ORDERS & ORDER MANAGEMENT
// ============================================================================

model Order {
  id                String    @id @default(cuid())
  orderNumber       String    @unique
  userId            String
  status            String    @default("PENDING_PAYMENT")
  subtotal          Decimal   @db.Decimal(10, 2)
  shippingCost      Decimal   @db.Decimal(10, 2) @default(0)
  discount          Decimal   @db.Decimal(10, 2) @default(0)
  total             Decimal   @db.Decimal(10, 2)
  couponId          String?
  paymentMethod     String?
  paymentId         String?   // Mercado Pago ID
  shippingMethod    String?
  shippingTrackingCode String?
  addressSnapshot   Json      // copy of address at order time
  notes             String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Relations
  user              User      @relation(fields: [userId], references: [id], onDelete: Restrict)
  coupon            Coupon?   @relation(fields: [couponId], references: [id], onDelete: SetNull)
  items             OrderItem[]
  statusHistory     OrderStatusHistory[]
  payments          Payment[]

  @@index([userId, status, createdAt])
  @@index([orderNumber])
  @@index([status])
  @@index([couponId])
  @@map("orders")
}

model OrderItem {
  id                String    @id @default(cuid())
  orderId           String
  productId         String
  variationId       String?
  scaleId           String?
  name              String    // snapshot
  sku               String?   // snapshot
  price             Decimal   @db.Decimal(10, 2)
  quantity          Int
  total             Decimal   @db.Decimal(10, 2)
  createdAt         DateTime  @default(now())

  // Relations
  order             Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product           Product   @relation(fields: [productId], references: [id], onDelete: Restrict)
  variation         ProductVariation? @relation(fields: [variationId], references: [id], onDelete: SetNull)
  scale             Scale?    @relation(fields: [scaleId], references: [id], onDelete: SetNull)

  @@index([orderId])
  @@index([productId])
  @@index([variationId])
  @@map("order_items")
}

model OrderStatus {
  id                String    @id @default(cuid())
  name              String    @unique
  slug              String    @unique
  description       String?
  color             String?   @db.Char(7)  // hex color #RRGGBB
  sortOrder         Int       @default(0)
  isDefault         Boolean   @default(false)
  isActive          Boolean   @default(true)
  createdAt         DateTime  @default(now())

  // Relations
  fromTransitions   OrderStatusTransition[] @relation("fromStatus")
  toTransitions     OrderStatusTransition[] @relation("toStatus")

  @@index([slug])
  @@map("order_statuses")
}

model OrderStatusTransition {
  id                String    @id @default(cuid())
  fromStatusId      String
  toStatusId        String
  createdAt         DateTime  @default(now())

  // Relations
  fromStatus        OrderStatus @relation("fromStatus", fields: [fromStatusId], references: [id], onDelete: Cascade)
  toStatus          OrderStatus @relation("toStatus", fields: [toStatusId], references: [id], onDelete: Cascade)

  @@unique([fromStatusId, toStatusId])
  @@index([fromStatusId])
  @@index([toStatusId])
  @@map("order_status_transitions")
}

model OrderStatusHistory {
  id                String    @id @default(cuid())
  orderId           String
  fromStatus        String
  toStatus          String
  changedBy         String?   // userId or "system"
  notes             String?
  createdAt         DateTime  @default(now())

  // Relations
  order             Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId])
  @@index([createdAt])
  @@map("order_status_history")
}

// ============================================================================
// PAYMENTS
// ============================================================================

model Payment {
  id                String    @id @default(cuid())
  orderId           String
  externalId        String    @unique  // Mercado Pago ID
  method            String    // "pix", "credit_card", "debit_card"
  status            String    // "pending", "approved", "rejected"
  amount            Decimal   @db.Decimal(10, 2)
  rawPayload        Json      // full Mercado Pago response
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Relations
  order             Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId])
  @@index([externalId])
  @@index([status])
  @@map("payments")
}

model PaymentMethodDiscount {
  id                String    @id @default(cuid())
  method            String    @unique  // "pix", "credit_card"
  discountType      PaymentMethodDiscountType
  discountValue     Decimal   @db.Decimal(10, 2)
  isActive          Boolean   @default(true)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@map("payment_method_discounts")
}

// ============================================================================
// COUPONS & PROMOTIONS
// ============================================================================

model Coupon {
  id                String    @id @default(cuid())
  code              String    @unique @db.VarChar(50)
  type              CouponType
  value             Decimal   @db.Decimal(10, 2)
  minOrderValue     Decimal?  @db.Decimal(10, 2)
  maxUses           Int?
  usesPerCustomer   Int       @default(1)
  validFrom         DateTime?
  validUntil        DateTime?
  isFirstPurchaseOnly Boolean  @default(false)
  isActive          Boolean   @default(true)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Relations
  usages            CouponUsage[]
  applicableCategories CouponCategory[]
  applicableProducts CouponProduct[]
  orders            Order[]

  @@index([code])
  @@index([isActive, validFrom, validUntil])
  @@map("coupons")
}

model CouponCategory {
  couponId          String
  categoryId        String

  // Relations
  coupon            Coupon    @relation(fields: [couponId], references: [id], onDelete: Cascade)
  category          Category  @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@id([couponId, categoryId])
  @@index([categoryId])
  @@map("coupon_categories")
}

model CouponProduct {
  couponId          String
  productId         String

  // Relations
  coupon            Coupon    @relation(fields: [couponId], references: [id], onDelete: Cascade)
  product           Product   @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@id([couponId, productId])
  @@index([productId])
  @@map("coupon_products")
}

model CouponUsage {
  id                String    @id @default(cuid())
  couponId          String
  userId            String
  orderId           String
  createdAt         DateTime  @default(now())

  // Relations
  coupon            Coupon    @relation(fields: [couponId], references: [id], onDelete: Cascade)
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  order             Order     @relation(references: [id], onDelete: Cascade)

  @@unique([couponId, orderId])
  @@index([userId])
  @@index([couponId])
  @@map("coupon_usages")
}

// ============================================================================
// SHIPPING
// ============================================================================

model FreeShippingRule {
  id                String    @id @default(cuid())
  name              String
  zipCodeStart      String    @db.Char(8)
  zipCodeEnd        String    @db.Char(8)
  minOrderValue     Decimal   @db.Decimal(10, 2)
  isActive          Boolean   @default(true)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([isActive])
  @@map("free_shipping_rules")
}

// ============================================================================
// WISHLIST
// ============================================================================

model WishlistItem {
  id                String    @id @default(cuid())
  userId            String
  productId         String
  createdAt         DateTime  @default(now())

  // Relations
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  product           Product   @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([userId, productId])
  @@index([userId])
  @@map("wishlist_items")
}

// ============================================================================
// SEO & CMS
// ============================================================================

model SeoMetadata {
  id                String    @id @default(cuid())
  entityType        SeoEntityType
  entityId          String
  metaTitle         String?
  metaDescription   String?
  ogTitle           String?
  ogDescription     String?
  ogImage           String?
  canonicalUrl      String?
  robots            String    @default("index,follow")
  schemaOrg         Json?     // structured data
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Relations - polymorphic, but we'll keep it flexible
  product           Product?  @relation(fields: [entityId], references: [id], onDelete: Cascade)
  category          Category? @relation(fields: [entityId], references: [id], onDelete: Cascade)
  tag               Tag?      @relation(fields: [entityId], references: [id], onDelete: Cascade)
  brand             Brand?    @relation(fields: [entityId], references: [id], onDelete: Cascade)
  blogPost          BlogPost? @relation(fields: [entityId], references: [id], onDelete: Cascade)

  @@unique([entityType, entityId])
  @@index([entityType])
  @@map("seo_metadata")
}

model Redirect {
  id                String    @id @default(cuid())
  fromUrl           String    @unique
  toUrl             String
  statusCode        Int       @default(301)
  isActive          Boolean   @default(true)
  createdAt         DateTime  @default(now())

  @@index([isActive])
  @@map("redirects")
}

model BlogPost {
  id                String    @id @default(cuid())
  title             String
  slug              String    @unique
  content           String    @db.Text
  excerpt           String?
  featuredImage     String?
  authorId          String
  status            BlogPostStatus @default(DRAFT)
  publishedAt       DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Relations
  author            User      @relation(fields: [authorId], references: [id], onDelete: Restrict)
  seoMetadata       SeoMetadata?

  @@index([slug])
  @@index([status, publishedAt])
  @@index([authorId])
  @@map("blog_posts")
}

model StaticPage {
  id                String    @id @default(cuid())
  title             String
  slug              String    @unique
  content           String    @db.Text
  isActive          Boolean   @default(true)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([slug])
  @@index([isActive])
  @@map("static_pages")
}

model SiteSettings {
  id                String    @id @default(cuid())
  key               String    @unique
  value             String
  group             String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([group])
  @@map("site_settings")
}

model EmailTemplate {
  id                String    @id @default(cuid())
  slug              String    @unique
  name              String
  subject           String
  body              String    @db.Text  // React Email template source
  statusTrigger     String?   // order status slug that triggers this
  isActive          Boolean   @default(true)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([statusTrigger])
  @@index([isActive])
  @@map("email_templates")
}

// ============================================================================
// AUDIT & LOGGING
// ============================================================================

model AuditLog {
  id                String    @id @default(cuid())
  userId            String?
  action            String
  entityType        String
  entityId          String
  oldValues         Json?
  newValues         Json?
  ipAddress         String?
  userAgent         String?
  createdAt         DateTime  @default(now())

  // Relations
  user              User?     @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([entityType, entityId])
  @@index([createdAt])
  @@map("audit_logs")
}

// ============================================================================
// Many-to-Many join table for OrderItem -> Scale (implicit)
// This is already handled via scaleId in OrderItem, no separate table needed
// ============================================================================
```

## Notas sobre Design e Implementação

### 1. Escolhas de Design

#### UUIDs vs Auto-increment

**Decisão: UUIDs (cuid()) para todas as tabelas**

Razões:
- **Distribuição**: Em um ambiente com múltiplos servidores ou shards, cuid() não causa conflitos
- **Privacidade**: Não exponibiliza sequências previsíveis (ex: `/product/1`, `/product/2`)
- **Compatibilidade**: Facilita migração de dados entre bancos ou replicação
- **Performance**: cuid() é otimizado para ordenação e tem melhor distribuição que UUID v4

Exceção: `scale` usa `id` como cuid() também pela consistência, mas poderia usar auto-increment se performance for crítica.

#### Soft Delete Strategy

**Implementação: Campo `deletedAt` nullable**

```prisma
deletedAt DateTime?
```

Benefícios:
- Recuperação de dados acidentalmente deletados
- Auditoria completa do ciclo de vida
- Retenção de histórico para compliance

**Implementação em queries:**
```typescript
// Para listar apenas produtos ativos
const products = await prisma.product.findMany({
  where: {
    deletedAt: null,
    status: "ACTIVE"
  }
});

// Para restaurar um produto
await prisma.product.update({
  where: { id },
  data: { deletedAt: null }
});
```

#### Enums vs Strings para Status

**Decisão: Enums do Prisma com fallback para String no banco**

- `ProductStatus`: enum com DRAFT, ACTIVE, INACTIVE
- `OrderStatus`: String flexível (permite adicionar novos status via seeding)

Razão: Order statuses é um sistema extensível que pode ter states customizados por negócio.

### 2. Estratégia de Snapshot para Orders

**Por que copiar dados no momento da compra?**

Quando um pedido é feito, copiamos:
1. Nome e SKU do produto → `OrderItem.name`, `OrderItem.sku`
2. Preço no momento → `OrderItem.price`
3. Endereço completo → `Order.addressSnapshot` (JSON)

Exemplo:

```typescript
// Criar OrderItem com dados do momento
const orderItem = await prisma.orderItem.create({
  data: {
    orderId: order.id,
    productId: product.id,
    variationId: variation?.id,
    name: product.name,  // snapshot
    sku: product.sku,    // snapshot
    price: product.salePrice || product.price,  // snapshot
    quantity: 2,
    total: (product.salePrice || product.price) * 2,
  }
});

// Copiar endereço completo no JSON
const order = await prisma.order.create({
  data: {
    orderNumber: "ORD-2026-001",
    userId,
    subtotal: subtotal,
    total: subtotal + shipping - discount,
    addressSnapshot: {
      street: address.street,
      number: address.number,
      complement: address.complement,
      neighborhood: address.neighborhood,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      country: address.country,
    },
  }
});
```

Razões:
- **Histórico Imutável**: Mesmo que o produto seja deletado ou preço mude, o pedido mantém o registro histórico
- **Compliance**: Documentação exata do que foi vendido e por quanto
- **Separação de Concerns**: Order Item não depende do estado atual do Product
- **Performance**: Queries de relatórios não precisam fazer JOINs complexos

### 3. Índices e Performance

#### Índices Estratégicos

**Produtos:**
```prisma
@@index([status, categoryId])        // filtros comuns
@@index([slug])                      // URLs amigáveis
@@index([sku])                       // busca por SKU
@@index([status, createdAt])         // listagens ordenadas
@@index([deletedAt])                 // filtrar soft-deletes
```

**Pedidos:**
```prisma
@@index([userId, status, createdAt]) // dashboard do cliente
@@index([orderNumber])               // busca rápida por número
@@index([status])                    // filtros administrativos
```

**Coupons:**
```prisma
@@index([code])                      // validação rápida
@@index([isActive, validFrom, validUntil])  // verificar validade
```

#### Compound Index para Escalas

```prisma
@@unique([scope, scopeId, scaleId])
```

Previne duplicatas e acelera lookups como:
```typescript
await prisma.scaleRule.findUnique({
  where: {
    scope_scopeId_scaleId: {
      scope: "CATEGORY",
      scopeId: categoryId,
      scaleId: "28mm"
    }
  }
});
```

### 4. Relações Polimórficas

**SeoMetadata com múltiplas entidades:**

O modelo usa `entityType` e `entityId` para ser flexível:

```typescript
// Para product
await prisma.seoMetadata.create({
  data: {
    entityType: "PRODUCT",
    entityId: product.id,
    metaTitle: "Miniatura 3D Premium",
    metaDescription: "Descrição SEO...",
  }
});

// Para category
await prisma.seoMetadata.create({
  data: {
    entityType: "CATEGORY",
    entityId: category.id,
    metaTitle: "Categoria de Dragões",
  }
});
```

### 5. Escala (Scale) e Modificadores de Preço

**Exemplo de uso:**

```typescript
// Para um produto em escala 28mm
// Se há regra GLOBAL -> CATEGORY -> PRODUCT, aplica em cascata

const basePrice = 100.00;
const scaleModifier = 1.15; // +15% para 28mm
const finalPrice = basePrice * scaleModifier; // 115.00
```

Regras de Escopo (precedência):
1. PRODUCT (mais específico)
2. CATEGORY
3. TAG
4. GLOBAL (menos específico)

### 6. Transições de Status de Pedido

**Validação de transições válidas:**

```typescript
// Apenas certas transições são permitidas
// pending_payment -> payment_approved, payment_rejected
// payment_approved -> production_queue
// etc.

const validTransition = await prisma.orderStatusTransition.findUnique({
  where: {
    fromStatusId_toStatusId: {
      fromStatusId: currentStatusId,
      toStatusId: newStatusId,
    }
  }
});

if (!validTransition) {
  throw new Error("Invalid status transition");
}
```

---

## Seed Data (seed.ts)

```typescript
// prisma/seed.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ============================================================================
  // ORDER STATUSES
  // ============================================================================

  const orderStatuses = await Promise.all([
    prisma.orderStatus.upsert({
      where: { slug: 'pending_payment' },
      update: {},
      create: {
        name: 'Pagamento Pendente',
        slug: 'pending_payment',
        description: 'Aguardando confirmação do pagamento',
        color: '#FFA500',
        sortOrder: 0,
        isDefault: true,
        isActive: true,
      },
    }),
    prisma.orderStatus.upsert({
      where: { slug: 'payment_approved' },
      update: {},
      create: {
        name: 'Pagamento Aprovado',
        slug: 'payment_approved',
        description: 'Pagamento confirmado, aguardando produção',
        color: '#4CAF50',
        sortOrder: 1,
        isActive: true,
      },
    }),
    prisma.orderStatus.upsert({
      where: { slug: 'payment_rejected' },
      update: {},
      create: {
        name: 'Pagamento Rejeitado',
        slug: 'payment_rejected',
        description: 'Pagamento foi recusado',
        color: '#F44336',
        sortOrder: 2,
        isActive: true,
      },
    }),
    prisma.orderStatus.upsert({
      where: { slug: 'production_queue' },
      update: {},
      create: {
        name: 'Fila de Produção',
        slug: 'production_queue',
        description: 'Aguardando começo da produção',
        color: '#2196F3',
        sortOrder: 3,
        isActive: true,
      },
    }),
    prisma.orderStatus.upsert({
      where: { slug: 'producing' },
      update: {},
      create: {
        name: 'Produzindo',
        slug: 'producing',
        description: 'Miniatura está sendo impressa/produzida',
        color: '#FF9800',
        sortOrder: 4,
        isActive: true,
      },
    }),
    prisma.orderStatus.upsert({
      where: { slug: 'packaging' },
      update: {},
      create: {
        name: 'Embalando',
        slug: 'packaging',
        description: 'Sendo preparada para envio',
        color: '#9C27B0',
        sortOrder: 5,
        isActive: true,
      },
    }),
    prisma.orderStatus.upsert({
      where: { slug: 'shipped' },
      update: {},
      create: {
        name: 'Enviado',
        slug: 'shipped',
        description: 'Pedido despachado, em trânsito',
        color: '#3F51B5',
        sortOrder: 6,
        isActive: true,
      },
    }),
    prisma.orderStatus.upsert({
      where: { slug: 'delivered' },
      update: {},
      create: {
        name: 'Entregue',
        slug: 'delivered',
        description: 'Pedido entregue ao cliente',
        color: '#4CAF50',
        sortOrder: 7,
        isActive: true,
      },
    }),
    prisma.orderStatus.upsert({
      where: { slug: 'cancelled' },
      update: {},
      create: {
        name: 'Cancelado',
        slug: 'cancelled',
        description: 'Pedido foi cancelado',
        color: '#9E9E9E',
        sortOrder: 8,
        isActive: true,
      },
    }),
    prisma.orderStatus.upsert({
      where: { slug: 'refunded' },
      update: {},
      create: {
        name: 'Reembolsado',
        slug: 'refunded',
        description: 'Pedido foi reembolsado',
        color: '#795548',
        sortOrder: 9,
        isActive: true,
      },
    }),
  ]);

  // ============================================================================
  // ORDER STATUS TRANSITIONS
  // ============================================================================

  const transitions = [
    { from: 'pending_payment', to: 'payment_approved' },
    { from: 'pending_payment', to: 'payment_rejected' },
    { from: 'pending_payment', to: 'cancelled' },
    { from: 'payment_approved', to: 'production_queue' },
    { from: 'payment_approved', to: 'cancelled' },
    { from: 'payment_rejected', to: 'pending_payment' },
    { from: 'payment_rejected', to: 'cancelled' },
    { from: 'production_queue', to: 'producing' },
    { from: 'production_queue', to: 'cancelled' },
    { from: 'producing', to: 'packaging' },
    { from: 'producing', to: 'cancelled' },
    { from: 'packaging', to: 'shipped' },
    { from: 'packaging', to: 'cancelled' },
    { from: 'shipped', to: 'delivered' },
    { from: 'delivered', to: 'refunded' },
    { from: 'cancelled', to: 'refunded' },
  ];

  for (const transition of transitions) {
    const fromStatus = orderStatuses.find(s => s.slug === transition.from);
    const toStatus = orderStatuses.find(s => s.slug === transition.to);

    if (fromStatus && toStatus) {
      await prisma.orderStatusTransition.upsert({
        where: {
          fromStatusId_toStatusId: {
            fromStatusId: fromStatus.id,
            toStatusId: toStatus.id,
          },
        },
        update: {},
        create: {
          fromStatusId: fromStatus.id,
          toStatusId: toStatus.id,
        },
      });
    }
  }

  // ============================================================================
  // EMAIL TEMPLATES
  // ============================================================================

  const emailTemplates = [
    {
      slug: 'order_confirmation',
      name: 'Confirmação de Pedido',
      subject: 'Seu pedido foi confirmado!',
      body: `
        <html>
          <body>
            <h1>Olá {{customerName}},</h1>
            <p>Seu pedido <strong>#{{orderNumber}}</strong> foi confirmado com sucesso!</p>
            <h2>Itens do Pedido:</h2>
            {{orderItems}}
            <p><strong>Total:</strong> R$ {{total}}</p>
            <p>Você receberá atualizações sobre o status da sua compra em breve.</p>
          </body>
        </html>
      `,
      statusTrigger: null,
    },
    {
      slug: 'payment_approved',
      name: 'Pagamento Aprovado',
      subject: 'Pagamento aprovado - Pedido em produção',
      body: `
        <html>
          <body>
            <h1>Pagamento Aprovado!</h1>
            <p>Seu pedido <strong>#{{orderNumber}}</strong> foi pago com sucesso.</p>
            <p>Agora estamos preparando sua miniatura 3D para produção.</p>
          </body>
        </html>
      `,
      statusTrigger: 'payment_approved',
    },
    {
      slug: 'order_shipped',
      name: 'Pedido Enviado',
      subject: 'Seu pedido foi enviado!',
      body: `
        <html>
          <body>
            <h1>Seu pedido está a caminho!</h1>
            <p>Pedido <strong>#{{orderNumber}}</strong> foi enviado.</p>
            <p><strong>Rastreamento:</strong> {{trackingCode}}</p>
          </body>
        </html>
      `,
      statusTrigger: 'shipped',
    },
    {
      slug: 'order_delivered',
      name: 'Pedido Entregue',
      subject: 'Seu pedido chegou!',
      body: `
        <html>
          <body>
            <h1>Pedido Entregue!</h1>
            <p>Sua miniatura 3D chegou segura.</p>
            <p>Agradecemos a compra!</p>
          </body>
        </html>
      `,
      statusTrigger: 'delivered',
    },
  ];

  for (const template of emailTemplates) {
    await prisma.emailTemplate.upsert({
      where: { slug: template.slug },
      update: { body: template.body, subject: template.subject },
      create: {
        slug: template.slug,
        name: template.name,
        subject: template.subject,
        body: template.body,
        statusTrigger: template.statusTrigger,
        isActive: true,
      },
    });
  }

  // ============================================================================
  // SITE SETTINGS
  // ============================================================================

  const siteSettings = [
    { key: 'store_name', value: 'Miniaturas 3D Premium', group: 'general' },
    { key: 'store_email', value: 'contato@miniaturas3d.com', group: 'general' },
    { key: 'store_phone', value: '+55 11 9999-9999', group: 'general' },
    { key: 'store_address', value: 'Rua das Miniaturas, 123', group: 'general' },
    { key: 'store_city', value: 'São Paulo', group: 'general' },
    { key: 'store_state', value: 'SP', group: 'general' },
    { key: 'store_zip', value: '01234-567', group: 'general' },
    { key: 'currency', value: 'BRL', group: 'commerce' },
    { key: 'default_shipping_cost', value: '15.00', group: 'shipping' },
    { key: 'free_shipping_threshold', value: '100.00', group: 'shipping' },
    { key: 'mercado_pago_access_token', value: '', group: 'payment' },
    { key: 'mercado_pago_public_key', value: '', group: 'payment' },
    { key: 'sendgrid_api_key', value: '', group: 'email' },
    { key: 'production_lead_time_days', value: '7', group: 'operations' },
  ];

  for (const setting of siteSettings) {
    await prisma.siteSettings.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: {
        key: setting.key,
        value: setting.value,
        group: setting.group,
      },
    });
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## Scripts de Execução

```bash
# Criar migration
npx prisma migrate dev --name initial_schema

# Executar seed
npx ts-node prisma/seed.ts

# Gerar Prisma Client
npx prisma generate

# Validar schema
npx prisma validate

# Abrir Prisma Studio (GUI)
npx prisma studio
```

---

## Considerações Adicionais

1. **Full-Text Search**: Está declarado em `previewFeatures` mas requer PostgreSQL 12+
2. **Timezone**: Todas as datas usam `DateTime` UTC do Prisma (configure TZ do servidor)
3. **Cascades**: `onDelete: Cascade` é usado liberalmente para integridade referencial automática
4. **Soft Deletes**: Filtre `deletedAt: null` SEMPRE em queries públicas
5. **JSON Fields**: Para `attributes`, `addressSnapshot`, `rawPayload` — considere usar PostgreSQL JSONB para melhor performance
