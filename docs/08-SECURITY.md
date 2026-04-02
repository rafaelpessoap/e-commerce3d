# 08 — Segurança: Guia Integrado desde o Dia 1

> **Princípio fundamental:** Segurança NÃO é uma feature. É uma propriedade do sistema inteiro.
> Cada módulo, cada endpoint, cada formulário é construído com segurança desde o primeiro teste.
> Este documento define as regras, padrões e testes de segurança que são OBRIGATÓRIOS em cada fase.

---

## Filosofia: Defense in Depth (Defesa em Profundidade)

Nunca confie em uma única camada de proteção. Cada camada assume que as anteriores falharam:

```
┌─────────────────────────────────────────────────────────┐
│  CAMADA 1 — Cloudflare (DDoS, WAF, bot protection)     │
├─────────────────────────────────────────────────────────┤
│  CAMADA 2 — Nginx (rate limiting, headers, CORS)        │
├─────────────────────────────────────────────────────────┤
│  CAMADA 3 — NestJS Guards (auth, roles, throttle)       │
├─────────────────────────────────────────────────────────┤
│  CAMADA 4 — Validação de DTOs (class-validator, pipes)  │
├─────────────────────────────────────────────────────────┤
│  CAMADA 5 — Service Layer (regras de negócio)           │
├─────────────────────────────────────────────────────────┤
│  CAMADA 6 — Banco de dados (constraints, tipos, RBAC)   │
├─────────────────────────────────────────────────────────┤
│  CAMADA 7 — Auditoria e monitoramento                   │
└─────────────────────────────────────────────────────────┘
```

---

## Regra #1: NUNCA Confie no Frontend

Este é o ponto mais importante. Tudo que vem do frontend pode ser manipulado.
Um atacante não precisa nem usar o site — pode enviar requests diretamente com curl/Postman.

### O que isso significa na prática:

**PREÇOS:**
```
❌ ERRADO: Frontend envia o preço do produto no request de criar pedido
   POST /orders { items: [{ productId: "1", price: 0.01, quantity: 1 }] }
   → Atacante mudou o preço de R$150 para R$0.01

✅ CORRETO: Frontend envia APENAS IDs e quantidades. Backend busca o preço no banco.
   POST /orders { items: [{ productId: "1", quantity: 1, scaleId: "28mm" }] }
   → Backend: busca produto, calcula preço pela escala, calcula total
```

**DESCONTOS:**
```
❌ ERRADO: Frontend envia o desconto calculado
   POST /orders { discount: 99.99, couponCode: "FAKE" }

✅ CORRETO: Frontend envia só o código do cupom. Backend valida e calcula.
   POST /cart/coupon { code: "VERAO10" }
   → Backend: busca cupom, valida regras, calcula desconto, retorna novo total
```

**FRETE:**
```
❌ ERRADO: Frontend envia valor do frete (ou R$0 para frete grátis)
   POST /orders { shippingCost: 0 }

✅ CORRETO: Backend recalcula frete no momento de criar o pedido.
   → Backend: pega endereço, pega itens, chama Melhor Envio, verifica frete grátis, define valor
```

**ROLES:**
```
❌ ERRADO: Frontend envia a role do usuário
   POST /auth/register { name: "Hacker", email: "...", role: "ADMIN" }

✅ CORRETO: Role é definida internamente. Registro SEMPRE cria CUSTOMER.
   → Campo "role" no DTO de registro NÃO EXISTE. Forçado no service.
```

### Testes obrigatórios (incluir em CADA módulo):

