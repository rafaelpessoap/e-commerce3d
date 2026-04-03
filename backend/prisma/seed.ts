import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ─── Admin User ───────────────────────────────────────────
  const adminExists = await prisma.user.findUnique({
    where: { email: 'rafaelzezao@gmail.com' },
  });

  if (!adminExists) {
    const hash = await bcrypt.hash('Admin@2026!', 12);
    await prisma.user.create({
      data: {
        email: 'rafaelzezao@gmail.com',
        name: 'Rafael Pessoa',
        password: hash,
        role: 'ADMIN',
        isActive: true,
        emailVerified: true,
      },
    });
    console.log('  ✅ Admin user created');
  } else {
    console.log('  ⏭️  Admin user already exists');
  }

  // ─── Categories ───────────────────────────────────────────
  const categories = [
    {
      name: 'Fantasy',
      slug: 'fantasy',
      description:
        'Miniaturas de fantasia medieval: guerreiros, elfos, dragões, magos e mais.',
    },
    {
      name: 'Sci-Fi',
      slug: 'sci-fi',
      description:
        'Miniaturas futuristas: soldados espaciais, mechs, alienígenas e naves.',
    },
    {
      name: 'Pin Ups',
      slug: 'pin-ups',
      description: 'Modelos artísticos em 3D com alto nível de detalhe.',
    },
    {
      name: 'Monstros',
      slug: 'monstros',
      description: 'Criaturas, demônios, dragões e bestas para RPG e wargames.',
    },
    {
      name: 'Cenários',
      slug: 'cenarios',
      description: 'Terrenos, ruínas, torres e elementos de cenário para mesas de jogo.',
    },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.log(`  ✅ ${categories.length} categories seeded`);

  // ─── Scales ───────────────────────────────────────────────
  const scales = [
    {
      name: 'Heroic (28mm)',
      code: 'HEROIC_28',
      baseSize: 28,
      multiplier: 1.0,
      priority: 10,
    },
    {
      name: 'Wargame (32mm)',
      code: 'WARGAME_32',
      baseSize: 32,
      multiplier: 1.15,
      priority: 20,
    },
    {
      name: 'Display (54mm)',
      code: 'DISPLAY_54',
      baseSize: 54,
      multiplier: 1.8,
      priority: 30,
    },
    {
      name: 'Collector (75mm)',
      code: 'COLLECTOR_75',
      baseSize: 75,
      multiplier: 2.5,
      priority: 40,
    },
  ];

  for (const scale of scales) {
    await prisma.scale.upsert({
      where: { code: scale.code },
      update: {},
      create: scale,
    });
  }
  console.log(`  ✅ ${scales.length} scales seeded`);

  // ─── Scale Rules (global) ─────────────────────────────────
  const allScales = await prisma.scale.findMany();
  for (const scale of allScales) {
    const ruleExists = await prisma.scaleRule.findFirst({
      where: { scaleId: scale.id, appliesTo: 'GLOBAL' },
    });
    if (!ruleExists) {
      await prisma.scaleRule.create({
        data: {
          scaleId: scale.id,
          appliesTo: 'GLOBAL',
          priceMultiplier: scale.multiplier,
          priority: 0,
        },
      });
    }
  }
  console.log(`  ✅ Global scale rules seeded`);

  // ─── Tags ─────────────────────────────────────────────────
  const tags = [
    { name: 'RPG', slug: 'rpg', color: '#6366F1' },
    { name: 'Wargame', slug: 'wargame', color: '#EF4444' },
    { name: 'Colecionável', slug: 'colecionavel', color: '#F59E0B' },
    { name: 'Novidade', slug: 'novidade', color: '#10B981' },
    { name: 'Promoção', slug: 'promocao', color: '#EC4899' },
  ];

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: {},
      create: tag,
    });
  }
  console.log(`  ✅ ${tags.length} tags seeded`);

  // ─── Brands ───────────────────────────────────────────────
  const brands = [
    {
      name: 'Elite Pinup 3D',
      slug: 'elite-pinup-3d',
      description: 'Nossa marca própria de miniaturas 3D.',
    },
    {
      name: 'Arsenal Craft',
      slug: 'arsenal-craft',
      description: 'Miniaturas da Arsenal Craft.',
    },
  ];

  for (const brand of brands) {
    await prisma.brand.upsert({
      where: { slug: brand.slug },
      update: {},
      create: brand,
    });
  }
  console.log(`  ✅ ${brands.length} brands seeded`);

  // ─── Coupon WELCOME10 ─────────────────────────────────────
  await prisma.coupon.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: {
      code: 'WELCOME10',
      type: 'PERCENTAGE',
      value: 10,
      minOrderValue: 50,
      usesPerUser: 1,
      isFirstPurchaseOnly: true,
      isActive: true,
    },
  });
  console.log('  ✅ Coupon WELCOME10 created');

  // ─── Free Shipping Rules ──────────────────────────────────
  const freeShippingExists = await prisma.freeShippingRule.findFirst();
  if (!freeShippingExists) {
    await prisma.freeShippingRule.createMany({
      data: [
        {
          zipCodeStart: '01000000',
          zipCodeEnd: '09999999',
          minOrderValue: 150,
        },
        {
          zipCodeStart: '20000000',
          zipCodeEnd: '26999999',
          minOrderValue: 200,
        },
        {
          zipCodeStart: '30000000',
          zipCodeEnd: '35999999',
          minOrderValue: 200,
        },
      ],
    });
    console.log('  ✅ Free shipping rules created (SP, RJ, MG)');
  }

  // ─── Sample Product ───────────────────────────────────────
  const fantasyCategory = await prisma.category.findUnique({
    where: { slug: 'fantasy' },
  });
  const eliteBrand = await prisma.brand.findUnique({
    where: { slug: 'elite-pinup-3d' },
  });
  const rpgTag = await prisma.tag.findUnique({ where: { slug: 'rpg' } });
  const novidadeTag = await prisma.tag.findUnique({
    where: { slug: 'novidade' },
  });

  const sampleProduct = await prisma.product.upsert({
    where: { slug: 'guerreira-elfica-28mm' },
    update: {},
    create: {
      name: 'Guerreira Élfica',
      slug: 'guerreira-elfica-28mm',
      description:
        'Miniatura de guerreira élfica em pose dinâmica. Impressa em resina de alta resolução com detalhes incríveis.',
      content:
        '<p>Esta miniatura foi esculpida digitalmente com atenção a cada detalhe: armadura ornamentada, cabelos ao vento e uma espada longa.</p><p>Ideal para RPG de mesa, wargames ou pintura artística.</p>',
      basePrice: 49.9,
      sku: 'ELF-WAR-001',
      featured: true,
      categoryId: fantasyCategory?.id,
      brandId: eliteBrand?.id,
      tags: {
        connect: [rpgTag, novidadeTag].filter(Boolean).map((t) => ({ id: t!.id })),
      },
    },
  });

  // Create variations for sample product
  const heroicScale = await prisma.scale.findUnique({
    where: { code: 'HEROIC_28' },
  });
  const wargameScale = await prisma.scale.findUnique({
    where: { code: 'WARGAME_32' },
  });

  if (heroicScale) {
    await prisma.productVariation.upsert({
      where: {
        productId_scaleId: {
          productId: sampleProduct.id,
          scaleId: heroicScale.id,
        },
      },
      update: {},
      create: {
        productId: sampleProduct.id,
        name: 'Heroic (28mm)',
        scaleId: heroicScale.id,
        sku: 'ELF-WAR-001-28',
        price: 49.9,
        stock: 50,
      },
    });
  }

  if (wargameScale) {
    await prisma.productVariation.upsert({
      where: {
        productId_scaleId: {
          productId: sampleProduct.id,
          scaleId: wargameScale.id,
        },
      },
      update: {},
      create: {
        productId: sampleProduct.id,
        name: 'Wargame (32mm)',
        scaleId: wargameScale.id,
        sku: 'ELF-WAR-001-32',
        price: 57.39,
        stock: 30,
      },
    });
  }

  console.log('  ✅ Sample product "Guerreira Élfica" with 2 variations');

  // ─── Email Templates ───────────────────────────────────────
  const emailLayout = (content: string) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f9fc;padding:24px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:100%">
  <!-- Header -->
  <tr><td style="background:#1a1a2e;padding:24px;text-align:center">
    <h1 style="color:#e0a526;margin:0;font-size:28px">ElitePinup3D</h1>
  </td></tr>
  <!-- Content -->
  <tr><td style="padding:32px 24px">
    ${content}
  </td></tr>
  <!-- Footer -->
  <tr><td style="border-top:1px solid #e6ebf1;padding:16px 24px;text-align:center">
    <p style="color:#8898aa;font-size:12px;margin:4px 0">&copy; 2026 ElitePinup3D. Todos os direitos reservados.</p>
    <p style="color:#8898aa;font-size:12px;margin:4px 0">Você recebeu este email porque possui uma conta em nossa loja.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const emailTemplates = [
    {
      type: 'welcome',
      subject: 'Bem-vindo à ElitePinup3D, {{nome_cliente}}!',
      htmlBody: emailLayout(`
    <h2 style="color:#1a1a2e;margin:0 0 16px">Bem-vindo, {{nome_cliente}}!</h2>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Sua conta foi criada com sucesso. Agora você pode explorar nosso catálogo exclusivo de miniaturas 3D,
      acompanhar seus pedidos e muito mais.
    </p>
    <p style="text-align:center;margin:24px 0">
      <a href="{{url_loja}}/produtos" style="background:#e0a526;color:#1a1a2e;font-weight:bold;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:16px;display:inline-block">Explorar Catálogo</a>
    </p>
    <p style="color:#525f7f;font-size:16px">Se tiver alguma dúvida, responda este email que teremos prazer em ajudar.</p>`),
      availableTags: JSON.stringify([
        { tag: 'nome_cliente', description: 'Nome do cliente' },
        { tag: 'email_cliente', description: 'Email do cliente' },
        { tag: 'url_loja', description: 'URL da loja' },
      ]),
    },
    {
      type: 'order-confirmation',
      subject: 'Pedido confirmado: {{numero_pedido}}',
      htmlBody: emailLayout(`
    <h2 style="color:#1a1a2e;margin:0 0 16px">Pedido Confirmado!</h2>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Olá, {{nome_cliente}}! Seu pedido <strong>{{numero_pedido}}</strong> foi recebido com sucesso.
    </p>
    <div style="margin:16px 0">
      <p style="font-size:14px;font-weight:bold;color:#8898aa;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 12px">Itens do Pedido</p>
      {{itens_pedido}}
    </div>
    <hr style="border:none;border-top:1px solid #e6ebf1;margin:12px 0"/>
    <table width="100%" cellpadding="4" cellspacing="0">
      <tr><td style="color:#525f7f;font-size:14px">Subtotal</td><td style="color:#1a1a2e;font-size:14px;text-align:right">R$ {{subtotal}}</td></tr>
      <tr><td style="color:#525f7f;font-size:14px">Frete</td><td style="color:#1a1a2e;font-size:14px;text-align:right">{{frete}}</td></tr>
      <tr><td style="color:#525f7f;font-size:14px">Desconto</td><td style="color:#22c55e;font-size:14px;text-align:right">{{desconto}}</td></tr>
      <tr><td colspan="2"><hr style="border:none;border-top:1px solid #e6ebf1"/></td></tr>
      <tr><td style="color:#1a1a2e;font-size:18px;font-weight:bold">Total</td><td style="color:#1a1a2e;font-size:18px;font-weight:bold;text-align:right">R$ {{total}}</td></tr>
    </table>
    <div style="background:#f6f9fc;border-radius:6px;padding:12px 16px;margin:16px 0">
      <p style="font-size:12px;color:#8898aa;text-transform:uppercase;margin:0 0 4px">Método de pagamento</p>
      <p style="font-size:16px;color:#1a1a2e;font-weight:bold;margin:0">{{metodo_pagamento}}</p>
    </div>
    <p style="text-align:center;margin:24px 0">
      <a href="{{url_loja}}/minha-conta/pedidos" style="background:#e0a526;color:#1a1a2e;font-weight:bold;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:16px;display:inline-block">Acompanhar Pedido</a>
    </p>`),
      availableTags: JSON.stringify([
        { tag: 'nome_cliente', description: 'Nome do cliente' },
        { tag: 'numero_pedido', description: 'Número do pedido (ex: ORD-20260402-ABC)' },
        { tag: 'itens_pedido', description: 'Lista de itens formatada em HTML' },
        { tag: 'subtotal', description: 'Subtotal (ex: 229,70)' },
        { tag: 'frete', description: 'Valor do frete ou "Grátis"' },
        { tag: 'desconto', description: 'Valor do desconto (ex: -R$ 10,00)' },
        { tag: 'total', description: 'Total do pedido (ex: 234,70)' },
        { tag: 'metodo_pagamento', description: 'Método de pagamento (PIX, Boleto, Cartão)' },
        { tag: 'url_loja', description: 'URL da loja' },
      ]),
    },
    {
      type: 'status-change',
      subject: 'Pedido {{numero_pedido}} — {{status_label}}',
      htmlBody: emailLayout(`
    <h2 style="color:#1a1a2e;margin:0 0 16px">Atualização do Pedido</h2>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Olá, {{nome_cliente}}! Seu pedido <strong>{{numero_pedido}}</strong> foi atualizado.
    </p>
    <p style="text-align:center;margin:16px 0">
      <span style="display:inline-block;background:#e0a526;color:#1a1a2e;font-weight:bold;font-size:18px;padding:8px 24px;border-radius:20px">{{status_label}}</span>
    </p>
    <p style="color:#525f7f;font-size:16px;line-height:24px">{{status_descricao}}</p>
    {{rastreio_secao}}
    <p style="text-align:center;margin:24px 0">
      <a href="{{url_loja}}/minha-conta/pedidos" style="background:#e0a526;color:#1a1a2e;font-weight:bold;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:16px;display:inline-block">Ver Detalhes do Pedido</a>
    </p>`),
      availableTags: JSON.stringify([
        { tag: 'nome_cliente', description: 'Nome do cliente' },
        { tag: 'numero_pedido', description: 'Número do pedido' },
        { tag: 'status_label', description: 'Status traduzido (Confirmado, Em Produção, Enviado, etc.)' },
        { tag: 'status_descricao', description: 'Descrição do status atual' },
        { tag: 'rastreio_secao', description: 'Seção de rastreio (só aparece quando enviado)' },
        { tag: 'codigo_rastreio', description: 'Código de rastreio (ex: BR123456789)' },
        { tag: 'url_loja', description: 'URL da loja' },
      ]),
    },
    {
      type: 'password-reset',
      subject: 'Redefinição de senha — ElitePinup3D',
      htmlBody: emailLayout(`
    <h2 style="color:#1a1a2e;margin:0 0 16px">Redefinir Senha</h2>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Olá, {{nome_cliente}}! Recebemos uma solicitação para redefinir a senha da sua conta.
    </p>
    <p style="text-align:center;margin:24px 0">
      <a href="{{url_redefinicao}}" style="background:#e0a526;color:#1a1a2e;font-weight:bold;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:16px;display:inline-block">Redefinir Minha Senha</a>
    </p>
    <p style="color:#8898aa;font-size:14px;line-height:22px">
      Este link expira em <strong>1 hora</strong>. Se você não solicitou a redefinição, ignore este email.
    </p>
    <div style="background:#f6f9fc;border-radius:6px;padding:12px 16px;margin:16px 0">
      <p style="font-size:12px;color:#8898aa;margin:0 0 4px">Ou copie e cole este link no navegador:</p>
      <p style="font-size:12px;color:#525f7f;word-break:break-all;margin:0">{{url_redefinicao}}</p>
    </div>`),
      availableTags: JSON.stringify([
        { tag: 'nome_cliente', description: 'Nome do cliente' },
        { tag: 'url_redefinicao', description: 'URL com token para redefinir senha' },
        { tag: 'url_loja', description: 'URL da loja' },
      ]),
    },
    {
      type: 'review-reward',
      subject: 'Você ganhou {{percentual_desconto}}% de desconto!',
      htmlBody: emailLayout(`
    <h2 style="color:#1a1a2e;margin:0 0 16px">Obrigado pela sua avaliação!</h2>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Olá, {{nome_cliente}}! Sua avaliação do produto <strong>{{nome_produto}}</strong> foi aprovada.
    </p>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Como agradecimento, aqui está um cupom de <strong>{{percentual_desconto}}%</strong> de desconto para sua próxima compra:
    </p>
    <div style="text-align:center;margin:24px 0;background:#1a1a2e;border-radius:8px;padding:20px">
      <p style="color:#e0a526;font-size:28px;font-weight:bold;font-family:monospace;letter-spacing:2px;margin:0">{{codigo_cupom}}</p>
    </div>
    <p style="text-align:center;margin:24px 0">
      <a href="{{url_loja}}/produtos" style="background:#e0a526;color:#1a1a2e;font-weight:bold;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:16px;display:inline-block">Usar Meu Cupom</a>
    </p>
    <p style="font-size:12px;color:#8898aa">O cupom é válido para uma única utilização e não pode ser combinado com outras promoções.</p>`),
      availableTags: JSON.stringify([
        { tag: 'nome_cliente', description: 'Nome do cliente' },
        { tag: 'nome_produto', description: 'Nome do produto avaliado' },
        { tag: 'codigo_cupom', description: 'Código do cupom de desconto' },
        { tag: 'percentual_desconto', description: 'Percentual de desconto (ex: 5)' },
        { tag: 'url_loja', description: 'URL da loja' },
      ]),
    },
  ];

  for (const tpl of emailTemplates) {
    await prisma.emailTemplate.upsert({
      where: { type: tpl.type },
      update: {},
      create: tpl,
    });
  }

  console.log('  ✅ 5 email templates (welcome, order, status, password-reset, review-reward)');

  console.log('\n🎉 Seed completed!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
