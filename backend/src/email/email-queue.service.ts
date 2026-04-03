import { Injectable, Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { EmailService } from './email.service';

type EmailType =
  | 'welcome'
  | 'order-confirmation'
  | 'status-change'
  | 'password-reset'
  | 'review-reward';

interface EmailJob {
  type: EmailType;
  payload: any;
}

@Injectable()
export class EmailQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(EmailQueueService.name);
  private queue: Queue;

  constructor(
    private readonly emailService: EmailService,
    @Inject('REDIS_CONNECTION')
    private readonly redisConnection: { host: string; port: number; password?: string },
  ) {
    this.queue = new Queue('email', {
      connection: this.redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    });
  }

  async onModuleDestroy() {
    await this.queue.close();
  }

  async enqueueWelcome(payload: { to: string; name: string }) {
    return this.queue.add('welcome', { type: 'welcome', payload });
  }

  async enqueueOrderConfirmation(payload: {
    to: string;
    customerName: string;
    orderNumber: string;
    items: Array<{ name: string; quantity: number; price: number }>;
    subtotal: number;
    shipping: number;
    discount: number;
    total: number;
    paymentMethod: string;
  }) {
    return this.queue.add('order-confirmation', {
      type: 'order-confirmation',
      payload,
    });
  }

  async enqueueStatusChange(payload: {
    to: string;
    customerName: string;
    orderNumber: string;
    newStatus: string;
    trackingCode?: string;
  }) {
    return this.queue.add('status-change', { type: 'status-change', payload });
  }

  async enqueuePasswordReset(payload: {
    to: string;
    name: string;
    resetUrl: string;
  }) {
    return this.queue.add('password-reset', {
      type: 'password-reset',
      payload,
    });
  }

  async enqueueReviewReward(payload: {
    to: string;
    customerName: string;
    productName: string;
    couponCode: string;
    discountPercent: number;
  }) {
    return this.queue.add('review-reward', {
      type: 'review-reward',
      payload,
    });
  }

  /**
   * Process a job — called by the Worker in EmailModule
   */
  async processJob(job: EmailJob): Promise<void> {
    const { type, payload } = job;

    switch (type) {
      case 'welcome':
        await this.emailService.sendWelcome(payload);
        break;
      case 'order-confirmation':
        await this.emailService.sendOrderConfirmation(payload);
        break;
      case 'status-change':
        await this.emailService.sendStatusChange(payload);
        break;
      case 'password-reset':
        await this.emailService.sendPasswordReset(payload);
        break;
      case 'review-reward':
        await this.emailService.sendReviewReward(payload);
        break;
      default:
        throw new Error(`Unknown email type: ${type}`);
    }

    this.logger.log(`Email sent: ${type} to ${payload.to}`);
  }
}