```typescript
// TESTE DE SEGURANÇA: Preço não pode vir do frontend
it('deve ignorar preço enviado no request e usar preço do banco', async () => {
  const product = await factory.createProduct({ price: 150 });

  const order = await service.createOrder(userId, {
    items: [{ productId: product.id, quantity: 1 }],
    // Atacante tenta enviar preço customizado — campo nem deveria existir no DTO
  });

  expect(order.total).toBe(150); // Usa preço do banco, não do request
});

// TESTE DE SEGURANÇA: Desconto não pode vir do frontend
it('deve rejeitar desconto enviado diretamente no request de pedido', async () => {
  // O DTO de CreateOrder NÃO deve ter campo "discount"
  // Se alguém adicionar no body, class-validator com whitelist: true remove
  const rawBody = { items: [...], discount: 999 };

  // Com ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })
  // → Retorna 400 Bad Request: "property discount should not exist"
});

// TESTE DE SEGURANÇA: Registro não pode definir role
it('deve criar usuário como CUSTOMER mesmo se enviar role ADMIN', async () => {
  const result = await authService.register({
    name: 'Test',
    email: 'test@test.com',
    password: 'Test@1234',
    // role: 'ADMIN' — campo não existe no RegisterDto
  });

  expect(result.role).toBe('CUSTOMER');
});
```

---

## Regra #2: Validação Rigorosa de Entrada (DTOs)

### ValidationPipe Global

```typescript
// main.ts — OBRIGATÓRIO
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,              // Remove campos não declarados no DTO
  forbidNonWhitelisted: true,   // Retorna erro se enviar campo extra
  transform: true,              // Transforma tipos automaticamente
  transformOptions: {
    enableImplicitConversion: false, // NÃO converter implicitamente (segurança)
  },
}));
```

**Por que cada opção importa:**
- `whitelist: true` → Se o atacante enviar `{ email: "x", role: "ADMIN" }` e o DTO só tem `email`, o campo `role` é silenciosamente removido
- `forbidNonWhitelisted: true` → Melhor ainda: retorna erro 400. O atacante sabe que tentou algo inválido, e você logga a tentativa
- `transform: true` → Converte strings para números/booleans conforme o DTO (parâmetros de URL vêm como string)
- `enableImplicitConversion: false` → Não converte automaticamente `"true"` para `true` sem decorador explícito

### Padrão de DTO seguro:

```typescript
import { IsString, IsEmail, MinLength, MaxLength, Matches, IsNotEmpty } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/, {
    message: 'Senha deve conter: 1 maiúscula, 1 minúscula, 1 número, 1 caractere especial',
  })
  password: string;

  // ⚠️ NÃO TEM CAMPO ROLE. Nunca terá. Role é definido no service.
}
```

### Testes obrigatórios para CADA DTO:

```typescript
describe('RegisterDto validation', () => {
  it('deve rejeitar email inválido', async () => {
    const dto = { name: 'Test', email: 'nao-e-email', password: 'Test@1234' };
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(dto);

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('email');
  });

  it('deve rejeitar senha sem caractere especial', async () => {
    const dto = { name: 'Test', email: 'test@test.com', password: 'Test1234' };
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(dto);

    expect(response.status).toBe(400);
  });

  it('deve rejeitar campos extras (ex: role)', async () => {
    const dto = { name: 'Test', email: 'test@test.com', password: 'Test@1234', role: 'ADMIN' };
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(dto);

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('should not exist');
  });

  it('deve rejeitar name com mais de 100 caracteres', async () => {
    const dto = { name: 'A'.repeat(101), email: 'test@test.com', password: 'Test@1234' };
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(dto);

    expect(response.status).toBe(400);
  });
});
```

---

## Regra #3: Autenticação e Autorização Blindadas

### JWT — Boas práticas

```typescript
// Configuração JWT segura
JwtModule.register({
  secret: process.env.JWT_SECRET,         // ⚠️ Mínimo 64 caracteres, gerado com crypto
  signOptions: {
    expiresIn: '15m',                      // Access token: curta duração
    algorithm: 'HS256',                    // Algoritmo explícito (evita ataque "none")
    issuer: 'miniatures-store',            // Identifica quem emitiu
    audience: 'miniatures-store-api',      // Identifica para quem
  },
});

// Refresh token: separado, longa duração, armazenado no banco
// O refresh token NÃO é JWT — é um token opaco (UUID) armazenado na tabela refresh_tokens
// Isso permite invalidar individualmente (logout), invalidar todos (logout de todos os devices)
```

### Estratégia de refresh token segura

```
Tabela: refresh_tokens
- id (UUID)
- userId (FK)
- token (UUID, unique, hashed com SHA-256)
- expiresAt (DateTime, 7 dias)
- createdAt
- revokedAt (nullable — para invalidar sem deletar)
- deviceInfo (JSON — user-agent, IP, para auditoria)
```

