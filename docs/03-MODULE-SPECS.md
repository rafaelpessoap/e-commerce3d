# Especificações de Módulos - Backend E-commerce Miniaturas 3D

## Auth Module

### Descrição
Módulo responsável por autenticação, registro e gerenciamento de credenciais de usuários. Implementa JWT com access token de curta duração e refresh token de longa duração. Inclui recuperação de senha via email.

### Endpoints da API

| Método | Rota | Descrição | Autenticação |
|--------|------|-----------|--------------|
| POST | `/auth/register` | Registrar novo usuário | Nenhuma |
| POST | `/auth/login` | Autenticar com email e senha | Nenhuma |
| POST | `/auth/refresh` | Renovar tokens usando refresh token | Nenhuma |
| POST | `/auth/forgot-password` | Solicitar reset de senha | Nenhuma |
| POST | `/auth/reset-password` | Executar reset de senha | Nenhuma |

### DTOs

#### RegisterDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| name | string | @IsNotEmpty(), @MinLength(3), @MaxLength(100) |
| email | string | @IsEmail(), @IsNotEmpty() |
| password | string | @IsNotEmpty(), @MinLength(8), @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/) |
| passwordConfirmation | string | @IsNotEmpty(), @ValidateIf(o => o.password !== o.passwordConfirmation, { message: 'Passwords must match' }) |

#### LoginDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| email | string | @IsEmail(), @IsNotEmpty() |
| password | string | @IsNotEmpty() |

#### RefreshTokenDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| refreshToken | string | @IsNotEmpty(), @IsJWT() |

#### ForgotPasswordDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| email | string | @IsEmail(), @IsNotEmpty() |

#### ResetPasswordDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| token | string | @IsNotEmpty() |
| newPassword | string | @IsNotEmpty(), @MinLength(8), @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/) |
| passwordConfirmation | string | @IsNotEmpty() |

### Regras de Negócio

1. **Senha deve conter**: mínimo 8 caracteres, 1 maiúscula, 1 número, 1 caractere especial (@$!%*?&)
2. **Access token expira em**: 15 minutos
3. **Refresh token expira em**: 7 dias
4. **Hash de senha**: usar bcrypt com salt rounds = 10
5. **Email único**: não permitir dois usuários com mesmo email
6. **Roles padrão**: novo usuário nasce com role "customer"
7. **Token reset de senha**: válido por 1 hora, pode ser usado apenas uma vez
8. **Rate limiting**: máximo 5 tentativas de login falhas em 15 minutos (bloqueia por 15 min)
9. **Confirmação de email**: opcional na primeira fase, mas recomendado implementar

### Dependências
- Users Module (vinculação de usuário)
- Email Module (envio de emails de reset)

---

## Users Module

### Descrição
Módulo para gerenciamento de dados de perfil do usuário. Permite que usuários visualizem e atualizem suas informações pessoais. Admins podem listar todos os usuários.

### Endpoints da API

| Método | Rota | Descrição | Autenticação |
|--------|------|-----------|--------------|
| GET | `/users/me` | Dados do usuário logado | JWT (customer, admin) |
| PUT | `/users/me` | Atualizar dados do usuário | JWT (customer, admin) |
| PUT | `/users/me/password` | Alterar senha | JWT (customer, admin) |
| GET | `/users` | Listar todos os usuários | JWT (admin) |
| GET | `/users/:id` | Detalhe de um usuário | JWT (admin) |
| DELETE | `/users/:id` | Deletar usuário | JWT (admin) |

### DTOs

#### UpdateProfileDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| name | string | @IsNotEmpty(), @MinLength(3), @MaxLength(100) |
| email | string | @IsEmail() |
| phone | string | @IsOptional(), @Matches(/^\d{10,15}$/) |
| birthDate | Date | @IsOptional(), @IsDate() |
| document | string | @IsOptional(), @Length(11, 14) |

#### ChangePasswordDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| currentPassword | string | @IsNotEmpty() |
| newPassword | string | @IsNotEmpty(), @MinLength(8), @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/) |
| passwordConfirmation | string | @IsNotEmpty() |

#### UserResponseDto
| Campo | Tipo |
|-------|------|
| id | UUID |
| name | string |
| email | string |
| phone | string |
| birthDate | Date |
| document | string |
| role | 'customer' \| 'admin' |
| isActive | boolean |
| createdAt | Date |
| updatedAt | Date |

### Regras de Negócio

1. **Email único**: validar que novo email não existe no sistema
2. **Verificação de senha**: confirmar senha atual antes de alterar
3. **Sem alteração de role**: usuário customer não pode alterar sua própria role
4. **Admin pode desativar**: admin pode definir isActive = false
5. **Auditoria**: registrar quem alterou e quando em qualquer atualização
6. **Deletion soft**: ao deletar usuário, marcar como inativo em vez de remover físicamente
7. **Dados imutáveis**: id, createdAt não podem ser alterados

### Dependências
- Auth Module (validação de tokens)
- Addresses Module (endereços vinculados)
- Orders Module (pedidos do usuário)

---

## Addresses Module

### Descrição
Módulo para gerenciar endereços de entrega dos usuários. Suporta CRUD completo com busca automática de dados via API ViaCEP. Cada usuário pode ter múltiplos endereços com um marcado como padrão.

### Endpoints da API

| Método | Rota | Descrição | Autenticação |
|--------|------|-----------|--------------|
| GET | `/addresses` | Listar endereços do usuário | JWT (customer, admin) |
| POST | `/addresses` | Criar novo endereço | JWT (customer, admin) |
| GET | `/addresses/:id` | Detalhe de um endereço | JWT (customer, admin) |
| PUT | `/addresses/:id` | Atualizar endereço | JWT (customer, admin) |
| DELETE | `/addresses/:id` | Deletar endereço | JWT (customer, admin) |

### DTOs

#### CreateAddressDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| zipCode | string | @IsNotEmpty(), @Matches(/^\d{8}$/) |
| street | string | @IsNotEmpty(), @MinLength(3) |
| number | string | @IsNotEmpty() |
| complement | string | @IsOptional(), @MaxLength(100) |
| neighborhood | string | @IsNotEmpty(), @MinLength(3) |
| city | string | @IsNotEmpty(), @MinLength(3) |
| state | string | @IsNotEmpty(), @Length(2) |
| isDefault | boolean | @IsBoolean(), @IsOptional() |

#### UpdateAddressDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| street | string | @IsOptional(), @MinLength(3) |
| number | string | @IsOptional() |
| complement | string | @IsOptional(), @MaxLength(100) |
| neighborhood | string | @IsOptional(), @MinLength(3) |
| city | string | @IsOptional(), @MinLength(3) |
| state | string | @IsOptional(), @Length(2) |
| isDefault | boolean | @IsOptional() |

#### AddressResponseDto
| Campo | Tipo |
|-------|------|
| id | UUID |
| userId | UUID |
| zipCode | string |
| street | string |
| number | string |
| complement | string |
| neighborhood | string |
| city | string |
| state | string |
| isDefault | boolean |
| createdAt | Date |
| updatedAt | Date |

### Regras de Negócio

1. **Busca CEP automática**: ao criar/atualizar, chamar ViaCEP para validar e preencher dados
2. **Um padrão por usuário**: apenas um endereço pode ter isDefault = true
3. **Transição de padrão**: ao marcar novo como padrão, desmarcar o antigo
4. **Permissão**: usuário só pode ver/editar seus próprios endereços
5. **CEP formato**: aceitar apenas 8 dígitos (com ou sem hífen, normalizar)
6. **Não deletar se único**: não permitir deletar o único endereço do usuário
7. **ViaCEP timeout**: se falhar, permitir preenchimento manual com validação estendida

### Dependências
- Users Module (vinculação ao usuário)
- External API (ViaCEP)

---

## Products Module

### Descrição
Módulo central de catálogo de produtos. Suporta três tipos de produtos: simples, variável e bundle. Inclui CRUD completo para admins, listagem pública com paginação e filtros. Cada produto pode ter múltiplas imagens, variações com preços diferentes e metadados SEO.

### Endpoints da API

| Método | Rota | Descrição | Autenticação |
|--------|------|-----------|--------------|
| GET | `/products` | Listar produtos (paginado, com filtros) | Nenhuma |
| GET | `/products/:slug` | Detalhe público de produto | Nenhuma |
| POST | `/products` | Criar produto | JWT (admin) |
| PUT | `/products/:id` | Atualizar produto | JWT (admin) |
| DELETE | `/products/:id` | Deletar produto | JWT (admin) |
| GET | `/products/:id/variations` | Listar variações | Nenhuma |

### DTOs

#### CreateProductDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| name | string | @IsNotEmpty(), @MinLength(3), @MaxLength(200) |
| description | string | @IsNotEmpty(), @MinLength(10) |
| shortDescription | string | @IsNotEmpty(), @MaxLength(160) |
| price | number | @IsNotEmpty(), @IsPositive(), @Decimal(10, 2) |
| salePrice | number | @IsOptional(), @IsPositive(), @Decimal(10, 2) |
| sku | string | @IsNotEmpty(), @Unique() |
| stock | number | @IsNotEmpty(), @Min(0), @IsInt() |
| weight | number | @IsNotEmpty(), @IsPositive() |
| width | number | @IsNotEmpty(), @IsPositive() |
| height | number | @IsNotEmpty(), @IsPositive() |
| length | number | @IsNotEmpty(), @IsPositive() |
| type | 'simple' \| 'variable' \| 'bundle' | @IsIn(['simple', 'variable', 'bundle']) |
| status | 'draft' \| 'active' \| 'inactive' | @IsIn(['draft', 'active', 'inactive']) |
| categoryId | UUID | @IsNotEmpty(), @IsUUID() |
| brandId | UUID | @IsOptional(), @IsUUID() |
| tagIds | UUID[] | @IsArray(), @ArrayMinSize(1), @IsUUID({ each: true }) |
| images | CreateProductImageDto[] | @IsArray(), @ValidateNested() |

#### CreateProductImageDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| mediaId | UUID | @IsNotEmpty(), @IsUUID() |
| alt | string | @IsNotEmpty(), @MaxLength(200) |
| sortOrder | number | @IsInt(), @Min(0) |
| isMain | boolean | @IsBoolean() |

#### UpdateProductDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| name | string | @IsOptional(), @MinLength(3), @MaxLength(200) |
| description | string | @IsOptional(), @MinLength(10) |
| shortDescription | string | @IsOptional(), @MaxLength(160) |
| price | number | @IsOptional(), @IsPositive(), @Decimal(10, 2) |
| salePrice | number | @IsOptional(), @IsPositive(), @Decimal(10, 2) |
| stock | number | @IsOptional(), @Min(0), @IsInt() |
| status | 'draft' \| 'active' \| 'inactive' | @IsOptional() |
| categoryId | UUID | @IsOptional(), @IsUUID() |
| brandId | UUID | @IsOptional(), @IsUUID() |
| tagIds | UUID[] | @IsOptional(), @IsArray() |

#### ProductListQueryDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| page | number | @IsOptional(), @Min(1), @IsInt() |
| limit | number | @IsOptional(), @Min(1), @Max(100), @IsInt() |
| sort | string | @IsOptional(), @IsIn(['newest', 'price_asc', 'price_desc', 'name_asc']) |
| categoryId | UUID | @IsOptional(), @IsUUID() |
| brandId | UUID | @IsOptional(), @IsUUID() |
| tagId | UUID | @IsOptional(), @IsUUID() |
| priceMin | number | @IsOptional(), @IsPositive() |
| priceMax | number | @IsOptional(), @IsPositive() |
| search | string | @IsOptional(), @MaxLength(100) |
| scaleId | UUID | @IsOptional(), @IsUUID() |

#### ProductResponseDto
| Campo | Tipo |
|-------|------|
| id | UUID |
| name | string |
| slug | string |
| description | string |
| shortDescription | string |
| price | number |
| salePrice | number \| null |
| sku | string |
| stock | number |
| weight | number |
| width | number |
| height | number |
| length | number |
| type | 'simple' \| 'variable' \| 'bundle' |
| status | 'draft' \| 'active' \| 'inactive' |
| category | CategoryResponseDto |
| brand | BrandResponseDto \| null |
| tags | TagResponseDto[] |
| images | ProductImageResponseDto[] |
| variations | VariationResponseDto[] (se type = variable) |
| createdAt | Date |
| updatedAt | Date |

### Regras de Negócio

1. **Slug único e auto-gerado**: criar a partir do name, verificar unicidade, usar slug-case (lowercase, hífens)
2. **Preço de venda opcional**: se salePrice não informado, usar price
3. **SKU único**: não permitir dois produtos com mesmo SKU
4. **Tipo imutável**: após criar, não permitir alterar type
5. **Status draft**: produtos novos começam como draft, visíveis apenas para admin
6. **Status active**: apenas produtos active são vistos no catálogo público
7. **Variações**: tipo "variable" deve ter pelo menos 1 variação, tipo "simple" não pode ter
8. **Imagem principal**: deve haver exatamente uma isMain = true
9. **Estoque negativo**: não permitir stock < 0 (exceto admin com override)
10. **Dimensões positivas**: width, height, length, weight devem ser > 0
11. **Reindexação**: ao criar/atualizar/deletar, enviar job para Elasticsearch
12. **Soft delete**: ao deletar, marcar como inactive em vez de remover fisicamente
13. **Histórico**: manter registro de alterações (opcionalmente via changelog table)

### Dependências
- Categories Module (vinculação)
- Brands Module (vinculação)
- Tags Module (vinculação)
- Media Module (imagens)
- Scales Module (preços com escala)
- Variations Module (variações)
- Search Module (reindexação)
- SEO Module (metadados)

---

## Variations Module

### Descrição
Submódulo de produtos que gerencia variações (cores, tamanhos, etc.) para produtos do tipo "variable". Cada variação tem preço, SKU e estoque próprios, além de atributos JSON flexíveis e múltiplas imagens.

### Endpoints da API

| Método | Rota | Descrição | Autenticação |
|--------|------|-----------|--------------|
| POST | `/products/:productId/variations` | Criar variação | JWT (admin) |
| PUT | `/products/:productId/variations/:id` | Atualizar variação | JWT (admin) |
| DELETE | `/products/:productId/variations/:id` | Deletar variação | JWT (admin) |
| GET | `/products/:productId/variations` | Listar variações | Nenhuma |

### DTOs

#### CreateVariationDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| price | number | @IsNotEmpty(), @IsPositive(), @Decimal(10, 2) |
| salePrice | number | @IsOptional(), @IsPositive(), @Decimal(10, 2) |
| sku | string | @IsNotEmpty(), @Unique() |
| stock | number | @IsNotEmpty(), @Min(0), @IsInt() |
| weight | number | @IsOptional(), @IsPositive() |
| width | number | @IsOptional(), @IsPositive() |
| height | number | @IsOptional(), @IsPositive() |
| length | number | @IsOptional(), @IsPositive() |
| attributes | Record<string, any> | @IsObject() |
| images | CreateVariationImageDto[] | @IsArray(), @ValidateNested() |
| sortOrder | number | @IsInt(), @Min(0) |

#### UpdateVariationDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| price | number | @IsOptional(), @IsPositive(), @Decimal(10, 2) |
| salePrice | number | @IsOptional(), @IsPositive(), @Decimal(10, 2) |
| stock | number | @IsOptional(), @Min(0), @IsInt() |
| attributes | Record<string, any> | @IsOptional() |
| sortOrder | number | @IsOptional(), @IsInt() |

#### VariationResponseDto
| Campo | Tipo |
|-------|------|
| id | UUID |
| productId | UUID |
| price | number |
| salePrice | number \| null |
| sku | string |
| stock | number |
| weight | number |
| width | number |
| height | number |
| length | number |
| attributes | Record<string, any> |
| images | VariationImageResponseDto[] |
| sortOrder | number |

### Regras de Negócio

1. **Só para produtos variable**: só permite criar se produto.type = "variable"
2. **SKU único por variação**: não permitir duplicatas dentro do produto
3. **Atributos JSON**: armazenar como JSONB no PostgreSQL, sem validação de schema rígida
4. **Imagem obrigatória**: cada variação deve ter pelo menos 1 imagem
5. **Herança de dimensões**: se não informadas, herdar do produto pai
6. **Estoque**: rastrear independentemente da variação
7. **Preço**: pode ser diferente do produto base

### Dependências
- Products Module (produto pai)
- Media Module (imagens)

---

## Categories Module

### Descrição
Módulo para gerenciar categorias de produtos em estrutura hierárquica. Suporta categorias aninhadas (pai/filho) com imagens, slug único e ordenação customizada. Listagem pública em árvore.

### Endpoints da API

| Método | Rota | Descrição | Autenticação |
|--------|------|-----------|--------------|
| GET | `/categories` | Listar categorias (árvore) | Nenhuma |
| GET | `/categories/:slug` | Detalhe de categoria com produtos | Nenhuma |
| POST | `/categories` | Criar categoria | JWT (admin) |
| PUT | `/categories/:id` | Atualizar categoria | JWT (admin) |
| DELETE | `/categories/:id` | Deletar categoria | JWT (admin) |

### DTOs

#### CreateCategoryDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| name | string | @IsNotEmpty(), @MinLength(3), @MaxLength(100) |
| description | string | @IsOptional(), @MaxLength(500) |
| parentId | UUID | @IsOptional(), @IsUUID() |
| imageId | UUID | @IsOptional(), @IsUUID() |
| sortOrder | number | @IsInt(), @Min(0) |
| isActive | boolean | @IsBoolean() |

#### UpdateCategoryDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| name | string | @IsOptional(), @MinLength(3), @MaxLength(100) |
| description | string | @IsOptional(), @MaxLength(500) |
| parentId | UUID | @IsOptional(), @IsUUID() |
| imageId | UUID | @IsOptional(), @IsUUID() |
| sortOrder | number | @IsOptional(), @IsInt() |
| isActive | boolean | @IsOptional() |

#### CategoryResponseDto
| Campo | Tipo |
|-------|------|
| id | UUID |
| name | string |
| slug | string |
| description | string |
| image | MediaResponseDto \| null |
| parentId | UUID \| null |
| sortOrder | number |
| isActive | boolean |
| children | CategoryResponseDto[] |
| productCount | number |
| createdAt | Date |
| updatedAt | Date |

### Regras de Negócio

1. **Slug único e auto-gerado**: criar a partir do name
2. **Ciclo infinito**: não permitir que uma categoria seja pai de si mesma ou ancestral dela
3. **Profundidade máxima**: limitar a 3 níveis (opcional)
4. **Ativo por herança**: desativar pai não desativa filhos automaticamente, mas não aparecem no catálogo
5. **Listagem hierárquica**: retornar em árvore com children aninhados
6. **Ordenação**: ordenar por sortOrder dentro de cada nível
7. **Soft delete**: ao deletar, marcar como inactive

### Dependências
- Media Module (imagens)
- Products Module (contagem de produtos)

---

## Tags Module

### Descrição
Módulo simples para gerenciar tags/labels de produtos. Tags facilitam filtragem e busca com estrutura flat (sem hierarquia).

