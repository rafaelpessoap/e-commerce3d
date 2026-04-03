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
