import { Test, TestingModule } from '@nestjs/testing';
import { EmailTemplateService } from './email-template.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('EmailTemplateService', () => {
  let service: EmailTemplateService;
  let prisma: PrismaService;

  const mockTemplate = {
    id: 'tpl1',
    type: 'welcome',
    subject: 'Bem-vindo, {{nome_cliente}}!',
    htmlBody: '<h1>Olá, {{nome_cliente}}!</h1><p>Email: {{email_cliente}}</p>',
    availableTags: JSON.stringify([
      { tag: 'nome_cliente', description: 'Nome do cliente' },
      { tag: 'email_cliente', description: 'Email do cliente' },
    ]),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailTemplateService,
        {
          provide: PrismaService,
          useValue: {
            emailTemplate: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<EmailTemplateService>(EmailTemplateService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('findAll', () => {
    it('should return all templates', async () => {
      (prisma.emailTemplate.findMany as jest.Mock).mockResolvedValue([mockTemplate]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('welcome');
    });
  });

  describe('findByType', () => {
    it('should return template by type', async () => {
      (prisma.emailTemplate.findUnique as jest.Mock).mockResolvedValue(mockTemplate);

      const result = await service.findByType('welcome');

      expect(result.type).toBe('welcome');
    });

    it('should throw NotFoundException when template not found', async () => {
      (prisma.emailTemplate.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findByType('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update subject and htmlBody', async () => {
      const updated = {
        ...mockTemplate,
        subject: 'Novo assunto',
        htmlBody: '<h1>Novo corpo</h1>',
      };
      (prisma.emailTemplate.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.update('tpl1', {
        subject: 'Novo assunto',
        htmlBody: '<h1>Novo corpo</h1>',
      });

      expect(result.subject).toBe('Novo assunto');
      expect(prisma.emailTemplate.update).toHaveBeenCalledWith({
        where: { id: 'tpl1' },
        data: { subject: 'Novo assunto', htmlBody: '<h1>Novo corpo</h1>' },
      });
    });
  });

  describe('renderTemplate', () => {
    it('should replace all tags in subject and body', () => {
      const result = service.renderTemplate(mockTemplate, {
        nome_cliente: 'João Silva',
        email_cliente: 'joao@email.com',
      });

      expect(result.subject).toBe('Bem-vindo, João Silva!');
      expect(result.html).toContain('Olá, João Silva!');
      expect(result.html).toContain('Email: joao@email.com');
    });

    it('should leave unknown tags untouched', () => {
      const result = service.renderTemplate(mockTemplate, {
        nome_cliente: 'Maria',
      });

      expect(result.subject).toContain('Maria');
      expect(result.html).toContain('{{email_cliente}}');
    });

    it('should handle empty variables gracefully', () => {
      const result = service.renderTemplate(mockTemplate, {});

      expect(result.subject).toBe('Bem-vindo, {{nome_cliente}}!');
      expect(result.html).toContain('{{nome_cliente}}');
    });

    it('should escape HTML in variable values to prevent XSS', () => {
      const result = service.renderTemplate(mockTemplate, {
        nome_cliente: '<script>alert("xss")</script>',
        email_cliente: 'safe@email.com',
      });

      expect(result.html).not.toContain('<script>');
      expect(result.html).toContain('&lt;script&gt;');
    });

    it('should NOT escape HTML in special HTML tags (itens_pedido, rastreio_secao)', () => {
      const tpl = {
        ...mockTemplate,
        htmlBody: '<div>{{itens_pedido}}</div>',
      };

      const result = service.renderTemplate(tpl, {
        itens_pedido: '<table><tr><td>Item 1</td></tr></table>',
      });

      expect(result.html).toContain('<table><tr><td>Item 1</td></tr></table>');
    });
  });
});
