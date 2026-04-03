import {
  Global,
  Module,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { EmailService } from './email.service';
import { EmailQueueService } from './email-queue.service';
import { EmailTemplateService } from './email-template.service';
import { EmailTemplateController } from './email-template.controller';

@Global()
@Module({
  controllers: [EmailTemplateController],
  providers: [
    EmailService,
    EmailTemplateService,
    {
      provide: 'REDIS_CONNECTION',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>(
          'REDIS_URL',
          'redis://localhost:6379',
        );
        const password = configService.get<string>('REDIS_PASSWORD');
        const parsed = new URL(url);
        return {
          host: parsed.hostname,
          port: parseInt(parsed.port || '6379', 10),
          password: password || parsed.password || undefined,
        };
      },
    },
    EmailQueueService,
  ],
  exports: [EmailService, EmailQueueService, EmailTemplateService],
})
export class EmailModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailModule.name);
  private worker: Worker | null = null;

  constructor(
    private readonly emailQueueService: EmailQueueService,
    @Inject('REDIS_CONNECTION')
    private readonly redisConnection: {
      host: string;
      port: number;
      password?: string;
    },
  ) {}

  onModuleInit() {
    this.worker = new Worker(
      'email',
      async (job) => {
        await this.emailQueueService.processJob(job.data);
      },
      {
        connection: this.redisConnection,
        concurrency: 5,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Email job ${job.id} completed: ${job.name}`);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Email job ${job?.id} failed: ${error.message}`,
        error.stack,
      );
    });

    this.logger.log('Email worker started');
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
