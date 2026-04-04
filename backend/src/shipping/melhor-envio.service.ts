import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

// Lista completa de serviços do Melhor Envio
const MELHOR_ENVIO_SERVICES = [
  { id: 1, name: 'PAC', company: 'Correios' },
  { id: 2, name: 'SEDEX', company: 'Correios' },
  { id: 3, name: 'Mini Envios', company: 'Correios' },
  { id: 4, name: '.Package', company: 'Jadlog' },
  { id: 5, name: '.Com', company: 'Jadlog' },
  { id: 12, name: 'Rodoviário', company: 'Latam Cargo' },
  { id: 17, name: '.Package', company: 'Azul Cargo Express' },
  { id: 27, name: 'Expresso', company: 'Via Brasil' },
  { id: 28, name: 'Rodoviário', company: 'Via Brasil' },
  { id: 33, name: 'BA Normal', company: 'Buslog' },
  { id: 34, name: 'BA Rápido', company: 'Buslog' },
];

export interface ShippingProduct {
  weight: number; // kg
  width: number; // cm
  height: number; // cm
  length: number; // cm
  quantity: number;
  price: number; // R$
}

export interface ShippingQuote {
  serviceId: number;
  name: string;
  company: string;
  price: number;
  deliveryDays: number;
  deliveryRange: { min: number; max: number };
}