**Por que NÃO usar JWT como refresh token:**
- JWT não pode ser invalidado antes de expirar (a menos que use blacklist, que é basicamente reinventar o banco)
- Token opaco no banco permite: revogar por device, revogar todos, detectar roubo

**Detecção de roubo de refresh token (Rotation):**
```
1. Cliente pede refresh com token A
2. Backend: invalida token A, gera token B, retorna novos tokens
3. Se alguém tentar usar token A de novo (já invalidado):
   → Possível roubo! Invalida TODOS os tokens do usuário
   → Força re-login em todos os devices
```

### Guards — Separação clara

```typescript
// ============================================
// 1. JwtAuthGuard — Verifica se está autenticado
// ============================================
// Aplicado GLOBALMENTE. Toda rota requer auth por padrão.
// Rotas públicas usam o decorator @Public()

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) { super(); }

  canActivate(context: ExecutionContext) {
    // Se a rota tem @Public(), pula a verificação
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}

// ============================================
// 2. RolesGuard — Verifica se tem a role necessária
// ============================================
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true; // Sem restrição de role

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user.role);
  }
}

// ============================================
// 3. OwnershipGuard — Verifica se o recurso pertence ao usuário
// ============================================
// CRÍTICO: Evita que usuário A acesse dados do usuário B
// Exemplo: GET /orders/123 — verifica se o order.userId === request.user.id

@Injectable()
export class OwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const resource = request.resource; // Populado pelo interceptor/pipe

    // Admin pode acessar qualquer recurso
    if (user.role === 'ADMIN') return true;

    // Usuário comum só acessa seus próprios recursos
    return resource.userId === user.id;
  }
}
```

### Testes obrigatórios de autorização:

