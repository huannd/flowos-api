import { Module } from '@nestjs/common';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { PrismaService } from '../../core/database/prisma.service';
import { RedisService } from '../../core/redis/redis.service';
import { N8nClientService } from '../../core/n8n/n8n-client.service';
import { QuotaService } from '../../core/quota/quota.service';

@Module({
  controllers: [AutomationController],
  providers: [AutomationService, PrismaService, RedisService, N8nClientService, QuotaService],
  exports: [AutomationService],
})
export class AutomationModule {}