### Endpoints da API

| Método | Rota | Descrição | Autenticação |
|--------|------|-----------|--------------|
| GET | `/tags` | Listar tags | Nenhuma |
| POST | `/tags` | Criar tag | JWT (admin) |
| PUT | `/tags/:id` | Atualizar tag | JWT (admin) |
| DELETE | `/tags/:id` | Deletar tag | JWT (admin) |

### DTOs

#### CreateTagDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| name | string | @IsNotEmpty(), @MinLength(2), @MaxLength(50), @Unique() |
| isActive | boolean | @IsBoolean() |

#### UpdateTagDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| name | string | @IsOptional(), @MinLength(2), @MaxLength(50) |
| isActive | boolean | @IsOptional() |

#### TagResponseDto
| Campo | Tipo |
|-------|------|
| id | UUID |
| name | string |
| slug | string |
| isActive | boolean |
| productCount | number |
| createdAt | Date |
| updatedAt | Date |

### Regras de Negócio

1. **Slug único e auto-gerado**: criar a partir do name
2. **Name único**: não permitir duplicatas
3. **Listagem**: apenas tags ativas aparecem no catálogo público
4. **Soft delete**: marcar como inactive em vez de remover

### Dependências
- Products Module (contagem de produtos)

---

## Brands Module

### Descrição
Módulo para gerenciar marcas/fabricantes de produtos. Cada marca tem logo, banner e descrição. Admins têm CRUD completo.

### Endpoints da API

| Método | Rota | Descrição | Autenticação |
|--------|------|-----------|--------------|
| GET | `/brands` | Listar marcas | Nenhuma |
| GET | `/brands/:slug` | Detalhe de marca com produtos | Nenhuma |
| POST | `/brands` | Criar marca | JWT (admin) |
| PUT | `/brands/:id` | Atualizar marca | JWT (admin) |
| DELETE | `/brands/:id` | Deletar marca | JWT (admin) |

### DTOs

#### CreateBrandDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| name | string | @IsNotEmpty(), @MinLength(2), @MaxLength(100), @Unique() |
| description | string | @IsOptional(), @MaxLength(1000) |
| logoId | UUID | @IsOptional(), @IsUUID() |
| bannerId | UUID | @IsOptional(), @IsUUID() |
| isActive | boolean | @IsBoolean() |

#### UpdateBrandDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| name | string | @IsOptional(), @MinLength(2), @MaxLength(100) |
| description | string | @IsOptional(), @MaxLength(1000) |
| logoId | UUID | @IsOptional(), @IsUUID() |
| bannerId | UUID | @IsOptional(), @IsUUID() |
| isActive | boolean | @IsOptional() |

#### BrandResponseDto
| Campo | Tipo |
|-------|------|
| id | UUID |
| name | string |
| slug | string |
| description | string |
| logo | MediaResponseDto \| null |
| banner | MediaResponseDto \| null |
| isActive | boolean |
| productCount | number |
| createdAt | Date |
| updatedAt | Date |

### Regras de Negócio

1. **Slug único e auto-gerado**: criar a partir do name
2. **Name único**: não permitir duplicatas
3. **Listagem**: apenas marcas ativas aparecem no catálogo
4. **Soft delete**: marcar como inactive

### Dependências
- Media Module (logo e banner)
- Products Module (contagem de produtos)

---

## Scales Module (MÓDULO CRÍTICO)

### Descrição
Módulo crítico para gerenciar escalas de produtos (ex: "28mm", "32mm") e suas regras de preço. Cada escala pode ter múltiplas regras que definem modificadores de preço em diferentes escopos (global, categoria, tag, produto). Implementa hierarquia de prioridade e cálculo automático de preços.

### Endpoints da API

| Método | Rota | Descrição | Autenticação |
|--------|------|-----------|--------------|
| GET | `/scales` | Listar escalas | Nenhuma |
| POST | `/scales` | Criar escala | JWT (admin) |
| PUT | `/scales/:id` | Atualizar escala | JWT (admin) |
| DELETE | `/scales/:id` | Deletar escala | JWT (admin) |
| GET | `/scales/:id/rules` | Listar regras da escala | JWT (admin) |
| POST | `/scales/:id/rules` | Criar regra de escala | JWT (admin) |
| PUT | `/scales/:id/rules/:ruleId` | Atualizar regra | JWT (admin) |
| DELETE | `/scales/:id/rules/:ruleId` | Deletar regra | JWT (admin) |
| GET | `/scales/resolve/:productId` | Resolver escalas + preços do produto | Nenhuma |

### DTOs

#### CreateScaleDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| name | string | @IsNotEmpty(), @MinLength(2), @MaxLength(50), @Unique() |
| isActive | boolean | @IsBoolean() |

#### UpdateScaleDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| name | string | @IsOptional(), @MinLength(2), @MaxLength(50) |
| isActive | boolean | @IsOptional() |

#### CreateScaleRuleDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| scaleId | UUID | @IsNotEmpty(), @IsUUID() |
| scope | 'global' \| 'category' \| 'tag' \| 'product' | @IsIn(['global', 'category', 'tag', 'product']) |
| scopeId | UUID | @IsOptional(), @IsUUID() |
| modifierType | 'percentage' \| 'fixed_add' \| 'fixed_price' | @IsIn(['percentage', 'fixed_add', 'fixed_price']) |
| modifierValue | number | @IsNotEmpty(), @IsPositive(), @Decimal(10, 2) |
| isDefault | boolean | @IsBoolean() |
| sortOrder | number | @IsInt(), @Min(0) |

#### UpdateScaleRuleDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| modifierType | 'percentage' \| 'fixed_add' \| 'fixed_price' | @IsOptional() |
| modifierValue | number | @IsOptional(), @IsPositive(), @Decimal(10, 2) |
| isDefault | boolean | @IsOptional() |
| sortOrder | number | @IsOptional(), @IsInt() |

#### ScaleResponseDto
| Campo | Tipo |
|-------|------|
| id | UUID |
| name | string |
| isActive | boolean |
| rules | ScaleRuleResponseDto[] |
| createdAt | Date |
| updatedAt | Date |

#### ScaleRuleResponseDto
| Campo | Tipo |
|-------|------|
| id | UUID |
| scaleId | UUID |
| scope | 'global' \| 'category' \| 'tag' \| 'product' |
| scopeId | UUID \| null |
| modifierType | 'percentage' \| 'fixed_add' \| 'fixed_price' |
| modifierValue | number |
| isDefault | boolean |
| sortOrder | number |
| createdAt | Date |
| updatedAt | Date |

#### ResolveScalesResponseDto
| Campo | Tipo |
|-------|------|
| productId | UUID |
| basePrice | number |
| scales | ResolvedScaleDto[] |

#### ResolvedScaleDto
| Campo | Tipo |
|-------|------|
| scaleId | UUID |
| scaleName | string |
| ruleId | UUID |
| appliedPrice | number |
| modifierType | 'percentage' \| 'fixed_add' \| 'fixed_price' |
| modifierValue | number |
| isDefault | boolean |

### Regras de Negócio

1. **Escala única**: não permitir duplicatas de nome
2. **Hierarquia de prioridade**: produto > tag > categoria > global
3. **Múltiplas escalas**: múltiplas escalas podem estar ativas para mesmo produto
4. **isDefault**: apenas uma regra por escala pode ter isDefault = true
5. **Cálculo de modificador**:
   - percentage: `newPrice = basePrice * (1 + modifierValue/100)` ou `(1 - modifierValue/100)` se negativo
   - fixed_add: `newPrice = basePrice + modifierValue`
   - fixed_price: `newPrice = modifierValue` (sobrescreve)
6. **Ordem de aplicação**: aplicar regras em sortOrder ascendente
7. **scopeId obrigatório**: se scope não é 'global', scopeId é obrigatório
8. **Soft delete**: marcar como inactive ao deletar
9. **Validação de scope**: validar que scopeId existe na entidade referenciada
10. **Endpoint resolve**: retornar apenas escalas ativas com suas regras aplicáveis

### Dependências
- Products Module (vinculação)
- Categories Module (escopo)
- Tags Module (escopo)
- Cart Module (cálculo de preço)
- Bundles Module (cálculo de preço)

---

## Bundles Module

### Descrição
Módulo para gerenciar bundles/kits de produtos. Um bundle é um tipo especial de produto que agrupa vários produtos/variações com desconto aplicado. Inclui CRUD e cálculo automático de preço e estoque.

### Endpoints da API

| Método | Rota | Descrição | Autenticação |
|--------|------|-----------|--------------|
| GET | `/bundles` | Listar bundles (paginado) | Nenhuma |
| GET | `/bundles/:slug` | Detalhe de bundle com componentes | Nenhuma |
| POST | `/bundles` | Criar bundle | JWT (admin) |
| PUT | `/bundles/:id` | Atualizar bundle | JWT (admin) |
| DELETE | `/bundles/:id` | Deletar bundle | JWT (admin) |
| POST | `/bundles/:id/items` | Adicionar item ao bundle | JWT (admin) |
| PUT | `/bundles/:id/items/:itemId` | Atualizar item | JWT (admin) |
| DELETE | `/bundles/:id/items/:itemId` | Remover item | JWT (admin) |

### DTOs

#### CreateBundleDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| name | string | @IsNotEmpty(), @MinLength(3), @MaxLength(200) |
| description | string | @IsNotEmpty(), @MinLength(10) |
| shortDescription | string | @IsNotEmpty(), @MaxLength(160) |
| discountType | 'percentage' \| 'fixed' | @IsIn(['percentage', 'fixed']) |
| discountValue | number | @IsNotEmpty(), @IsPositive(), @Decimal(10, 2) |
| imageIds | UUID[] | @IsArray(), @MinSize(1) |
| status | 'draft' \| 'active' \| 'inactive' | @IsIn(['draft', 'active', 'inactive']) |

#### UpdateBundleDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| name | string | @IsOptional(), @MinLength(3), @MaxLength(200) |
| description | string | @IsOptional(), @MinLength(10) |
| shortDescription | string | @IsOptional(), @MaxLength(160) |
| discountType | 'percentage' \| 'fixed' | @IsOptional() |
| discountValue | number | @IsOptional(), @IsPositive(), @Decimal(10, 2) |
| status | 'draft' \| 'active' \| 'inactive' | @IsOptional() |

#### CreateBundleItemDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| productId | UUID | @IsNotEmpty(), @IsUUID() |
| variationId | UUID | @IsOptional(), @IsUUID() |
| quantity | number | @IsNotEmpty(), @Min(1), @IsInt() |
| scaleRuleId | UUID | @IsOptional(), @IsUUID() |

#### UpdateBundleItemDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| quantity | number | @IsOptional(), @Min(1), @IsInt() |
| scaleRuleId | UUID | @IsOptional(), @IsUUID() |

#### BundleResponseDto
| Campo | Tipo |
|-------|------|
| id | UUID |
| name | string |
| slug | string |
| description | string |
| shortDescription | string |
| discountType | 'percentage' \| 'fixed' |
| discountValue | number |
| basePrice | number |
| finalPrice | number |
| stock | number |
| status | 'draft' \| 'active' \| 'inactive' |
| images | MediaResponseDto[] |
| items | BundleItemResponseDto[] |
| createdAt | Date |
| updatedAt | Date |

#### BundleItemResponseDto
| Campo | Tipo |
|-------|------|
| id | UUID |
| bundleId | UUID |
| productId | UUID |
| variationId | UUID \| null |
| quantity | number |
| scaleRuleId | UUID \| null |
| unitPrice | number |
| subtotal | number |

### Regras de Negócio

1. **Slug único e auto-gerado**: criar a partir do name
2. **Preço calculado**:
   - basePrice = soma(unitPrice × quantidade de cada item, aplicando escalas se houver)
   - finalPrice = basePrice × (1 - discountValue/100) para percentage, ou basePrice - discountValue para fixed
3. **Estoque calculado**: mínimo entre estoques dos componentes (considerando quantidade)
4. **Mínimo de items**: bundle deve ter pelo menos 2 itens
5. **Variação opcional**: para produtos simples, variationId pode ser nulo
6. **Escala opcional**: scaleRuleId pode ser nulo, usa preço base do produto
7. **Status**: bundles em draft não aparecem no catálogo
8. **Revalidação**: ao atualizar produto ou variação, recalcular bundle automaticamente
9. **Soft delete**: marcar como inactive ao deletar
10. **Tipo imutável**: bundle é sempre produto.type = "bundle"

### Dependências
- Products Module (produtos componentes)
- Variations Module (variações dos componentes)
- Scales Module (escalas e modificadores de preço)
- Media Module (imagens)

---

## Cart Module

### Descrição
Módulo para gerenciar carrinhos de compra. Armazenado em Redis para performance. Suporta carrinho de usuários logados e de sessões anônimas. Inclui cálculo automático de preços com escalas, aplicação de cupons e simulação de frete.

### Endpoints da API

| Método | Rota | Descrição | Autenticação |
|--------|------|-----------|--------------|
| GET | `/cart` | Retornar carrinho do usuário | JWT ou sessionId |
| POST | `/cart/items` | Adicionar item ao carrinho | JWT ou sessionId |
| PUT | `/cart/items/:itemId` | Atualizar quantidade | JWT ou sessionId |
| DELETE | `/cart/items/:itemId` | Remover item | JWT ou sessionId |
| POST | `/cart/coupon` | Aplicar cupom | JWT ou sessionId |
| DELETE | `/cart/coupon` | Remover cupom | JWT ou sessionId |
| POST | `/cart/shipping` | Simular frete | JWT ou sessionId |
| DELETE | `/cart` | Limpar carrinho | JWT ou sessionId |

### DTOs

#### AddToCartDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| productId | UUID | @IsNotEmpty(), @IsUUID() |
| variationId | UUID | @IsOptional(), @IsUUID() |
| scaleRuleId | UUID | @IsOptional(), @IsUUID() |
| quantity | number | @IsNotEmpty(), @Min(1), @IsInt() |

#### UpdateCartItemDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| quantity | number | @IsNotEmpty(), @Min(1), @IsInt() |

#### ApplyCouponDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| code | string | @IsNotEmpty(), @Uppercase() |

#### SimulateShippingDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| zipCode | string | @IsNotEmpty(), @Matches(/^\d{8}$/) |

#### CartItemResponseDto
| Campo | Tipo |
|-------|------|
| id | string |
| productId | UUID |
| productName | string |
| productImage | string |
| variationId | UUID \| null |
| scaleRuleId | UUID \| null |
| scaleName | string \| null |
| quantity | number |
| unitPrice | number |
| subtotal | number |

#### CartResponseDto
| Campo | Tipo |
|-------|------|
| id | string |
| userId | UUID \| null |
| sessionId | string \| null |
| items | CartItemResponseDto[] |
| subtotal | number |
| coupon | AppliedCouponResponseDto \| null |
| couponDiscount | number |
| shippingCost | number |
| shippingMethod | string \| null |
| total | number |
| itemCount | number |
| createdAt | Date |
| updatedAt | Date |

#### AppliedCouponResponseDto
| Campo | Tipo |
|-------|------|
| code | string |
| discountType | 'percentage' \| 'fixed' \| 'free_shipping' |
| discountValue | number |
| appliedDiscount | number |

### Regras de Negócio

1. **Chave do carrinho**: `cart:{userId}` para logados, `cart:session:{sessionId}` para anônimos
2. **TTL**: 7 dias, renovado a cada atualização
3. **Deduplicação**: mesmo produto + variação + escala = incrementar quantity
4. **Validação de estoque**: adicionar item falha se quantity > stock disponível
5. **Cálculo de preço**: aplicar escala se scaleRuleId informado
6. **Um cupom por vez**: ao aplicar novo, sobrescreve anterior
7. **Validação de cupom**: verificar se está válido (ativo, data válida, mínimo de pedido)
8. **Desconto de cupom**: subtrair do total, free_shipping zera shipping
9. **Frete**: simular automaticamente ao adicionar item ou mudar zipCode
10. **Carrinho vazio**: manter por 7 dias mesmo se vazio, permitir deletar explicitamente
11. **Sync ao login**: se usuário anônimo faz login, mesclar carrinhos (preferir itens novos)
12. **Revalidação**: ao recuperar carrinho, revalidar preços e disponibilidade

### Dependências
- Products Module (dados de produtos)
- Variations Module (dados de variações)
- Scales Module (cálculo de modificadores)
- Bundles Module (se item é bundle)
- Coupons Module (validação e cálculo)
- Shipping Module (simulação de frete)
- Redis (armazenamento)

---

## Orders Module

### Descrição
Módulo crítico para gerenciar pedidos. Converte carrinhos em pedidos com status machine bem definido. Inclui timeline de transições, integração com pagamentos e notificações. Suporta rastreamento público via orderNumber.

### Endpoints da API

| Método | Rota | Descrição | Autenticação |
|--------|------|-----------|--------------|
| POST | `/orders` | Criar pedido a partir do carrinho | JWT (customer, admin) |
| GET | `/orders` | Listar pedidos do usuário (paginado) | JWT (customer, admin) |
| GET | `/orders/:id` | Detalhe completo do pedido | JWT (customer, admin) |
| PUT | `/orders/:id/status` | Alterar status | JWT (admin) |
| GET | `/orders/:orderNumber/track` | Rastreamento público | Nenhuma |
| POST | `/orders/:id/cancel` | Cancelar pedido | JWT (customer, admin) |
| GET | `/orders/:id/timeline` | Timeline de transições | JWT (customer, admin) |

### DTOs

#### CreateOrderDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| billingAddressId | UUID | @IsNotEmpty(), @IsUUID() |
| shippingAddressId | UUID | @IsNotEmpty(), @IsUUID() |
| paymentMethodId | string | @IsNotEmpty() |
| notes | string | @IsOptional(), @MaxLength(500) |

#### UpdateOrderStatusDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| status | string | @IsNotEmpty(), @IsIn([...validTransitions]) |
| notes | string | @IsOptional(), @MaxLength(500) |

#### TrackOrderDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| orderNumber | string | @IsNotEmpty(), @Uppercase() |
| email | string | @IsEmail() |

#### OrderItemResponseDto
| Campo | Tipo |
|-------|------|
| id | UUID |
| orderId | UUID |
| productId | UUID |
| productName | string |
| variationId | UUID \| null |
| scaleRuleId | UUID \| null |
| quantity | number |
| unitPrice | number |
| subtotal | number |

#### OrderResponseDto
| Campo | Tipo |
|-------|------|
| id | UUID |
| orderNumber | string |
| userId | UUID |
| status | string |
| items | OrderItemResponseDto[] |
| subtotal | number |
| couponDiscount | number |
| shippingCost | number |
| taxCost | number |
| total | number |
| billingAddress | AddressResponseDto |
| shippingAddress | AddressResponseDto |
| paymentMethod | string |
| shipmentId | string \| null |
| notes | string |
| timeline | OrderTimelineResponseDto[] |
| createdAt | Date |
| updatedAt | Date |