```typescript
describe('Autorização — Isolamento de usuários', () => {

  // O TESTE MAIS IMPORTANTE: Usuário A não pode ver pedido do usuário B
  it('deve retornar 403 quando usuário tenta acessar pedido de outro usuário', async () => {
    const userA = await factory.createUser();
    const userB = await factory.createUser();
    const orderOfB = await factory.createOrder(userB.id, [...]);

    const tokenA = await authHelper.getToken(userA);

    const response = await request(app.getHttpServer())
      .get(`/orders/${orderOfB.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(response.status).toBe(403); // Forbidden, NÃO 404
    // Retornar 404 revelaria que o recurso existe (information disclosure)
    // Retornar 403 é mais seguro: "você não tem permissão"
  });

  it('deve retornar 403 quando usuário tenta acessar endereço de outro usuário', async () => {
    const userA = await factory.createUser();
    const userB = await factory.createUser();
    const addressOfB = await factory.createAddress(userB.id);

    const tokenA = await authHelper.getToken(userA);

    const response = await request(app.getHttpServer())
      .get(`/addresses/${addressOfB.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(response.status).toBe(403);
  });

  it('deve retornar 403 quando CUSTOMER tenta acessar rota admin', async () => {
    const customer = await factory.createUser({ role: 'CUSTOMER' });
    const token = await authHelper.getToken(customer);

    const response = await request(app.getHttpServer())
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it('deve retornar 401 quando token JWT é inválido', async () => {
    const response = await request(app.getHttpServer())
      .get('/orders')
      .set('Authorization', 'Bearer token.invalido.aqui');

    expect(response.status).toBe(401);
  });

  it('deve retornar 401 quando token JWT expirou', async () => {
    const expiredToken = await authHelper.getExpiredToken(user);

    const response = await request(app.getHttpServer())
      .get('/orders')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
  });
});
```

---

## Regra #4: Proteção contra Ataques Comuns

### 4.1 SQL Injection

**Risco:** Atacante injeta SQL nas queries.
**Proteção:** Prisma usa prepared statements por padrão. NUNCA use `$queryRawUnsafe` com input do usuário.

```typescript
// ❌ VULNERÁVEL
const users = await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE name = '${name}'`);

// ✅ SEGURO — Prisma prepared statement
const users = await prisma.user.findMany({ where: { name } });

// ✅ SEGURO — Se precisar de raw query, use template literal do Prisma
const users = await prisma.$queryRaw`SELECT * FROM users WHERE name = ${name}`;
```

**Teste:**
```typescript
it('deve tratar caracteres especiais de SQL no nome sem erro', async () => {
  // Se houver SQL injection, isso quebraria ou retornaria dados indevidos
  const result = await service.findByName("'; DROP TABLE users; --");
  expect(result).toEqual([]); // Retorna vazio, não quebra
});
```

### 4.2 XSS (Cross-Site Scripting)

**Risco:** Atacante injeta JavaScript que executa no browser de outros usuários.
**Proteção:** React faz escape por padrão. Mas cuidado com `dangerouslySetInnerHTML`.

```typescript
// ❌ VULNERÁVEL
<div dangerouslySetInnerHTML={{ __html: product.description }} />

// ✅ SEGURO — Se precisar de HTML rico, sanitize no backend
import DOMPurify from 'isomorphic-dompurify';
const cleanHTML = DOMPurify.sanitize(product.description, {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h2', 'h3', 'a', 'img'],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title'],
});

// ✅ MAIS SEGURO — Salvar e retornar Markdown, renderizar no frontend
// Markdown não tem tags HTML perigosas por padrão
```

**Teste:**
```typescript
it('deve sanitizar HTML malicioso na descrição do produto', async () => {
  const product = await service.create({
    name: 'Test',
    description: '<script>alert("XSS")</script><p>Descrição real</p>',
    // ...
  });

  expect(product.description).not.toContain('<script>');
  expect(product.description).toContain('<p>Descrição real</p>');
});

it('deve sanitizar atributos maliciosos de imagens', async () => {
  const product = await service.create({
    name: 'Test',
    description: '<img src="x" onerror="alert(\'XSS\')" />',
    // ...
  });

  expect(product.description).not.toContain('onerror');
});
```

### 4.3 CSRF (Cross-Site Request Forgery)

**Risco:** Site malicioso faz request usando cookies do usuário autenticado.
**Proteção:** Usar JWT no header Authorization (não em cookies) elimina CSRF. Mas se usar cookies para refresh token:

```typescript
// Refresh token em cookie httpOnly + secure + sameSite
response.cookie('refreshToken', token, {
  httpOnly: true,       // Não acessível via JavaScript
  secure: true,         // Só HTTPS
  sameSite: 'strict',   // Não envia em requests cross-site
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
  path: '/auth/refresh', // Só enviado para esta rota
});
```

### 4.4 Rate Limiting

**Risco:** Brute force em login, spam de requests, DDoS na aplicação.
**Proteção:** Rate limiting em múltiplas camadas.

```typescript
// NestJS — @nestjs/throttler
ThrottlerModule.forRoot([
  {
    name: 'short',
    ttl: 1000,    // 1 segundo
    limit: 3,     // 3 requests por segundo
  },
  {
    name: 'medium',
    ttl: 10000,   // 10 segundos
    limit: 20,    // 20 requests por 10 segundos
  },
  {
    name: 'long',
    ttl: 60000,   // 1 minuto
    limit: 100,   // 100 requests por minuto
  },
]);

// Rate limiting específico para login (mais restrito)
@Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 tentativas por minuto
@Post('login')
async login(@Body() dto: LoginDto) { ... }

// Rate limiting para webhook do Mercado Pago (mais permissivo)
@Throttle({ short: { limit: 50, ttl: 1000 } }) // 50 por segundo
@Post('webhook')
async handleWebhook(@Body() dto: WebhookDto) { ... }
```

**Teste:**
```typescript
it('deve bloquear após 5 tentativas de login falhas em 1 minuto', async () => {
  // 5 tentativas com senha errada
  for (let i = 0; i < 5; i++) {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@test.com', password: 'wrong' });
  }

  // 6ª tentativa deve ser bloqueada
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: 'test@test.com', password: 'wrong' });

  expect(response.status).toBe(429); // Too Many Requests
});
```

### 4.5 Mass Assignment / Over-posting

**Risco:** Atacante envia campos extras que não deveria poder alterar.
**Proteção:** `whitelist: true` + `forbidNonWhitelisted: true` no ValidationPipe (já configurado).

```typescript
// Exemplo: Atacante tenta se tornar admin ao editar perfil
it('deve rejeitar tentativa de alterar role via PUT /users/me', async () => {
  const response = await request(app.getHttpServer())
    .put('/users/me')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ name: 'Novo Nome', role: 'ADMIN' });

  expect(response.status).toBe(400); // Campo não permitido

  // Confirma que a role não mudou
  const user = await prisma.user.findUnique({ where: { id: userId } });
  expect(user.role).toBe('CUSTOMER');
});
```

### 4.6 IDOR (Insecure Direct Object Reference)

**Risco:** Atacante muda ID na URL para acessar recurso de outro usuário.
**Proteção:** OwnershipGuard (descrito acima) + verificação no service.

```typescript
// Service — SEMPRE verifica ownership
async findOrderById(orderId: string, requestingUserId: string, requestingRole: string) {
  const order = await this.prisma.order.findUnique({ where: { id: orderId } });

  if (!order) throw new NotFoundException('Pedido não encontrado');

  // Só o dono ou admin pode ver
  if (order.userId !== requestingUserId && requestingRole !== 'ADMIN') {
    throw new ForbiddenException('Sem permissão para acessar este pedido');
  }

  return order;
}
```

**Testes IDOR (obrigatórios para CADA recurso que pertence a um usuário):**
```typescript
// Testar para: orders, addresses, wishlist, cart
it('IDOR: deve retornar 403 ao acessar order com ID de outro usuário', ...);
it('IDOR: deve retornar 403 ao acessar address com ID de outro usuário', ...);
it('IDOR: deve retornar 403 ao alterar status de order de outro usuário', ...);
it('IDOR: admin DEVE conseguir acessar order de qualquer usuário', ...);
```

### 4.7 Path Traversal (Upload de arquivos)

**Risco:** Atacante envia nome de arquivo como `../../etc/passwd`.

```typescript
// Media upload — validações obrigatórias
async uploadImage(file: Express.Multer.File) {
  // 1. Validar extensão (whitelist, não blacklist)
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    throw new BadRequestException('Formato de imagem não permitido');
  }

  // 2. Validar MIME type real (não confiar no header Content-Type)
  const fileType = await fileTypeFromBuffer(file.buffer);
  if (!fileType || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(fileType.mime)) {
    throw new BadRequestException('Arquivo não é uma imagem válida');
  }

  // 3. Validar tamanho (máximo 10MB)
  if (file.size > 10 * 1024 * 1024) {
    throw new BadRequestException('Imagem muito grande (máximo 10MB)');
  }

  // 4. Gerar nome aleatório (NUNCA usar o nome original do arquivo)
  const fileName = `${randomUUID()}.${fileType.ext}`;

  // 5. Upload para R2 (nunca salvar no filesystem do servidor)
  await this.r2Client.upload(fileName, file.buffer);
}
```

**Testes:**
```typescript
it('deve rejeitar upload de arquivo .php disfarçado de .jpg', async () => {
  const phpFile = Buffer.from('<?php echo "hacked"; ?>');
  const response = await request(app.getHttpServer())
    .post('/media/upload')
    .attach('file', phpFile, 'malicious.jpg');

  expect(response.status).toBe(400);
  expect(response.body.error.message).toContain('não é uma imagem válida');
});

