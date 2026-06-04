import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Response } from 'express';
import { SseService } from '../../core/sse/sse.service';
import { randomUUID } from 'crypto';

@Injectable()
export class ExecutionService {
  constructor(
    private prisma: PrismaService,
    private sseService: SseService,
  ) {}

  /**
   * Get single execution by ID (user-scoped).
   */
  async findById(executionId: string, userId: string) {
    const execution = await this.prisma.execution.findFirst({
      where: { id: executionId, userId },
      include: { template: { select: { name: true, icon: true, categoryId: true } } },
    });
    if (!execution) {
      throw new NotFoundException('Execution not found');
    }
    return execution;
  }

  /**
   * List execution history with pagination and filters.
   */
  async findAll(userId: string, query?: {
    page?: number;
    limit?: number;
    status?: string;
    templateId?: string;
    from?: string;
    to?: string;
  }) {
    const page = query?.page || 1;
    const limit = Math.min(query?.limit || 20, 100);
    const where: any = { userId };

    if (query?.status) where.status = query.status;
    if (query?.templateId) where.templateId = query.templateId;
    if (query?.from || query?.to) {
      where.createdAt = {};
      if (query?.from) where.createdAt.gte = new Date(query.from);
      if (query?.to) where.createdAt.lte = new Date(query.to);
    }

    const [executions, total] = await Promise.all([
      this.prisma.execution.findMany({
        where,
        include: { template: { select: { name: true, icon: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.execution.count({ where }),
    ]);

    return {
      executions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get aggregated stats for user dashboard.
   */
  async getStats(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const [
      totalExecutions,
      monthlyExecutions,
      weeklyExecutions,
      successCount,
      errorCount,
      recentExecutions,
    ] = await Promise.all([
      this.prisma.execution.count({ where: { userId } }),
      this.prisma.execution.count({
        where: { userId, createdAt: { gte: startOfMonth } },
      }),
      this.prisma.execution.count({
        where: { userId, createdAt: { gte: startOfWeek } },
      }),
      this.prisma.execution.count({
        where: { userId, status: 'SUCCESS' },
      }),
      this.prisma.execution.count({
        where: { userId, status: 'ERROR' },
      }),
      this.prisma.execution.findMany({
        where: { userId },
        include: { template: { select: { name: true, icon: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const successRate =
      totalExecutions > 0
        ? Math.round((successCount / totalExecutions) * 100)
        : 0;

    // Average duration of successful executions
    const avgDuration = await this.prisma.execution.aggregate({
      where: { userId, status: 'SUCCESS', duration: { not: null } },
      _avg: { duration: true },
    });

    return {
      totalExecutions,
      monthlyExecutions,
      weeklyExecutions,
      successRate,
      errorCount,
      averageDuration: Math.round(avgDuration._avg.duration || 0),
      recentExecutions,
    };
  }

  /**
   * Subscribe to SSE stream for a single execution.
   * Channel: flowos:sse:exec:{executionId}
   */
  async streamExecution(
    executionId: string,
    userId: string,
    res: Response,
  ): Promise<void> {
    // Verify the execution belongs to the user
    const execution = await this.prisma.execution.findFirst({
      where: { id: executionId, userId },
    });
    if (!execution) {
      throw new NotFoundException('Execution not found');
    }

    // If execution is already completed, send final state and close
    if (['SUCCESS', 'ERROR', 'CANCELED', 'TIMEOUT'].includes(execution.status)) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      const event = execution.status === 'SUCCESS' ? 'completed' : 'error';
      const payload = JSON.stringify({
        executionId: execution.id,
        status: execution.status,
        outputData: execution.outputData,
        errorMessage: execution.errorMessage,
        duration: execution.duration,
        finishedAt: execution.finishedAt,
      });
      res.write(`event: ${event}\ndata: ${payload}\n\n`);
      res.write(`event: done\ndata: {}\n\n`);
      res.end();
      return;
    }

    // Subscribe to live updates
    const clientId = `exec-${executionId}-${randomUUID().slice(0, 8)}`;
    const channel = `flowos:sse:exec:${executionId}`;
    await this.sseService.addClient(clientId, res, channel);

    // Send current state as initial event
    const initialPayload = JSON.stringify({
      executionId: execution.id,
      status: execution.status,
      startedAt: execution.startedAt,
    });
    res.write(`event: initial_state\ndata: ${initialPayload}\n\n`);
  }

  /**
   * Subscribe to SSE stream for user dashboard.
   * Channel: flowos:sse:user:{userId}
   * Receives all execution status updates for this user.
   */
  async streamDashboard(userId: string, res: Response): Promise<void> {
    const clientId = `dashboard-${userId}-${randomUUID().slice(0, 8)}`;
    const channel = `flowos:sse:user:${userId}`;
    await this.sseService.addClient(clientId, res, channel);
  }
}
