import { Module } from '@nestjs/common';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';
import { PrismaService } from '../../core/database/prisma.service';
import { RedisService } from '../../core/redis/redis.service';

@Module({
  controllers: [TemplateController],
  providers: [TemplateService, PrismaService, RedisService],
  exports: [TemplateService],
})
export class TemplateModule {}