it('deve gerar nome aleatório e não usar o nome original', async () => {
  const result = await mediaService.uploadImage(validImageFile);

  expect(result.fileName).not.toContain(validImageFile.originalname);
  expect(result.fileName).toMatch(/^[a-f0-9-]+\.(jpg|png|webp)$/);
});
```

### 4.8 Webhook Spoofing (Mercado Pago)

**Risco:** Atacante envia webhook falso dizendo que pagamento foi aprovado.

```typescript
// OBRIGATÓRIO: Verificar assinatura de TODA notificação
async handleWebhook(headers: Record<string, string>, body: any) {
  // 1. Verificar assinatura do Mercado Pago
  const signature = headers['x-signature'];
  const requestId = headers['x-request-id'];

  if (!this.verifySignature(signature, requestId, body)) {
    // Logar tentativa suspeita
    this.logger.warn('Webhook com assinatura inválida', { body, headers });
    throw new UnauthorizedException('Assinatura inválida');
  }

  // 2. Buscar payment no Mercado Pago para confirmar (double-check)
  const payment = await this.mercadoPagoClient.getPayment(body.data.id);

  // 3. Verificar que o valor confere com o pedido
  const order = await this.ordersService.findByPaymentId(payment.external_reference);
  if (Math.abs(payment.transaction_amount - order.total) > 0.01) {
    this.logger.error('Valor do pagamento diverge do pedido', { payment, order });
    throw new BadRequestException('Valor divergente');
  }

  // 4. Idempotência — não processar o mesmo payment_id duas vezes
  const existingPayment = await this.prisma.payment.findUnique({
    where: { externalId: String(body.data.id) },
  });
  if (existingPayment && existingPayment.status === payment.status) {
    return { message: 'Already processed' }; // Idempotente
  }
}
```

**Testes:**
```typescript
it('deve rejeitar webhook sem assinatura', async () => {
  const response = await request(app.getHttpServer())
    .post('/payments/webhook')
    .send({ data: { id: '123' }, type: 'payment' });

  expect(response.status).toBe(401);
});

