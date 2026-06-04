import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { RedisService } from '../../core/redis/redis.service';

/**
 * Scheduled tasks for execution lifecycle management.
 *
 * 1. Timeout Cleanup: Mark stale PENDING/RUNNING executions as TIMEOUT
 * 2. Stats Aggregation: Pre-compute dashboard stats
 */
@Injectable()
export class ExecutionCronService {
  private readonly logger = new Logger(ExecutionCronService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /**
   * Run every 2 minutes:
   * Mark PENDING executions older than 5 minutes as TIMEOUT.
   * Mark RUNNING executions older than 10 minutes as TIMEOUT.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleTimeoutCleanup() {
    const now = new Date();

    // PENDING > 5 minutes → TIMEOUT
    const pendingCutoff = new Date(now.getTime() - 5 * 60 * 1000);
    const timedOutPending = await this.prisma.execution.updateMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: pendingCutoff },
      },
      data: {
        status: 'TIMEOUT',
        errorMessage: 'Execution timed out: failed to start within 5 minutes',
        finishedAt: now,
      },
    });

    // RUNNING > 10 minutes → TIMEOUT
    const runningCutoff = new Date(now.getTime() - 10 * 60 * 1000);
    const timedOutRunning = await this.prisma.execution.updateMany({
      where: {
        status: 'RUNNING',
        startedAt: { lt: runningCutoff },
      },
      data: {
        status: 'TIMEOUT',
        errorMessage: 'Execution timed out: exceeded 10 minute limit',
        finishedAt: now,
      },
    });

    const total = timedOutPending.count + timedOutRunning.count;
    if (total > 0) {
      this.logger.warn(
        `⏱️ Timeout cleanup: ${timedOutPending.count} pending, ${timedOutRunning.count} running → TIMEOUT`,
      );

      // Publish SSE events for timed-out executions
      const timedOutExecs = await this.prisma.execution.findMany({
        where: {
          status: 'TIMEOUT',
          finishedAt: { gte: new Date(now.getTime() - 60 * 1000) },
        },
        select: { id: true, userId: true },
      });

      for (const exec of timedOutExecs) {
        await this.redis.publish(`flowos:sse:exec:${exec.id}`, {
          event: 'error',
          data: {
            executionId: exec.id,
            status: 'TIMEOUT',
            errorMessage: 'Execution timed out',
          },
        });
        await this.redis.publish(`flowos:sse:user:${exec.userId}`, {
          event: 'error',
          data: {
            executionId: exec.id,
            status: 'TIMEOUT',
          },
        });
      }
    }
  }

  /**
   * Run every hour: Archive old executions (keep summary only).
   * Removes inputData/outputData from executions older than 30 days.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleDataArchival() {
    const archiveCutoff = new Date();
    archiveCutoff.setDate(archiveCutoff.getDate() - 30);

    const archived = await this.prisma.execution.updateMany({
      where: {
        createdAt: { lt: archiveCutoff },
        inputData: { not: {} },
      },
      data: {
        inputData: {},
        outputData: Prisma.JsonNull,
        metadata: { archived: true, archivedAt: new Date().toISOString() } as any,
      },
    });

    if (archived.count > 0) {
      this.logger.log(`🗄️ Archived ${archived.count} old executions (>30 days)`);
    }
  }

  /**
   * Run daily at 1 AM: Sync Redis quota counters with DB.
   * This ensures consistency if Redis was restarted.
   */
  @Cron('0 1 * * *')
  async handleQuotaSync() {
    const month = new Date().toISOString().slice(0, 7);

    // Get all users with executions this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const userCounts = await this.prisma.execution.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: startOfMonth },
        status: { not: 'TIMEOUT' },
      },
      _count: true,
    });

    for (const uc of userCounts) {
      const redisKey = `flowos:quota:${uc.userId}:${month}`;
      const currentRedis = await this.redis.getQuota(uc.userId, month);

      if (currentRedis !== uc._count) {
        // Sync DB count to Redis
        const client = this.redis.getClient();
        await client.set(redisKey, uc._count.toString(), 'EX', 35 * 24 * 60 * 60);

        // Also update/upsert UsageLog
        await this.prisma.usageLog.upsert({
          where: { userId_month: { userId: uc.userId, month } },
          update: { execCount: uc._count },
          create: { userId: uc.userId, month, execCount: uc._count },
        });
      }
    }

    this.logger.log(`📊 Quota sync: ${userCounts.length} users synced for ${month}`);
  }
}
