import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaService } from '../../core/database/prisma.service';
import { RedisService } from '../../core/redis/redis.service';
import { N8nClientService } from '../../core/n8n/n8n-client.service';
import { TemplateService } from '../template/template.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, PrismaService, RedisService, N8nClientService, TemplateService],
})
export class AdminModule {}
