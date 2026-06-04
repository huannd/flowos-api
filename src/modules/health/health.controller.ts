import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../../core/database/prisma.service';
import { RedisService } from '../../core/redis/redis.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /**
   * Liveness probe — just confirms the API process is running.
   * Used by load balancers and k8s liveness checks.
   */
  @Get('live')
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Xác nhận API process đang chạy. Dùng cho k8s livenessProbe và load balancer health check.',
  })
  @ApiResponse({ status: 200, description: '{ status: "ok", timestamp: "..." }' })
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness probe — confirms the API can serve traffic
   * (DB and Redis are reachable).
   */
  @Get('ready')
  @ApiOperation({
    summary: 'Readiness probe (checks DB + Redis)',
    description: 'Kiểm tra DB và Redis có accessible không. Dùng cho k8s readinessProbe.',
  })
  @ApiResponse({ status: 200, description: '{ status: "ready"|"not_ready", checks: { database, redis }, uptime }' })
  async readiness() {
    const checks: Record<string, boolean> = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch {
      checks.database = false;
    }

    try {
      await this.redis.ping();
      checks.redis = true;
    } catch {
      checks.redis = false;
    }

    const allReady = Object.values(checks).every((v) => v);

    return {
      status: allReady ? 'ready' : 'not_ready',
      checks,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Detailed health — full metrics for monitoring dashboards.
   */
  @Get()
  @ApiOperation({
    summary: 'Detailed health check with system metrics',
    description: 'Trạng thái chi tiết: version, memory, CPU, DB latency, Redis latency. Dùng cho monitoring dashboard.',
  })
  @ApiResponse({
    status: 200,
    description: '{ status: "healthy"|"degraded", version, nodeVersion, uptime, memory, cpu, checks: { database: { status, latencyMs }, redis: { status, latencyMs } } }',
  })
  async health() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const checks: Record<string, { status: string; latencyMs?: number }> = {};

    // Database check
    const dbStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'up', latencyMs: Date.now() - dbStart };
    } catch {
      checks.database = { status: 'down', latencyMs: Date.now() - dbStart };
    }

    // Redis check
    const redisStart = Date.now();
    try {
      await this.redis.ping();
      checks.redis = { status: 'up', latencyMs: Date.now() - redisStart };
    } catch {
      checks.redis = { status: 'down', latencyMs: Date.now() - redisStart };
    }

    const allUp = Object.values(checks).every((c) => c.status === 'up');

    return {
      status: allUp ? 'healthy' : 'degraded',
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      uptime: Math.floor(process.uptime()),
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      },
      cpu: {
        user: `${Math.round(cpuUsage.user / 1000)}ms`,
        system: `${Math.round(cpuUsage.system / 1000)}ms`,
      },
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
