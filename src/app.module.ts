import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

// Core
import { PrismaService } from './core/database/prisma.service';
import { RedisService } from './core/redis/redis.service';
import { CryptoService } from './core/security/crypto.service';
import { N8nClientService } from './core/n8n/n8n-client.service';
import { QuotaService } from './core/quota/quota.service';
import { SseService } from './core/sse/sse.service';

// Middleware
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { TemplateModule } from './modules/template/template.module';
import { AutomationModule } from './modules/automation/automation.module';
import { ExecutionModule } from './modules/execution/execution.module';
import { CredentialModule } from './modules/credential/credential.module';
import { BillingModule } from './modules/billing/billing.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    HealthModule,
    AuthModule,
    UserModule,
    TemplateModule,
    AutomationModule,
    ExecutionModule,
    CredentialModule,
    BillingModule,
    WebhookModule,
    AdminModule,
  ],
  providers: [
    PrismaService,
    RedisService,
    CryptoService,
    N8nClientService,
    QuotaService,
    SseService,
  ],
  exports: [
    PrismaService,
    RedisService,
    CryptoService,
    N8nClientService,
    QuotaService,
    SseService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Request ID first (used by logger)
    consumer.apply(RequestIdMiddleware).forRoutes('*');
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