it('deve rejeitar webhook com assinatura inválida', async () => {
  const response = await request(app.getHttpServer())
    .post('/payments/webhook')
    .set('x-signature', 'assinatura-falsa')
    .set('x-request-id', 'req-123')
    .send({ data: { id: '123' }, type: 'payment' });

  expect(response.status).toBe(401);
});

it('deve rejeitar webhook quando valor do pagamento diverge do pedido', async () => {
  // Mock: pagamento de R$50, pedido de R$150
  mockMercadoPago.getPayment.mockResolvedValue({ transaction_amount: 50 });
  // ...
  expect(response.status).toBe(400);
});

it('deve ser idempotente — processar mesmo webhook duas vezes sem duplicar', async () => {
  await handleWebhook(validPayload); // primeira vez
  await handleWebhook(validPayload); // segunda vez

  const payments = await prisma.payment.findMany({ where: { externalId: '123' } });
  expect(payments).toHaveLength(1); // Só um registro
});
```

---

## Regra #5: Segurança de Senhas

```typescript
// Hashing com bcrypt — NUNCA armazenar senha em texto puro
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12; // 12 é o mínimo recomendado em 2026

async hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async validatePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

**Testes:**
```typescript
it('deve armazenar senha com hash, nunca em texto puro', async () => {
  const user = await authService.register({
    name: 'Test', email: 'test@test.com', password: 'Test@1234',
  });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  expect(dbUser.password).not.toBe('Test@1234');
  expect(dbUser.password).toMatch(/^\$2[aby]?\$/); // Formato bcrypt
});

it('NUNCA deve retornar senha no response', async () => {
  const response = await request(app.getHttpServer())
    .get('/users/me')
    .set('Authorization', `Bearer ${token}`);

  expect(response.body.data).not.toHaveProperty('password');
});

it('deve retornar mensagem genérica em login falho (não revelar se email existe)', async () => {
  // Com email que não existe
  const resp1 = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: 'naoexiste@test.com', password: 'Test@1234' });

  // Com email que existe mas senha errada
  const resp2 = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: 'existe@test.com', password: 'senhaerrada' });

  // MESMA mensagem para ambos — não revelar se o email existe
  expect(resp1.body.error.message).toBe('Credenciais inválidas');
  expect(resp2.body.error.message).toBe('Credenciais inválidas');
  expect(resp1.status).toBe(401);
  expect(resp2.status).toBe(401);
});
```

---

## Regra #6: Headers de Segurança (Nginx + NestJS)

### Nginx — Configuração obrigatória em produção

```nginx
# Security headers
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "0" always;  # Desabilita filtro XSS legado (pode causar problemas)
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://sdk.mercadopago.com; style-src 'self' 'unsafe-inline'; img-src 'self' https://*.r2.cloudflarestorage.com data:; connect-src 'self' https://api.mercadopago.com;" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

# Ocultar versão do server
server_tokens off;

# Limitar tamanho de upload
client_max_body_size 10m;

# Timeout contra slow loris
client_body_timeout 10s;
client_header_timeout 10s;
```

