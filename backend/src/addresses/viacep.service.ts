import { Injectable, BadRequestException, Logger } from '@nestjs/common';

export interface ViaCepResult {
  postalCode: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

@Injectable()
export class ViaCepService {
  private readonly logger = new Logger(ViaCepService.name);

  async lookup(cep: string): Promise<ViaCepResult | null> {
    const cleaned = cep.replace(/\D/g, '');

    if (cleaned.length !== 8) {
      throw new BadRequestException('CEP must be exactly 8 digits');
    }

    try {
      const response = await fetch(
        `https://viacep.com.br/ws/${cleaned}/json/`,
      );
      const data = await response.json();

      if (data.erro) {
        throw new BadRequestException('CEP not found');
      }

      return {
        postalCode: cleaned,
        street: data.logradouro,
        neighborhood: data.bairro,
        city: data.localidade,
        state: data.uf,
      };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      // Se API falhar, permite preenchimento manual
      this.logger.warn(`ViaCEP API failed for ${cleaned}: ${err}`);
      return null;
    }
  }
}
