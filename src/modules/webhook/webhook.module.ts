import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { PrismaService } from '../../core/database/prisma.service';
import { RedisService } from '../../core/redis/redis.service';

@Module({
  controllers: [WebhookController],
  providers: [WebhookService, PrismaService, RedisService],
})
export class WebhookModule {}