### NestJS — Helmet

```typescript
import helmet from 'helmet';
app.use(helmet());
```

---

## Regra #7: Auditoria e Monitoramento

### Log de auditoria para ações sensíveis

```typescript
// Interceptor que logga ações admin
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return next.handle().pipe(
      tap(async (response) => {
        // Loggar apenas ações de escrita
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
          await this.auditService.log({
            userId: user?.id,
            action: `${request.method} ${request.path}`,
            entityType: this.extractEntityType(request.path),
            entityId: request.params?.id,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          });
        }
      }),
    );
  }
}
```

### O que DEVE ser auditado:

| Ação | Nível | O que loggar |
|------|-------|-------------|
| Login falho | WARN | email tentado, IP, user-agent |
| Login sucesso | INFO | userId, IP, device |
| Alteração de role | CRITICAL | quem alterou, de/para qual role |
| Alteração de preço | HIGH | productId, preço antigo/novo, quem alterou |
| Alteração de status do pedido | HIGH | orderId, status anterior/novo, quem alterou |
| Webhook recebido | INFO | tipo, payload resumido |
| Webhook com assinatura inválida | CRITICAL | IP, payload, headers |
| Tentativa de acesso a recurso alheio | WARN | userId, recurso tentado, IP |
| Rate limit atingido | WARN | IP, endpoint, contagem |
| Upload de arquivo rejeitado | WARN | nome original, mime type, tamanho, IP |
| Criação de cupom | HIGH | quem criou, tipo, valor |
| Exportação de dados | HIGH | quem exportou, tipo de dados |

---

## Regra #8: Variáveis de Ambiente e Secrets

```bash
# .env.example — NUNCA commitar o .env real

# ⚠️ TODOS os secrets devem ter no mínimo 64 caracteres aleatórios
# Gere com: openssl rand -base64 64

# App
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/miniatures_store

# JWT — MUDE ESTES VALORES! São apenas exemplos!
JWT_SECRET=CHANGE_ME_64_RANDOM_CHARS_MINIMUM
JWT_REFRESH_SECRET=CHANGE_ME_DIFFERENT_FROM_JWT_SECRET

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=

# Melhor Envio
MELHORENVIO_TOKEN=
MELHORENVIO_SANDBOX=true

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=

# SMTP
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Loja <noreply@seudominio.com>"

# Redis
REDIS_URL=redis://localhost:6379

# Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9200
```

### .gitignore OBRIGATÓRIO

```gitignore
# Secrets
.env
.env.local
.env.production
.env.*.local

# Nunca commitar
*.pem
*.key
*.cert
credentials.json
service-account.json
```

**Teste no CI:**
```yaml
# GitHub Actions — verifica que nenhum secret foi commitado
- name: Scan for secrets
  uses: trufflesecurity/trufflehog@main
  with:
    path: ./
    base: ${{ github.event.pull_request.base.sha }}
    head: ${{ github.event.pull_request.head.sha }}
```

---

## Checklist de Segurança por Fase

### Fase 0 — Setup
- [ ] `helmet` instalado e configurado
- [ ] ValidationPipe global com `whitelist: true` e `forbidNonWhitelisted: true`
- [ ] CORS configurado (permitir apenas domínios conhecidos)
- [ ] Rate limiting global configurado
- [ ] `.env.example` com todos os secrets documentados
- [ ] `.gitignore` com exclusão de `.env`, chaves, certificados
- [ ] Security scan no CI (TruffleHog, npm audit)

### Fase 1 — Auth
- [ ] Senhas hasheadas com bcrypt (salt rounds ≥ 12)
- [ ] JWT com expiração curta (15min)
- [ ] Refresh token opaco no banco (não JWT)
- [ ] Refresh token rotation com detecção de roubo
- [ ] Mensagem genérica em login falho (não revelar se email existe)
- [ ] Rate limiting no login (5 tentativas/min)
- [ ] Senha nunca retornada em responses
- [ ] Registro SEMPRE cria CUSTOMER (role não aceita no DTO)
- [ ] Guards globais (JwtAuthGuard, RolesGuard)
- [ ] Testes: auth bypass, role escalation, token expirado, token inválido

