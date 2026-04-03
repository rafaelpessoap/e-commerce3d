import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Tags que contêm HTML e NÃO devem ser escapadas
const HTML_TAGS = new Set(['itens_pedido', 'rastreio_secao']);

@Injectable()
export class EmailTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.emailTemplate.findMany({
      orderBy: { type: 'asc' },
    });
  }

  async findByType(type: string) {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { type },
    });

    if (!template) {
      throw new NotFoundException(`Email template '${type}' not found`);
    }

    return template;
  }

  async update(id: string, data: { subject?: string; htmlBody?: string }) {
    return this.prisma.emailTemplate.update({
      where: { id },
      data,
    });
  }

  /**
   * Replace {{tag}} placeholders with actual values.
   * Values are HTML-escaped by default (XSS prevention).
   * Tags in HTML_TAGS set are NOT escaped (they contain trusted HTML like item tables).
   */
  renderTemplate(
    template: { subject: string; htmlBody: string },
    variables: Record<string, string>,
  ): { subject: string; html: string } {
    let subject = template.subject;
    let html = template.htmlBody;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      const safeValue = HTML_TAGS.has(key) ? value : this.escapeHtml(value);

      subject = subject.replaceAll(placeholder, safeValue);
      html = html.replaceAll(placeholder, safeValue);
    }

    return { subject, html };
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