#### OrderTimelineResponseDto
| Campo | Tipo |
|-------|------|
| id | UUID |
| orderId | UUID |
| fromStatus | string |
| toStatus | string |
| notes | string |
| createdBy | UUID |
| createdAt | Date |

### Regras de Negócio

1. **OrderNumber único**: formato = "ORD-" + timestamp + hash(6 chars), ex: "ORD-20260402154823-ABC123"
2. **Status machine**: pending_payment → payment_approved → production_queue → producing → packaging → shipped → delivered
3. **Estados extras**: payment_rejected, cancelled, refunded (podem aparecer em qualquer ponto)
4. **Transições válidas**: definidas em matriz (cf. section "Matriz de Transições")
5. **Validação de carrinho**: carrinho não pode estar vazio
6. **Validação de estoque**: falha se item não tem estoque suficiente no momento do pedido
7. **Reserva de estoque**: ao criar order, decrementar stock dos produtos
8. **Timeline**: registrar cada transição com fromStatus, toStatus, quem fez, quando
9. **Email**: disparar template de email adequado a cada transição
10. **Reembolso**: ao transicionar para refunded, restaurar estoque
11. **Cancelamento**: ao cancelar, restaurar estoque completo
12. **Rastreamento público**: orderNumber + email permite rastreamento sem autenticação
13. **Soft delete**: não deletar orders, apenas marcar cancelled ou refunded
14. **Auditoria**: registrar quem mudou status em createdBy

#### Matriz de Transições Válidas

| De | Para | Requer | Ações |
|---|---|---|---|
| pending_payment | payment_approved | webhook | Confirmar pagamento, enviar email |
| pending_payment | payment_rejected | webhook | Restaurar estoque, enviar email |
| payment_approved | production_queue | manual | Enviar email |
| production_queue | producing | manual | Enviar email |
| producing | packaging | manual | Enviar email |
| packaging | shipped | manual | Gerar/atualizar shipment, enviar email |
| shipped | delivered | webhook | Enviar email |
| * | cancelled | manual | Restaurar estoque se não cancelled ainda, enviar email |
| * | refunded | manual | Restaurar estoque, processar reembolso, enviar email |

### Dependências
- Cart Module (conversão)
- Users Module (dados do usuário)
- Addresses Module (endereços)
- Products Module (dados dos itens)
- Variations Module (dados das variações)
- Scales Module (preços com escala)
- Payments Module (integração)
- Shipping Module (shipments)
- Coupons Module (desconto aplicado)
- Email Module (notificações)

---

## Payments Module

### Descrição
Módulo para gerenciar pagamentos via Mercado Pago. Inclui criação de preferências, webhook de notificação com assinatura verificada, aplicação de descontos por método e idempotência.

### Endpoints da API

| Método | Rota | Descrição | Autenticação |
|--------|------|-----------|--------------|
| POST | `/payments/create-preference` | Criar preference no Mercado Pago | JWT (customer, admin) |
| POST | `/payments/webhook` | Webhook de notificações | Nenhuma (verificação de assinatura) |
| GET | `/payments/:paymentId` | Detalhes de pagamento | JWT (admin) |

### DTOs

#### CreatePaymentPreferenceDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| orderId | UUID | @IsNotEmpty(), @IsUUID() |
| paymentMethod | string | @IsNotEmpty(), @IsIn(['credit_card', 'debit_card', 'pix', 'boleto']) |

#### PaymentPreferenceResponseDto
| Campo | Tipo |
|-------|------|
| preferenceId | string |
| orderId | UUID |
| redirectUrl | string |
| totalAmount | number |
| discountApplied | number |
| paymentMethod | string |
| createdAt | Date |

#### WebhookPaymentDto
| Campo | Tipo | Notas |
|-------|------|-------|
| action | string | "payment.created", "payment.updated" |
| data.id | string | payment_id do Mercado Pago |
| type | string | "payment" |

### Regras de Negócio

1. **Desconto por método**: aplicável via config (ex: PIX = 10%, boleto = 5%)
2. **Verificação de assinatura**: validar header x-signature do webhook
3. **Idempotência**: não processar mesmo payment_id duas vezes (usar chave única)
4. **Status de payment**: mapeado para status de order (approved → payment_approved, rejected → payment_rejected)
5. **Preference TTL**: preferências expiram em 24h no Mercado Pago
6. **Retry de webhook**: Mercado Pago tenta 5 vezes com backoff exponencial
7. **Logging**: registrar todas as transações em payment_log table
8. **Teste**: ambiente sandbox para testes, produção separada
9. **Recebimento**: webhook atualiza order status e dispara notificações

### Dependências
- Orders Module (vínculo com pedido)
- Email Module (notificações)
- External API (Mercado Pago)

---

## Shipping Module

### Descrição
Módulo para integração com serviços de frete. Suporta simulação de frete via Melhor Envio, contratação de serviços e rastreamento. Inclui regras de frete grátis configuráveis.

### Endpoints da API

| Método | Rota | Descrição | Autenticação |
|--------|------|-----------|--------------|
| POST | `/shipping/simulate` | Simular frete | Nenhuma |
| POST | `/shipping/contract` | Contratar frete | JWT (admin) |
| GET | `/shipping/tracking/:shipmentId` | Rastreamento | Nenhuma |
| GET | `/shipping/free-rules` | Listar regras frete grátis | JWT (admin) |
| POST | `/shipping/free-rules` | Criar regra frete grátis | JWT (admin) |
| PUT | `/shipping/free-rules/:id` | Atualizar regra | JWT (admin) |
| DELETE | `/shipping/free-rules/:id` | Deletar regra | JWT (admin) |

### DTOs

#### SimulateShippingDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| zipCode | string | @IsNotEmpty(), @Matches(/^\d{8}$/) |
| items | ShippingItemDto[] | @IsArray(), @ValidateNested() |

#### ShippingItemDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| productId | UUID | @IsNotEmpty(), @IsUUID() |
| variationId | UUID | @IsOptional(), @IsUUID() |
| quantity | number | @IsNotEmpty(), @Min(1), @IsInt() |
| weight | number | @IsNotEmpty(), @IsPositive() |
| width | number | @IsNotEmpty(), @IsPositive() |
| height | number | @IsNotEmpty(), @IsPositive() |
| length | number | @IsNotEmpty(), @IsPositive() |

#### ContractShippingDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| orderId | UUID | @IsNotEmpty(), @IsUUID() |
| shippingOption | number | @IsNotEmpty(), @IsInt() |
| agentName | string | @IsOptional(), @MaxLength(100) |

#### ShippingOptionResponseDto
| Campo | Tipo |
|-------|------|
| id | number |
| name | string |
| carrier | string |
| estimatedDays | number |
| cost | number |
| isFree | boolean |

#### TrackingResponseDto
| Campo | Tipo |
|-------|------|
| shipmentId | string |
| carrier | string |
| trackingCode | string |
| status | string |
| estimatedDelivery | Date |
| events | TrackingEventDto[] |

#### TrackingEventDto
| Campo | Tipo |
|-------|------|
| status | string |
| location | string |
| timestamp | Date |
| description | string |

#### CreateFreeShippingRuleDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| zipCodeStart | string | @IsNotEmpty(), @Matches(/^\d{8}$/) |
| zipCodeEnd | string | @IsNotEmpty(), @Matches(/^\d{8}$/) |
| minOrderValue | number | @IsPositive(), @Decimal(10, 2) |
| isActive | boolean | @IsBoolean() |

#### UpdateFreeShippingRuleDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| zipCodeStart | string | @IsOptional(), @Matches(/^\d{8}$/) |
| zipCodeEnd | string | @IsOptional(), @Matches(/^\d{8}$/) |
| minOrderValue | number | @IsOptional(), @IsPositive(), @Decimal(10, 2) |
| isActive | boolean | @IsOptional() |

### Regras de Negócio

1. **Frete grátis**: aplicar se order value >= minOrderValue e zipCode entre range
2. **Múltiplas regras**: usar primeira regra ativa que corresponde (ordem de criação)
3. **Simulação**: retornar opções de carriers com custo e prazo estimado
4. **Contratação**: após contratar, gerar shipmentId e atualizar order
5. **Rastreamento**: buscar em Melhor Envio ou rastrear arquivo local se não integrado
6. **Dimensões**: calcular volume = width × height × length, validar mínimos
7. **Peso**: soma de todos itens, validar mínimo 0.3kg e máximo 30kg
8. **CEP válido**: validar formato 8 dígitos

### Dependências
- Orders Module (vinculação)
- Cart Module (simulação)
- Products Module (dimensões)
- Variations Module (dimensões)
- External API (Melhor Envio)

---

## Coupons Module

### Descrição
Módulo para gerenciar cupons/vouchers com desconto. Suporta desconto percentual, fixo ou frete grátis. Inclui validações de data, quantidade de usos, restrições por categoria/produto e histórico de uso.

### Endpoints da API

| Método | Rota | Descrição | Autenticação |
|--------|------|-----------|--------------|
| GET | `/coupons` | Listar cupons (admin) | JWT (admin) |
| POST | `/coupons` | Criar cupom | JWT (admin) |
| PUT | `/coupons/:id` | Atualizar cupom | JWT (admin) |
| DELETE | `/coupons/:id` | Deletar cupom | JWT (admin) |
| POST | `/coupons/validate` | Validar cupom no carrinho | Nenhuma |

### DTOs

#### CreateCouponDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| code | string | @IsNotEmpty(), @Uppercase(), @Unique(), @Length(3, 20) |
| type | 'percentage' \| 'fixed' \| 'free_shipping' | @IsIn(['percentage', 'fixed', 'free_shipping']) |
| value | number | @IsNotEmpty(), @IsPositive(), @Decimal(10, 2) |
| minOrderValue | number | @IsOptional(), @IsPositive(), @Decimal(10, 2) |
| maxUses | number | @IsOptional(), @Min(1), @IsInt() |
| usesPerCustomer | number | @IsOptional(), @Min(1), @IsInt() |
| validFrom | Date | @IsOptional(), @IsDate() |
| validUntil | Date | @IsOptional(), @IsDate() |
| isActive | boolean | @IsBoolean() |
| isFirstPurchaseOnly | boolean | @IsBoolean() |
| restrictions | CouponRestrictionDto[] | @IsArray(), @ValidateNested() |

#### CouponRestrictionDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| type | 'category' \| 'product' \| 'tag' | @IsIn(['category', 'product', 'tag']) |
| restrictionType | 'include' \| 'exclude' | @IsIn(['include', 'exclude']) |
| entityIds | UUID[] | @IsArray(), @IsUUID({ each: true }) |

#### UpdateCouponDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| code | string | @IsOptional(), @Uppercase(), @Length(3, 20) |
| type | 'percentage' \| 'fixed' \| 'free_shipping' | @IsOptional() |
| value | number | @IsOptional(), @IsPositive(), @Decimal(10, 2) |
| minOrderValue | number | @IsOptional(), @IsPositive(), @Decimal(10, 2) |
| maxUses | number | @IsOptional(), @Min(1), @IsInt() |
| usesPerCustomer | number | @IsOptional(), @Min(1), @IsInt() |
| validFrom | Date | @IsOptional() |
| validUntil | Date | @IsOptional() |
| isActive | boolean | @IsOptional() |
| isFirstPurchaseOnly | boolean | @IsOptional() |

#### ValidateCouponDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| code | string | @IsNotEmpty(), @Uppercase() |
| cartValue | number | @IsNotEmpty(), @IsPositive(), @Decimal(10, 2) |
| cartItems | CartItemForValidationDto[] | @IsArray() |
| userId | UUID | @IsOptional(), @IsUUID() |

#### CouponResponseDto
| Campo | Tipo |
|-------|------|
| id | UUID |
| code | string |
| type | 'percentage' \| 'fixed' \| 'free_shipping' |
| value | number |
| minOrderValue | number \| null |
| maxUses | number \| null |
| usesPerCustomer | number \| null |
| validFrom | Date \| null |
| validUntil | Date \| null |
| isActive | boolean |
| isFirstPurchaseOnly | boolean |
| totalUsed | number |
| restrictions | CouponRestrictionDto[] |
| createdAt | Date |
| updatedAt | Date |

### Regras de Negócio

1. **Code único**: não permitir duplicatas, sempre uppercase
2. **Validação de datas**: validFrom <= validUntil, ambas opcionais
3. **Desconto calculado**:
   - percentage: `discount = cartValue * (value / 100)`
   - fixed: `discount = value`, não pode ser maior que cartValue
   - free_shipping: zera shipping, ignora value
4. **Ordem de validações**:
   - Está ativo?
   - Está dentro da validade?
   - Usuário não excedeu usesPerCustomer?
   - Cupom não excedeu maxUses?
   - Primeira compra? (se isFirstPurchaseOnly)
   - Valor mínimo do pedido?
   - Produtos estão na restrição?
5. **Restrições**:
   - include: apenas produtos/categorias listadas aplicam desconto
   - exclude: produtos/categorias listadas não aplicam desconto
   - sem restrição: aplica a todos
6. **Primeira compra**: verificar se usuário tem orders anteriores (admin pode sobrescrever)
7. **CouponUsage**: registrar cada uso com userId, orderId, cupomId
8. **Cancelamento**: ao cancelar order, não restaurar uso do cupom
9. **Soft delete**: marcar como inactive em vez de remover

### Dependências
- Products Module (validação de produtos)
- Categories Module (validação de categorias)
- Tags Module (validação de tags)
- Orders Module (histórico de uso)

---

## Search Module

### Descrição
Módulo para busca avançada com Elasticsearch. Suporta full-text search com filtros por categoria, marca, escala, preço. Inclui autocomplete rápido. Reindexação automática via BullMQ quando produtos são alterados.

### Endpoints da API

| Método | Rota | Descrição | Autenticação |
|--------|------|-----------|--------------|
| GET | `/search?q=&category=&brand=&priceMin=&priceMax=&scale=&sort=&page=` | Buscar produtos | Nenhuma |
| GET | `/search/autocomplete?q=` | Sugestões rápidas | Nenhuma |

### Query Parameters

#### SearchProductsDto
| Parâmetro | Tipo | Validações |
|-----------|------|-----------|
| q | string | @IsOptional(), @MaxLength(200) |
| category | UUID | @IsOptional(), @IsUUID() |
| brand | UUID | @IsOptional(), @IsUUID() |
| priceMin | number | @IsOptional(), @Min(0) |
| priceMax | number | @IsOptional(), @IsPositive() |
| scale | UUID | @IsOptional(), @IsUUID() |
| sort | string | @IsOptional(), @IsIn(['newest', 'price_asc', 'price_desc', 'name_asc', 'relevance']) |
| page | number | @IsOptional(), @Min(1), @IsInt() |
| limit | number | @IsOptional(), @Min(1), @Max(100), @IsInt() |

#### AutocompleteDto
| Parâmetro | Tipo | Validações |
|-----------|------|-----------|
| q | string | @IsNotEmpty(), @MinLength(2), @MaxLength(100) |

#### SearchResultsResponseDto
| Campo | Tipo |
|-------|------|
| results | SearchResultItemDto[] |
| total | number |
| page | number |
| pages | number |
| took | number |

#### SearchResultItemDto
| Campo | Tipo |
|-------|------|
| id | UUID |
| name | string |
| slug | string |
| price | number |
| salePrice | number \| null |
| image | string |
| category | string |
| brand | string |
| rating | number |
| reviews | number |

#### AutocompleteResponseDto
| Campo | Tipo |
|-------|------|
| suggestions | SuggestionDto[] |

#### SuggestionDto
| Campo | Tipo |
|-------|------|
| text | string |
| type | 'product' \| 'category' \| 'brand' |
| id | UUID |

### Regras de Negócio

1. **Índice Elasticsearch**: products (mapper detalhado abaixo)
2. **Full-text search**: buscar em name e description com analyzador padrão
3. **Filtros keyword**: category, brand, tags, scale (sem análise)
4. **Paginação**: padrão limit=20, máximo 100
5. **Sorting**: newest (created_at DESC), price_asc/desc (price ASC/DESC), name_asc (name ASC), relevance (score DESC)
6. **Reindexação**: disparar BullMQ job ao criar/atualizar/deletar produto
7. **Autocomplete**: usar completion suggester, retornar top 10
8. **Filtro de status**: apenas produtos com status="active"
9. **Timeout**: limitar query a 5 segundos máximo
10. **Análise**: usar analyzador português se disponível

#### Mapeamento do Índice Products

```
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "name": {
        "type": "text",
        "analyzer": "portuguese",
        "fields": { "keyword": { "type": "keyword" } }
      },
      "slug": { "type": "keyword" },
      "description": { "type": "text", "analyzer": "portuguese" },
      "shortDescription": { "type": "text", "analyzer": "portuguese" },
      "price": { "type": "float" },
      "salePrice": { "type": "float" },
      "category": { "type": "keyword" },
      "categoryId": { "type": "keyword" },
      "brand": { "type": "keyword" },
      "brandId": { "type": "keyword" },
      "tags": { "type": "keyword" },
      "scales": { "type": "keyword" },
      "stock": { "type": "integer" },
      "status": { "type": "keyword" },
      "rating": { "type": "float" },
      "reviews": { "type": "integer" },
      "image": { "type": "keyword" },
      "createdAt": { "type": "date" },
      "updatedAt": { "type": "date" },
      "suggest": {
        "type": "completion"
      }
    }
  }
}
```

### Dependências
- Products Module (dados)
- Categories Module (filtros)
- Brands Module (filtros)
- Tags Module (filtros)
- Scales Module (filtros)
- Elasticsearch (mecanismo de busca)
- BullMQ (reindexação)

---

## SEO Module

### Descrição
Módulo para gerenciar metadados SEO e estruturados. Inclui CRUD de metadados por entidade, geração dinâmica de sitemap.xml e robots.txt, e sistema de redirects 301. Análise automática de SEO score.

### Endpoints da API

| Método | Rota | Descrição | Autenticação |
|--------|------|-----------|--------------|
| GET | `/seo/:entityType/:entityId` | Recuperar metadados | Nenhuma |
| POST | `/seo/:entityType/:entityId` | Criar/atualizar metadados | JWT (admin) |
| GET | `/sitemap.xml` | Sitemap XML | Nenhuma |
| GET | `/robots.txt` | Robots.txt | Nenhuma |
| GET | `/seo/redirects` | Listar redirects (admin) | JWT (admin) |
| POST | `/seo/redirects` | Criar redirect | JWT (admin) |
| DELETE | `/seo/redirects/:id` | Deletar redirect | JWT (admin) |

### DTOs

#### CreateSeoMetadataDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| entityType | string | @IsIn(['product', 'category', 'brand', 'tag', 'page']) |
| entityId | UUID | @IsNotEmpty(), @IsUUID() |
| metaTitle | string | @IsNotEmpty(), @MinLength(30), @MaxLength(60) |
| metaDescription | string | @IsNotEmpty(), @MinLength(120), @MaxLength(160) |
| ogTitle | string | @IsOptional(), @MaxLength(65) |
| ogDescription | string | @IsOptional(), @MaxLength(160) |
| ogImageId | UUID | @IsOptional(), @IsUUID() |
| canonicalUrl | string | @IsOptional(), @IsUrl() |
| robots | 'index, follow' \| 'noindex, follow' \| 'index, nofollow' \| 'noindex, nofollow' | @IsOptional() |
| schemaOrg | Record<string, any> | @IsOptional(), @IsObject() |

#### UpdateSeoMetadataDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| metaTitle | string | @IsOptional(), @MinLength(30), @MaxLength(60) |
| metaDescription | string | @IsOptional(), @MinLength(120), @MaxLength(160) |
| ogTitle | string | @IsOptional(), @MaxLength(65) |
| ogDescription | string | @IsOptional(), @MaxLength(160) |
| ogImageId | UUID | @IsOptional(), @IsUUID() |
| canonicalUrl | string | @IsOptional(), @IsUrl() |
| robots | string | @IsOptional() |
| schemaOrg | Record<string, any> | @IsOptional() |

#### SeoMetadataResponseDto
| Campo | Tipo |
|-------|------|
| id | UUID |
| entityType | string |
| entityId | UUID |
| metaTitle | string |
| metaDescription | string |
| ogTitle | string |
| ogDescription | string |
| ogImage | MediaResponseDto \| null |
| canonicalUrl | string |
| robots | string |
| schemaOrg | Record<string, any> |
| seoScore | number |
| seoNotes | string[] |
| createdAt | Date |
| updatedAt | Date |

#### CreateRedirectDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| fromUrl | string | @IsNotEmpty(), @IsUrl() |
| toUrl | string | @IsNotEmpty(), @IsUrl() |
| isActive | boolean | @IsBoolean() |

#### SitemapEntry
| Campo | Tipo |
|-------|------|
| loc | string |
| lastmod | Date |
| changefreq | string |
| priority | number |

### Regras de Negócio