### Fase 2 — Catálogo
- [ ] Sanitização de HTML em descriptions (DOMPurify)
- [ ] Upload de imagens: validação de extensão + MIME type real + tamanho
- [ ] Nomes de arquivo aleatórios (nunca usar nome original)
- [ ] Slug gerado no backend (não aceitar do frontend)
- [ ] SQL injection impossível (Prisma prepared statements)
- [ ] Testes: XSS em descriptions, upload de .php como .jpg, SQL injection em busca

### Fase 3 — Checkout (A MAIS CRÍTICA)
- [ ] Preços SEMPRE calculados no backend
- [ ] Descontos SEMPRE calculados no backend
- [ ] Frete SEMPRE calculado no backend
- [ ] Cupom validado no backend (todas as regras)
- [ ] Estoque verificado no backend antes de criar pedido
- [ ] Webhook do Mercado Pago com verificação de assinatura
- [ ] Webhook idempotente (não processar duas vezes)
- [ ] Double-check: consultar Mercado Pago após webhook para confirmar
- [ ] Verificar que valor do pagamento = total do pedido
- [ ] Testes: manipulação de preço, desconto falso, frete zero, webhook fake, valor divergente

### Fase 4 — Minha Conta
- [ ] OwnershipGuard em TODOS os endpoints que acessam dados do usuário
- [ ] Usuário A NÃO pode ver pedidos/endereços do usuário B
- [ ] Alteração de senha requer senha atual
- [ ] Alteração de email requer confirmação por email
- [ ] Testes: IDOR para cada recurso (orders, addresses, wishlist)

### Fase 5 — Admin
- [ ] RolesGuard em TODAS as rotas admin
- [ ] Audit log para toda ação de escrita
- [ ] Admin não pode deletar a si mesmo
- [ ] Admin não pode remover a role ADMIN do último admin
- [ ] Testes: customer tentando acessar admin, audit log registrado

### Fase 6 — Produção
- [ ] Headers de segurança no Nginx (HSTS, CSP, X-Frame-Options, etc.)
- [ ] SSL/TLS configurado (Cloudflare + Nginx)
- [ ] Cloudflare WAF rules ativadas
- [ ] Rate limiting no Nginx (além do NestJS)
- [ ] Docker containers rodando como non-root
- [ ] Audit: pentest automatizado (OWASP ZAP ou similar)
- [ ] Dependências sem vulnerabilidades conhecidas (npm audit)
- [ ] Testes de carga (verificar que rate limiting funciona sob pressão)

---

## Testes de Segurança Automatizados no CI

```yaml
# Adicionar ao ci.yml

security-tests:
  runs-on: ubuntu-latest
  needs: [unit-tests]
  steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Run npm audit
      run: |
        cd backend && npm audit --audit-level=high
        cd ../frontend && npm audit --audit-level=high

    - name: Scan for hardcoded secrets
      uses: trufflesecurity/trufflehog@main

    - name: SAST - CodeQL Analysis
      uses: github/codeql-action/analyze@v3
      with:
        languages: javascript-typescript

    - name: Docker image scan
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: 'miniatures-store-backend:latest'
        severity: 'CRITICAL,HIGH'
        exit-code: '1'  # Falha o CI se encontrar vulnerabilidade
```

---

## Resumo: As 8 Regras de Ouro

1. **NUNCA confie no frontend** — Todo cálculo de preço, desconto, frete é feito no backend
2. **Valide toda entrada** — DTOs com whitelist, forbidNonWhitelisted, transform
3. **Autenticação blindada** — JWT curto + refresh opaco + rotation + detecção de roubo
4. **Autorização granular** — Guards globais + OwnershipGuard + testes IDOR
5. **Proteja contra ataques conhecidos** — SQLi, XSS, CSRF, rate limiting, path traversal
6. **Verifique webhooks** — Assinatura + double-check + idempotência + valor
7. **Audite tudo** — Ações sensíveis loggadas com IP, user-agent, timestamp
8. **Secrets seguros** — .env nunca commitado, scan no CI, variáveis com 64+ chars
