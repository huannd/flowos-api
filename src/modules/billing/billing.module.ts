import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PrismaService } from '../../core/database/prisma.service';
import { RedisService } from '../../core/redis/redis.service';

@Module({
  controllers: [BillingController],
  providers: [BillingService, PrismaService, RedisService],
  exports: [BillingService],
})
export class BillingModule {}
