import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from '../../core/database/prisma.service';
import { RedisService } from '../../core/redis/redis.service';

@Module({
  controllers: [HealthController],
  providers: [PrismaService, RedisService],
})
export class HealthModule {}
