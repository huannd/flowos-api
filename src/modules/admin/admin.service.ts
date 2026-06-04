import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { RedisService } from '../../core/redis/redis.service';
import { N8nClientService } from '../../core/n8n/n8n-client.service';
import { TemplateService } from '../template/template.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private n8nClient: N8nClientService,
    private templateService: TemplateService,
  ) {}

  // ═══════════════════════════════════
  // Template Management
  // ═══════════════════════════════════

  async createTemplate(data: {
    name: string;
    description?: string;
    longDescription?: string;
    icon?: string;
    coverImage?: string;
    categoryId: string;
    n8nWorkflowId: string;
    webhookPath?: string;
    inputSchema: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
    tags?: string[];
    isPremium?: boolean;
    isPublic?: boolean;
    averageRunTime?: number;
    sortOrder?: number;
  }) {
    const template = await this.prisma.template.create({ data: data as any });
    await this.templateService.invalidateCache();
    this.logger.log(`Template created: ${template.name} (${template.id})`);
    return template;
  }

  async updateTemplate(id: string, data: Partial<{
    name: string;
    description: string;
    longDescription: string;
    icon: string;
    coverImage: string;
    categoryId: string;
    webhookPath: string;
    inputSchema: Record<string, unknown>;
    outputSchema: Record<string, unknown>;
    tags: string[];
    isPremium: boolean;
    isPublic: boolean;
    averageRunTime: number;
    sortOrder: number;
  }>) {
    const template = await this.prisma.template.update({ where: { id }, data: data as any });
    await this.templateService.invalidateCache();
    this.logger.log(`Template updated: ${template.name} (${id})`);
    return template;
  }

  async deleteTemplate(id: string) {
    await this.prisma.template.delete({ where: { id } });
    await this.templateService.invalidateCache();
    return { deleted: true };
  }

  // ═══════════════════════════════════
  // User Management
  // ═══════════════════════════════════

  async getUsers(query?: { page?: number; limit?: number; search?: string }) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const where: any = {};
    if (query?.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { fullName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true, email: true, fullName: true, systemRole: true,
          isActive: true, lastLoginAt: true, createdAt: true,
          _count: { select: { executions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ═══════════════════════════════════
  // Analytics — Dashboard Metrics
  // ═══════════════════════════════════

  async getAnalytics() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [
      totalUsers,
      newUsersThisMonth,
      newUsersLastMonth,
      totalExecutions,
      executionsThisMonth,
      executionsLastMonth,
      successCount,
      errorCount,
      totalTemplates,
      activeSubscriptions,
      revenue,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.user.count({
        where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      }),
      this.prisma.execution.count(),
      this.prisma.execution.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      this.prisma.execution.count({
        where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      }),
      this.prisma.execution.count({ where: { status: 'SUCCESS' } }),
      this.prisma.execution.count({ where: { status: 'ERROR' } }),
      this.prisma.template.count(),
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      this.getMonthlyRevenue(),
    ]);

    const userGrowth = newUsersLastMonth > 0
      ? Math.round(((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100)
      : 100;
    const executionGrowth = executionsLastMonth > 0
      ? Math.round(((executionsThisMonth - executionsLastMonth) / executionsLastMonth) * 100)
      : 100;

    return {
      overview: {
        totalUsers,
        newUsersThisMonth,
        userGrowth, // % change
        totalExecutions,
        executionsThisMonth,
        executionGrowth, // % change
        successRate: totalExecutions > 0 ? Math.round((successCount / totalExecutions) * 100) : 0,
        errorCount,
        totalTemplates,
        activeSubscriptions,
      },
      revenue,
    };
  }

  async getExecutionTrends(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const executions = await this.prisma.execution.groupBy({
      by: ['status'],
      where: { createdAt: { gte: startDate } },
      _count: true,
    });

    // Daily counts for chart
    const dailyCounts = await this.prisma.$queryRaw<
      Array<{ date: string; count: bigint }>
    >`
      SELECT DATE("createdAt") as date, COUNT(*) as count
      FROM "Execution"
      WHERE "createdAt" >= ${startDate}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    return {
      byStatus: executions.map((e) => ({
        status: e.status,
        count: e._count,
      })),
      daily: dailyCounts.map((d) => ({
        date: d.date,
        count: Number(d.count),
      })),
    };
  }

  async getTopTemplates(limit: number = 10) {
    return this.prisma.template.findMany({
      select: {
        id: true,
        name: true,
        icon: true,
        isPremium: true,
        usageCount: true,
        _count: { select: { executions: true } },
      },
      orderBy: { usageCount: 'desc' },
      take: limit,
    });
  }

  async getUserDistribution() {
    const byPlan = await this.prisma.$queryRaw<
      Array<{ plan_name: string; count: bigint }>
    >`
      SELECT p.name as plan_name, COUNT(s.id) as count
      FROM "Plan" p
      LEFT JOIN "Subscription" s ON s."planId" = p.id AND s.status = 'ACTIVE'
      GROUP BY p.name, p."sortOrder"
      ORDER BY p."sortOrder" ASC
    `;

    const byRole = await this.prisma.user.groupBy({
      by: ['systemRole'],
      _count: true,
    });

    return {
      byPlan: byPlan.map((p) => ({ plan: p.plan_name, count: Number(p.count) })),
      byRole: byRole.map((r) => ({ role: r.systemRole, count: r._count })),
    };
  }

  // ═══════════════════════════════════
  // System Health (Enhanced)
  // ═══════════════════════════════════

  async systemHealth() {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkN8n(),
    ]);

    const dbOk = checks[0].status === 'fulfilled' && checks[0].value;
    const redisOk = checks[1].status === 'fulfilled' && checks[1].value;
    const n8nOk = checks[2].status === 'fulfilled' && checks[2].value;

    const allHealthy = dbOk && redisOk && n8nOk;

    const [userCount, templateCount, executionCount] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.template.count(),
      this.prisma.execution.count(),
    ]);

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      services: {
        api: { status: 'up', pid: process.pid, nodeVersion: process.version },
        database: { status: dbOk ? 'up' : 'down' },
        redis: { status: redisOk ? 'up' : 'down' },
        n8n: { status: n8nOk ? 'up' : 'down' },
      },
      stats: { userCount, templateCount, executionCount },
      timestamp: new Date().toISOString(),
    };
  }

  // ═══ Audit Log ═══

  async getAuditLogs(query?: { page?: number; limit?: number }) {
    const page = query?.page || 1;
    const limit = query?.limit || 50;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count(),
    ]);

    return { logs, total, page, limit };
  }

  // ═══ Private Helpers ═══

  private async getMonthlyRevenue() {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const activeSubs = await this.prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      include: { plan: { select: { price: true, currency: true } } },
    });

    const totalMRR = activeSubs.reduce((sum, s) => sum + (s.plan?.price || 0), 0);

    return {
      mrr: totalMRR,
      currency: 'VND',
      activeSubscribers: activeSubs.length,
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  private async checkN8n(): Promise<boolean> {
    try {
      return await this.n8nClient.healthCheck();
    } catch {
      return false;
    }
  }
}
