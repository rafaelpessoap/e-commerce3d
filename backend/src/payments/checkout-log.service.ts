import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const SENSITIVE_KEYS = [
  'cardToken',
  'payerCpf',
  'password',
  'token',
  'securityCode',
  'cvv',
];

function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.includes(key) && typeof value === 'string') {
      result[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitize(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function safeStringify(data: unknown): string | undefined {
  if (data === undefined || data === null) return undefined;
  try {
    if (typeof data === 'object') {
      return JSON.stringify(sanitize(data as Record<string, unknown>));
    }
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

function formatError(err: unknown): string {
  if (err instanceof Error) {
    const extra =
      (err as unknown as Record<string, unknown>).cause ??
      (err as unknown as Record<string, unknown>).response ??
      (err as unknown as Record<string, unknown>).body;
    let msg = err.message;
    if (extra) {
      try {
        msg += ' | ' + JSON.stringify(extra);
      } catch {
        // ignore
      }
    }
    if (err.stack) msg += '\n' + err.stack;
    return msg;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export interface CheckoutLogParams {
  step: string;
  status: 'success' | 'error';
  orderId?: string;
  userId?: string;
  method?: string;
  request?: unknown;
  response?: unknown;
  error?: unknown;
  duration?: number;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class CheckoutLogService {
  private readonly logger = new Logger(CheckoutLogService.name);

  constructor(private prisma: PrismaService) {}

  async log(params: CheckoutLogParams): Promise<void> {
    try {
      await this.prisma.checkoutLog.create({
        data: {
          step: params.step,
          status: params.status,
          orderId: params.orderId,
          userId: params.userId,
          method: params.method,
          request: safeStringify(params.request),
          response: safeStringify(params.response),
          error: params.error ? formatError(params.error) : undefined,
          duration: params.duration,
          ip: params.ip,
          userAgent: params.userAgent,
          metadata: params.metadata
            ? JSON.stringify(params.metadata)
            : undefined,
        },
      });
    } catch (err) {
      // Fire-and-forget: logging should never break the checkout flow
      this.logger.error(
        `Failed to save checkout log: ${(err as Error).message}`,
      );
    }
  }

  async findByOrder(orderId: string) {
    return this.prisma.checkoutLog.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