1. **Metadados por entidade**: cada entidade (produto, categoria, etc.) tem seus próprios metadados
2. **Metadados automáticos**: preencher valores padrão ao criar entidade (nome como title, description como meta)
3. **Tamanho de títulos**: 50-60 caracteres, 120-160 para description (validar)
4. **Open Graph**: ogTitle, ogDescription, ogImage para compartilhamento em redes
5. **Schema.org**: suportar markup estruturado (JSON-LD) para produtos, breadcrumbs, etc.
6. **Canonical**: evitar conteúdo duplicado, usar em variações de URL
7. **Robots**: padrão "index, follow" para públicos, "noindex, follow" para admin
8. **Sitemap**: incluir todas entidades ativas, atualizar lastmod
9. **Robots.txt**: permitir /products/*, desabilitar /admin/*, /api/*, /auth/*
10. **Redirects 301**: manter histórico de URLs antigas para migração, redirecionar automaticamente
11. **SEO Score**: análise automática (0-100):
    - Título tem palavra-chave? (+20)
    - Description tem palavra-chave? (+20)
    - Description tamanho correto? (+20)
    - Imagem OG? (+15)
    - Canonical URL? (+15)
    - Schema.org presente? (+10)

### Dependências
- Products Module (dados)
- Categories Module (dados)
- Brands Module (dados)
- Tags Module (dados)
- Pages Module (dados)
- Media Module (imagens OG)

---

## Email Module

### Descrição
Módulo para envio de emails transacionais. Não expõe endpoints públicos, funciona via fila BullMQ com processador assíncrono. Templates em React Email (ou similar) para renderização HTML.

### Componentes

#### EmailService
```
emailService.sendEmail(to: string, template: string, data: object)
  - Cria job na fila 'email'
  - Retorna promise com jobId
```

#### EmailProcessor (BullMQ)
```
Processa jobs de email:
- Renderiza template com dados
- Envia via SMTP (nodemailer)
- Registra tentativas de reenvio
- Falha após 3 tentativas
```

#### Templates

| Template | Acionado Por | Dados |
|----------|--------------|-------|
| order-confirmation | CREATE order | { order, user } |
| order-status-change | UPDATE order status | { order, status, notes } |
| welcome | REGISTER user | { user } |
| password-reset | FORGOT password | { user, resetLink } |
| shipping-notification | SHIP order | { order, trackingCode, carrier } |
| coupon-created | CREATE coupon | { coupon, users } |
| product-back-in-stock | PRODUCT restock | { product, users } |

### Configuração SMTP

```
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@loja.com
SMTP_FROM_NAME="Loja de Miniaturas 3D"
```

### Regras de Negócio

1. **Fila assíncrona**: não bloquear requisição, enfileirar job
2. **Retry automático**: 3 tentativas com backoff exponencial (10s, 100s, 1000s)
3. **Templates HTML**: renderizar com dados via React Email
4. **Logging**: registrar cada envio (sucesso/falha) para auditoria
5. **Rate limiting**: máximo 10 emails por segundo (evitar throttle)
6. **Supress list**: manter lista de emails que recusaram (implementar depois)

### Dependências
- BullMQ (fila)
- Nodemailer (SMTP)
- React Email (templates)
- Orders Module
- Users Module
- Products Module

---

## Media Module

### Descrição
Módulo para upload e gerenciamento de imagens. Uploads para Cloudflare R2 com otimização automática. Gera múltiplas resoluções (thumbnail, medium, large) em WebP + JPEG fallback.

### Endpoints da API

| Método | Rota | Descrição | Autenticação |
|--------|------|-----------|--------------|
| POST | `/media/upload` | Upload de imagem | JWT (admin) |
| DELETE | `/media/:id` | Deletar imagem | JWT (admin) |
| GET | `/media/:id` | Informações da imagem | Nenhuma |

### DTOs

#### UploadMediaDto (multipart/form-data)
| Campo | Tipo | Validações |
|-------|------|-----------|
| file | File | @IsNotEmpty(), @IsImage(), @MaxSize(5MB) |
| alt | string | @IsOptional(), @MaxLength(200) |

#### MediaResponseDto
| Campo | Tipo |
|-------|------|
| id | UUID |
| filename | string |
| originalUrl | string |
| thumbnail | { url, width: 150, height: 150 } |
| medium | { url, width: 600, height: 600 } |
| large | { url, width: 1200, height: 1200 } |
| alt | string |
| mimeType | string |
| size | number |
| width | number |
| height | number |
| createdAt | Date |

### Regras de Negócio

1. **Tipos aceitos**: JPEG, PNG, WebP (validar MIME type)
2. **Tamanho máximo**: 5MB por arquivo
3. **Dimensões**: validar largura >= 100px, altura >= 100px
4. **Resoluções automáticas**:
   - thumbnail: 150x150 (crop ou resize + pad)
   - medium: 600x600
   - large: 1200x1200
5. **Formatos**: converter para WebP (primário) com fallback JPEG
6. **Otimização**: usar sharp com quality=80 para WebP, 85 para JPEG
7. **CDN**: servir via URL pública do R2 com cache headers (1 ano)
8. **Armazenamento**: estrutura /uploads/{year}/{month}/{day}/{uuid}-{size}.{format}
9. **Soft delete**: mover para pasta /deleted/{uuid} em vez de remover
10. **Limpeza**: job diário para deletar arquivos sem referência após 7 dias

### Dependências
- Cloudflare R2 (armazenamento)
- Sharp (otimização)

---

## Blog Module

### Descrição
Módulo para gerenciar blog de conteúdo. Admins têm CRUD completo, posts podem ter múltiplas tags, imagem destacada e status (draft/published). Posts publicados aparecem no catálogo público com paginação.

### Endpoints da API

| Método | Rota | Descrição | Autenticação |
|--------|------|-----------|--------------|
| GET | `/blog` | Listar posts publicados (paginado) | Nenhuma |
| GET | `/blog/:slug` | Detalhe de post | Nenhuma |
| POST | `/blog` | Criar post | JWT (admin) |
| PUT | `/blog/:id` | Atualizar post | JWT (admin) |
| DELETE | `/blog/:id` | Deletar post | JWT (admin) |

### DTOs

#### CreateBlogPostDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| title | string | @IsNotEmpty(), @MinLength(5), @MaxLength(200) |
| content | string | @IsNotEmpty(), @MinLength(100) |
| excerpt | string | @IsNotEmpty(), @MaxLength(300) |
| featuredImageId | UUID | @IsNotEmpty(), @IsUUID() |
| authorId | UUID | @IsNotEmpty(), @IsUUID() |
| tagIds | UUID[] | @IsArray(), @IsUUID({ each: true }) |
| status | 'draft' \| 'published' | @IsIn(['draft', 'published']) |
| publishedAt | Date | @IsOptional(), @IsDate() |

#### UpdateBlogPostDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| title | string | @IsOptional(), @MinLength(5), @MaxLength(200) |
| content | string | @IsOptional(), @MinLength(100) |
| excerpt | string | @IsOptional(), @MaxLength(300) |
| featuredImageId | UUID | @IsOptional(), @IsUUID() |
| tagIds | UUID[] | @IsOptional(), @IsArray() |
| status | 'draft' \| 'published' | @IsOptional() |
| publishedAt | Date | @IsOptional() |

#### BlogPostResponseDto
| Campo | Tipo |
|-------|------|
| id | UUID |
| title | string |
| slug | string |
| content | string |
| excerpt | string |
| featuredImage | MediaResponseDto |
| author | { id, name, email } |
| tags | TagResponseDto[] |
| status | 'draft' \| 'published' |
| publishedAt | Date |
| createdAt | Date |
| updatedAt | Date |

### Regras de Negócio

1. **Slug único e auto-gerado**: criar a partir do title
2. **Status draft**: apenas admins veem
3. **Status published**: visível no catálogo, com publishedAt automático se não informado
4. **Conteúdo rico**: suportar markdown ou HTML (versionado)
5. **Imagem obrigatória**: featured image é necessária para publicar
6. **Paginação**: 10 posts por página, ordenar por publishedAt DESC
7. **Tags**: associar com Tags do sistema (reutilizar)
8. **Autor**: registrar quem criou/atualizou
9. **Soft delete**: marcar como draft ou remover logicamente
10. **SEO**: gerar automaticamente metadados SEO

### Dependências
- Media Module (featured image)
- Tags Module (associação)
- Users Module (autor)
- SEO Module (metadados)

---

## Pages Module

### Descrição
Módulo para gerenciar páginas estáticas do site. Inclui CRUD de conteúdo customizável e páginas pré-criadas (sobre, contato, FAQ, termos, privacidade, trocas-e-devolucoes).

### Endpoints da API

| Método | Rota | Descrição | Autenticação |
|--------|------|-----------|--------------|
| GET | `/pages/:slug` | Conteúdo público de página | Nenhuma |
| GET | `/pages` | Listar páginas (admin) | JWT (admin) |
| POST | `/pages` | Criar página | JWT (admin) |
| PUT | `/pages/:id` | Atualizar página | JWT (admin) |
| DELETE | `/pages/:id` | Deletar página | JWT (admin) |

### DTOs

#### CreatePageDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| title | string | @IsNotEmpty(), @MinLength(3), @MaxLength(200) |
| slug | string | @IsNotEmpty(), @Unique(), @Matches(/^[a-z0-9-]+$/) |
| content | string | @IsNotEmpty(), @MinLength(10) |
| isActive | boolean | @IsBoolean() |

#### UpdatePageDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| title | string | @IsOptional(), @MinLength(3), @MaxLength(200) |
| content | string | @IsOptional(), @MinLength(10) |
| isActive | boolean | @IsOptional() |

#### PageResponseDto
| Campo | Tipo |
|-------|------|
| id | UUID |
| title | string |
| slug | string |
| content | string |
| isActive | boolean |
| createdAt | Date |
| updatedAt | Date |

### Regras de Negócio

1. **Slug único e manual**: admins definem slug (não auto-generated)
2. **Conteúdo HTML/Rich Text**: suportar formatação
3. **Ativa ou não**: apenas páginas com isActive=true aparecem no site
4. **Páginas pré-criadas**: criar na migração inicial:
   - /sobre
   - /contato
   - /faq
   - /termos
   - /privacidade
   - /trocas-e-devolucoes
5. **Sem deletar pré-criadas**: marcar como inactive ao invés de remover
6. **SEO**: suportar metadados customizados via SEO module

### Dependências
- SEO Module (metadados)

---

## Admin / Dashboard Module

### Descrição
Módulo para dashboard administrativo com métricas de vendas, pedidos, clientes e configurações da loja.

### Endpoints da API

| Método | Rota | Descrição | Autenticação |
|--------|------|-----------|--------------|
| GET | `/admin/dashboard` | Métricas e resumo | JWT (admin) |
| GET | `/admin/settings` | Configurações da loja | JWT (admin) |
| PUT | `/admin/settings` | Atualizar configurações | JWT (admin) |

### DTOs

#### DashboardMetricsResponseDto
| Campo | Tipo |
|-------|------|
| sales | { day: number, week: number, month: number } |
| orders | { total: number, byStatus: { [status]: number } } |
| topProducts | TopProductDto[] |
| newCustomers | { day: number, week: number, month: number } |
| revenue | { day: number, week: number, month: number } |
| conversionRate | number |

#### TopProductDto
| Campo | Tipo |
|-------|------|
| id | UUID |
| name | string |
| sold | number |
| revenue | number |

#### SettingsResponseDto
| Campo | Tipo |
|-------|------|
| storeName | string |
| storeEmail | string |
| storePhone | string |
| storeLogo | MediaResponseDto |
| currency | string |
| timezone | string |
| paymentMethods | PaymentMethodSettings[] |
| shippingDefaults | ShippingDefaultSettings |

#### PaymentMethodSettings
| Campo | Tipo |
|-------|------|
| method | string |
| isActive | boolean |
| discount | number |
| minAmount | number |
| maxAmount | number |

#### ShippingDefaultSettings
| Campo | Tipo |
|-------|------|
| defaultCarrier | string |
| freeShippingThreshold | number |
| estimatedDays | number |

#### UpdateSettingsDto
| Campo | Tipo | Validações |
|-------|------|-----------|
| storeName | string | @IsOptional(), @MinLength(3) |
| storeEmail | string | @IsOptional(), @IsEmail() |
| storePhone | string | @IsOptional(), @Matches(/^\d{10,15}$/) |
| storeLogoId | UUID | @IsOptional(), @IsUUID() |
| currency | string | @IsOptional(), @Length(3) |
| timezone | string | @IsOptional() |
| paymentMethods | PaymentMethodSettings[] | @IsOptional() |
| shippingDefaults | ShippingDefaultSettings | @IsOptional() |

### Regras de Negócio

1. **Métricas por período**: dia (últimas 24h), semana (últimos 7 dias), mês (últimos 30 dias)
2. **Vendas**: valor total e quantidade de pedidos
3. **Orders by status**: agrupar por status, contar
4. **Top products**: top 10 produtos mais vendidos por quantidade, listar id, name, sold, revenue
5. **New customers**: contar registros por período
6. **Conversion rate**: orders com sucesso / visitantes (calcular com analytics)
7. **Settings**: armazenar configurações globais da loja em table settings
8. **Valores padrão**: usar quando não informado (facilitar primeiro setup)
9. **Admin only**: apenas usuários com role=admin podem acessar
10. **Auditoria**: registrar quem alterou settings e quando

### Dependências
- Orders Module (cálculos)
- Products Module (top products)
- Users Module (novos clientes)
- Media Module (logo)
- Payments Module (métodos)
- Shipping Module (defaults)

---

## Tabela de Dependências Entre Módulos

| Módulo | Depende De |
|--------|-----------|
| Auth | Users, Email |
| Users | Auth, Addresses, Orders |
| Addresses | Users, External API (ViaCEP) |
| Products | Categories, Brands, Tags, Media, Scales, Variations, Search, SEO |
| Variations | Products, Media |
| Categories | Media, Products |
| Tags | Products |
| Brands | Media, Products |
| **Scales** | Products, Categories, Tags, Cart, Bundles |
| Bundles | Products, Variations, Scales, Media |
| Cart | Products, Variations, Scales, Bundles, Coupons, Shipping, Redis |
| Orders | Cart, Users, Addresses, Products, Variations, Scales, Payments, Shipping, Coupons, Email |
| Payments | Orders, Email, External API (Mercado Pago) |
| Shipping | Orders, Cart, Products, Variations, External API (Melhor Envio) |
| Coupons | Products, Categories, Tags, Orders |
| Search | Products, Categories, Brands, Tags, Scales, Elasticsearch, BullMQ |
| SEO | Products, Categories, Brands, Tags, Pages, Media |
| Email | BullMQ, Nodemailer, Orders, Users, Products |
| Media | Cloudflare R2, Sharp |
| Blog | Media, Tags, Users, SEO |
| Pages | SEO |
| Dashboard | Orders, Products, Users, Media, Payments, Shipping |

---

## Tecnologias Recomendadas

### Banco de Dados
- **PostgreSQL 15+**: banco principal
- **Redis**: carrinho, cache, sessões, fila
- **Elasticsearch 8+**: busca full-text

### Bibliotecas Node.js
- **NestJS**: framework
- **Prisma**: ORM
- **class-validator**: validação
- **class-transformer**: transformação de DTOs
- **bcrypt**: hashing de senhas
- **jsonwebtoken**: JWT
- **dotenv**: variáveis de ambiente
- **BullMQ**: fila de jobs
- **ioredis**: client Redis
- **@elastic/elasticsearch**: client Elasticsearch
- **nodemailer**: SMTP
- **sharp**: otimização de imagens
- **cloudflare**: SDK (R2)
- **mercado-pago**: SDK de pagamentos
- **swagger**: documentação OpenAPI

### Serviços Externos
- **Mercado Pago**: pagamentos
- **Melhor Envio**: frete
- **ViaCEP**: busca de endereços por CEP
- **Cloudflare R2**: armazenamento de imagens

---

## Estrutura de Diretórios Recomendada

```
src/
├── common/
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   ├── pipes/
│   └── utils/
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts
│   │   ├── auth.controller.ts
│   │   ├── dtos/
│   │   ├── strategies/
│   │   └── entities/
│   ├── users/
│   ├── addresses/
│   ├── products/
│   ├── variations/
│   ├── categories/
│   ├── tags/
│   ├── brands/
│   ├── scales/
│   ├── bundles/
│   ├── cart/
│   ├── orders/
│   ├── payments/
│   ├── shipping/
│   ├── coupons/
│   ├── search/
│   ├── seo/
│   ├── email/
│   ├── media/
│   ├── blog/
│   ├── pages/
│   └── admin/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── config/
│   ├── database.config.ts
│   ├── redis.config.ts
│   ├── elasticsearch.config.ts
│   └── env.config.ts
├── app.module.ts
└── main.ts
```

---

## Próximos Passos

1. **Schema Prisma**: detalhar todas as entidades e relacionamentos
2. **Swagger Documentation**: gerar documentação interativa de APIs
3. **Testes Unitários**: Jest para cada serviço e controller
4. **Testes de Integração**: testes de fluxos completos (ex: carrinho → pedido → pagamento)
5. **Documentação de Deployment**: Docker, CI/CD, variáveis de ambiente
6. **Segurança**: CORS, rate limiting, CSRF, input sanitization
