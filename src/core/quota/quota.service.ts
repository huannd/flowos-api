import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { RedisService } from '../../core/redis/redis.service';

export interface QuotaCheckResult {
  allowed: boolean;
  planName: string;
  executionLimit: number;
  executionsUsed: number;
  executionsRemaining: number;
  month: string;
}

/**
 * Quota Service — Enforce execution limits per user plan.
 *
 * Flow:
 * 1. Check Redis counter first (fast path)
 * 2. Compare against user's plan limit
 * 3. Throw ForbiddenException if over limit
 *
 * Counters are atomic (Redis INCR) and synced daily with DB.
 */
@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);

  // Default limits when no subscription exists
  private readonly FREE_TIER_LIMIT = 100;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /**
   * Check if user has quota remaining. Does NOT increment.
   */
  async checkQuota(userId: string): Promise<QuotaCheckResult> {
    const month = this.getCurrentMonth();
    const currentUsage = await this.redis.getQuota(userId, month);

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    const planName = subscription?.plan?.name || 'Free';
    const executionLimit =
      subscription?.plan?.executionLimit || this.FREE_TIER_LIMIT;

    return {
      allowed: currentUsage < executionLimit,
      planName,
      executionLimit,
      executionsUsed: currentUsage,
      executionsRemaining: Math.max(0, executionLimit - currentUsage),
      month,
    };
  }

  /**
   * Enforce quota — check and throw if exceeded.
   */
  async enforceQuota(userId: string): Promise<QuotaCheckResult> {
    const result = await this.checkQuota(userId);

    if (!result.allowed) {
      this.logger.warn(
        `🚫 Quota exceeded: user=${userId} plan=${result.planName} used=${result.executionsUsed}/${result.executionLimit}`,
      );
      throw new ForbiddenException({
        error: 'EXECUTION_QUOTA_EXCEEDED',
        message: `Bạn đã sử dụng hết ${result.executionLimit} lượt chạy trong tháng này (gói ${result.planName}). Vui lòng nâng cấp gói để tiếp tục.`,
        quota: result,
      });
    }

    return result;
  }

  /**
   * Increment quota after successful execution trigger.
   */
  async incrementUsage(userId: string): Promise<number> {
    const month = this.getCurrentMonth();
    return this.redis.incrementQuota(userId, month);
  }

  /**
   * Check if user has access to a premium template.
   */
  async checkTemplateAccess(
    userId: string,
    templateIsPremium: boolean,
    categorySlug?: string,
  ): Promise<boolean> {
    if (!templateIsPremium) return true;

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription || subscription.status !== 'ACTIVE') {
      return false;
    }

    // Check if plan grants access to this template's category
    const templateAccess = subscription.plan.templateAccess;
    if (!templateAccess || templateAccess.length === 0) {
      // Empty = all categories
      return true;
    }

    if (categorySlug) {
      return templateAccess.includes(categorySlug);
    }

    return true;
  }

  private getCurrentMonth(): string {
    return new Date().toISOString().slice(0, 7);
  }
}
