import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // SEGURANCA: ValidationPipe global
  // whitelist: remove campos nao declarados no DTO
  // forbidNonWhitelisted: retorna erro 400 se campos extras forem enviados
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );

  app.enableCors();

  await app.listen(process.env.BACKEND_PORT ?? 4000);
}
bootstrap();
