import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { validateEnvironment } from './core/config/config.validation';

async function bootstrap() {
  // ═══ Validate environment BEFORE creating the app ═══
  validateEnvironment();

  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug'],
  });
  const logger = new Logger('Bootstrap');

  // Graceful shutdown hooks (Prisma, Redis cleanup)
  app.enableShutdownHooks();

  // Security
  app.use(helmet());

  // CORS — explicit origins, no wildcard in production
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
    : ['http://localhost:3000', 'http://localhost:3001'];
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? corsOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Webhook-Secret'],
    exposedHeaders: ['X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // API Version header
  app.enableVersioning({ type: VersioningType.HEADER, header: 'X-API-Version' });

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger — only in non-production
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('FlowOS API')
      .setDescription(
        'Workflow Automation SaaS Platform API\n\n' +
        '## Authentication\n' +
        'Most endpoints require a Bearer JWT token. Get one via `POST /api/auth/login`.\n\n' +
        '## Rate Limiting\n' +
        'Automation endpoints: 5 requests/minute per user.\n' +
        'Auth endpoints: 10 requests/minute per IP.\n' +
        'General API: 30 requests/second per IP.\n\n' +
        '## SSE Streaming\n' +
        'Use `GET /api/executions/:id/stream` or `GET /api/executions/stream/dashboard`.\n' +
        'Pass JWT token via query param: `?token=<JWT>`\n\n' +
        '## Health Checks\n' +
        '- Liveness: `GET /api/health/live`\n' +
        '- Readiness: `GET /api/health/ready`\n' +
        '- Detailed: `GET /api/health`',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('health', 'Health Checks — Liveness, Readiness, Detailed')
      .addTag('auth', 'Authentication — Register & Login')
      .addTag('user', 'User Profile Management')
      .addTag('templates', 'Template Marketplace — Browse & Search')
      .addTag('automations', 'Run Automations — Core Engine')
      .addTag('executions', 'Execution History & SSE Streaming')
      .addTag('credentials', 'User Credentials — Encrypted Storage')
      .addTag('billing', 'Billing, Subscription & Payments')
      .addTag('admin', 'Admin Operations — Analytics, RBAC')
      .addTag('webhooks', 'n8n Webhooks — Internal Only')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      customSiteTitle: 'FlowOS API Docs',
      customfavIcon: 'https://swagger.io/favicon-32x32.png',
    });
  }

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 FlowOS API running at http://localhost:${port}/api`);
  logger.log(`📚 Swagger docs at http://localhost:${port}/docs`);
  logger.log(`❤️  Health check at http://localhost:${port}/api/health`);
  logger.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
}
bootstrap();
