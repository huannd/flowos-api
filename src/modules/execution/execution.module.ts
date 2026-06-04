import { Module } from '@nestjs/common';
import { ExecutionController } from './execution.controller';
import { ExecutionService } from './execution.service';
import { ExecutionCronService } from './execution-cron.service';
import { PrismaService } from '../../core/database/prisma.service';
import { RedisService } from '../../core/redis/redis.service';
import { SseService } from '../../core/sse/sse.service';

@Module({
  controllers: [ExecutionController],
  providers: [
    ExecutionService,
    ExecutionCronService,
    PrismaService,
    RedisService,
    SseService,
  ],
  exports: [ExecutionService, SseService],
})
export class ExecutionModule {}