@Injectable()
export class MelhorEnvioService {
  private readonly logger = new Logger(MelhorEnvioService.name);
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly fromCep: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.token = this.configService.get<string>('MELHOR_ENVIO_TOKEN') ?? '';
    this.baseUrl =
      this.configService.get<string>('MELHOR_ENVIO_URL') ??
      'https://melhorenvio.com.br';
    this.fromCep =
      this.configService.get<string>('SHOP_CEP') ?? '01001000';
  }

  /**
   * Lista de todos os serviços do Melhor Envio (fallback hardcoded)
   */
  getAvailableServices() {
    return MELHOR_ENVIO_SERVICES;
  }

  /**
   * Busca a lista real de serviços disponíveis na API do Melhor Envio.
   * Sincroniza com o banco (upsert para cada serviço encontrado).
   */
  async syncServicesFromApi(): Promise<{ synced: number; services: Array<{ id: number; name: string; company: string }> }> {
    if (!this.token) {
      this.logger.warn('MELHOR_ENVIO_TOKEN não configurado — usando serviços padrão');
      // Fallback: sync hardcoded services to DB via upsert
      const services: Array<{ id: number; name: string; company: string }> = [];
      for (const svc of MELHOR_ENVIO_SERVICES) {
        services.push(svc);
        await this.prisma.shippingMethod.upsert({
          where: { serviceId: svc.id },
          create: {
            serviceId: svc.id,
            name: svc.name,
            company: svc.company,
            isActive: false,
          },
          update: {
            name: svc.name,
            company: svc.company,
          },
        });
      }
      return { synced: services.length, services };
    }

    // Buscar CEP de origem do banco
    const fromCepSetting = await this.prisma.setting
      .findUnique({ where: { key: 'shop_cep' } })
      .catch(() => null);
    const fromCep = fromCepSetting?.value ?? this.fromCep ?? '01001000';

    // Faz uma cotação com dados fictícios para descobrir os serviços disponíveis
    const body = {
      from: { postal_code: fromCep },
      to: { postal_code: '30130000' },
      products: [{ id: '1', width: 15, height: 10, length: 20, weight: 0.5, insurance_value: 50, quantity: 1 }],
    };

    const response = await fetch(
      `${this.baseUrl}/api/v2/me/shipment/calculate`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
          'User-Agent': 'ElitePinup3D (rafaelzezao@gmail.com)',
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      this.logger.error(`Melhor Envio sync error: ${response.status} — ${errorBody}`);
      throw new BadRequestException(`Não foi possível sincronizar transportadoras (${response.status})`);
    }

    const data: any[] = await response.json();
    const services: Array<{ id: number; name: string; company: string }> = [];

    for (const item of data) {
      if (!item.id || !item.company?.name) continue;
      const svc = { id: item.id, name: item.name, company: item.company.name };
      services.push(svc);

      // Upsert: cria novos, atualiza nome/empresa de existentes (preserva isActive/displayName/extraDays)
      await this.prisma.shippingMethod.upsert({
        where: { serviceId: item.id },
        create: {
          serviceId: item.id,
          name: item.name,
          company: item.company.name,
          isActive: false,
        },
        update: {
          name: item.name,
          company: item.company.name,
        },
      });
    }

    return { synced: services.length, services };
  }

  /**
   * Retorna os serviços habilitados no banco
   */
  async getEnabledMethods() {
    return this.prisma.shippingMethod.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Retorna todos os serviços (ativos e inativos) para o admin
   */
  async getAllMethods() {
    return this.prisma.shippingMethod.findMany({
      orderBy: { serviceId: 'asc' },
    });
  }

  /**
   * Habilita/desabilita um serviço de frete + editar displayName e extraDays
   */
  async toggleMethod(data: {
    serviceId: number;
    name: string;
    company: string;
    isActive: boolean;
    displayName?: string;
    extraDays?: number;
  }) {
    return this.prisma.shippingMethod.upsert({
      where: { serviceId: data.serviceId },
      create: {
        serviceId: data.serviceId,
        name: data.name,
        displayName: data.displayName ?? null,
        company: data.company,
        extraDays: data.extraDays ?? 0,
        isActive: data.isActive,
      },
      update: {
        isActive: data.isActive,
        name: data.name,
        displayName: data.displayName ?? undefined,
        company: data.company,
        extraDays: data.extraDays ?? undefined,
      },
    });
  }

  /**
   * Consulta cotações na API do Melhor Envio.
   * Retorna apenas serviços habilitados no admin e sem erros.
   */
  async getQuotes(params: {
    toCep: string;
    products: ShippingProduct[];
    extraDays?: number;
  }): Promise<ShippingQuote[]> {
    const enabledMethods = await this.prisma.shippingMethod.findMany({
      where: { isActive: true },
    });
    const enabledMap = new Map(
      enabledMethods.map((m) => [m.serviceId, m]),
    );

    // Buscar CEP de origem do banco (editável no admin) ou fallback para env
    const fromCepSetting = await this.prisma.setting
      .findUnique({ where: { key: 'shop_cep' } })
      .catch(() => null);
    const fromCep = fromCepSetting?.value ?? this.fromCep;

    // Montar payload para a API do Melhor Envio
    const body = {
      from: { postal_code: fromCep },
      to: { postal_code: params.toCep.replace(/\D/g, '') },
      products: params.products.map((p) => ({
        id: '1',
        width: p.width,
        height: p.height,
        length: p.length,
        weight: p.weight,
        insurance_value: p.price * p.quantity,
        quantity: p.quantity,
      })),
    };

    const response = await fetch(
      `${this.baseUrl}/api/v2/me/shipment/calculate`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
          'User-Agent': 'ElitePinup3D (rafaelzezao@gmail.com)',
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      this.logger.error(
        `Melhor Envio API error: ${response.status} ${response.statusText}`,
      );
      throw new BadRequestException(
        'Não foi possível calcular o frete. Tente novamente.',
      );
    }

    const data: any[] = await response.json();
    const extraDays = params.extraDays ?? 0;

    return data
      .filter((item) => !item.error && enabledMap.has(item.id))
      .map((item) => {
        const method = enabledMap.get(item.id);
        const methodExtraDays = method?.extraDays ?? 0;
        const totalExtra = extraDays + methodExtraDays;

        return {
          serviceId: item.id,
          name: method?.displayName || item.name,
          company: item.company?.name ?? '',
          price: parseFloat(item.price),
          deliveryDays: item.delivery_time + totalExtra,
          deliveryRange: {
            min: (item.delivery_range?.min ?? item.delivery_time) + totalExtra,
            max: (item.delivery_range?.max ?? item.delivery_time) + totalExtra,
          },
        };
      });
  }
}
