import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { RedisService } from '../../core/redis/redis.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // ═══ Plans ═══

  async getPlans() {
    return this.prisma.plan.findMany({
      where: { isPublic: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getPlanById(planId: string) {
    return this.prisma.plan.findUnique({ where: { id: planId } });
  }

  // ═══ Subscription ═══

  async getSubscription(userId: string) {
    return this.prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });
  }

  async getQuota(userId: string) {
    const month = new Date().toISOString().slice(0, 7);
    const subscription = await this.getSubscription(userId);
    const usage = await this.redis.getQuota(userId, month);

    return {
      plan: subscription?.plan?.name || 'Free',
      executionLimit: subscription?.plan?.executionLimit || 100,
      executionsUsed: usage,
      executionsRemaining: Math.max(
        0,
        (subscription?.plan?.executionLimit || 100) - usage,
      ),
      month,
    };
  }

  // ═══ Plan Upgrade / Downgrade ═══

  async changePlan(userId: string, newPlanId: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id: newPlanId },
    });
    if (!plan) throw new BadRequestException('Plan không tồn tại');
    if (!plan.isPublic) throw new ForbiddenException('Plan này không khả dụng');

    const existing = await this.getSubscription(userId);

    if (existing) {
      // Update existing subscription
      const updated = await this.prisma.subscription.update({
        where: { id: existing.id },
        data: {
          planId: newPlanId,
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: this.calculateEndDate(plan.interval),
        },
        include: { plan: true },
      });

      // Log the change
      await this.prisma.auditLog.create({
        data: {
          adminId: userId,
          action: 'PLAN_CHANGED',
          target: `user:${userId}`,
          details: {
            fromPlanId: existing.planId,
            toPlanId: newPlanId,
            planName: plan.name,
          } as any,
        },
      });

      this.logger.log(
        `User ${userId} changed plan: ${existing.plan?.name} → ${plan.name}`,
      );
      return updated;
    } else {
      // Create new subscription
      const sub = await this.prisma.subscription.create({
        data: {
          userId,
          planId: newPlanId,
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: this.calculateEndDate(plan.interval),
        },
        include: { plan: true },
      });

      this.logger.log(`User ${userId} subscribed to: ${plan.name}`);
      return sub;
    }
  }

  async cancelSubscription(userId: string) {
    const existing = await this.getSubscription(userId);
    if (!existing) throw new BadRequestException('Không có subscription');
    if (existing.status === 'CANCELED')
      throw new BadRequestException('Subscription đã hủy');

    const updated = await this.prisma.subscription.update({
      where: { id: existing.id },
      data: { status: 'CANCELED' },
      include: { plan: true },
    });

    this.logger.log(`User ${userId} canceled subscription`);
    return updated;
  }

  // ═══ Invoice / Usage ═══

  async getInvoices(userId: string) {
    const usageLogs = await this.prisma.usageLog.findMany({
      where: { userId },
      orderBy: { month: 'desc' },
      take: 12,
    });

    const subscription = await this.getSubscription(userId);
    const planPrice = subscription?.plan?.price || 0;

    return usageLogs.map((log) => ({
      id: log.id,
      month: log.month,
      plan: subscription?.plan?.name || 'Free',
      executions: log.execCount,
      amount: planPrice,
      currency: subscription?.plan?.currency || 'VND',
      status: 'paid',
    }));
  }

  async recordUsage(userId: string) {
    const month = new Date().toISOString().slice(0, 7);
    await this.prisma.usageLog.upsert({
      where: { userId_month: { userId, month } },
      update: { execCount: { increment: 1 } },
      create: { userId, month, execCount: 1 },
    });
  }

  // ═══ Payment Webhook Processing ═══

  async processPaymentWebhook(payload: {
    provider: string;
    orderId: string;
    userId: string;
    planId: string;
    amount: number;
    status: string;
    signature: string;
    rawPayload?: Record<string, unknown>;
  }) {
    this.logger.log(
      `Payment webhook: provider=${payload.provider} orderId=${payload.orderId} status=${payload.status}`,
    );

    // Verify signature based on provider
    if (!this.verifyPaymentSignature(payload)) {
      this.logger.warn(
        `Invalid payment signature for order: ${payload.orderId}`,
      );
      throw new ForbiddenException('Invalid payment signature');
    }

    if (payload.status === 'success' || payload.status === 'completed') {
      // Activate subscription
      await this.changePlan(payload.userId, payload.planId);

      // Record payment in audit
      await this.prisma.auditLog.create({
        data: {
          adminId: 'SYSTEM',
          action: 'PAYMENT_SUCCESS',
          target: `user:${payload.userId}`,
          details: {
            provider: payload.provider,
            orderId: payload.orderId,
            amount: payload.amount,
            planId: payload.planId,
          } as any,
        },
      });

      return { success: true, message: 'Subscription activated' };
    }

    // Payment failed
    await this.prisma.auditLog.create({
      data: {
        adminId: 'SYSTEM',
        action: 'PAYMENT_FAILED',
        target: `user:${payload.userId}`,
        details: {
          provider: payload.provider,
          orderId: payload.orderId,
          status: payload.status,
        } as any,
      },
    });

    return { success: false, message: 'Payment failed or pending' };
  }

  // ═══ Private Helpers ═══

  private calculateEndDate(interval: string): Date {
    const now = new Date();
    switch (interval) {
      case 'MONTH':
        return new Date(now.setMonth(now.getMonth() + 1));
      case 'QUARTER':
        return new Date(now.setMonth(now.getMonth() + 3));
      case 'YEAR':
        return new Date(now.setFullYear(now.getFullYear() + 1));
      case 'LIFETIME':
        return new Date('2099-12-31');
      default:
        return new Date(now.setMonth(now.getMonth() + 1));
    }
  }

  private verifyPaymentSignature(payload: {
    provider: string;
    signature: string;
    orderId: string;
    amount: number;
  }): boolean {
    // Pluggable signature verification per provider
    // In production: VNPay HMAC-SHA512, MoMo RSA, Stripe webhook secret
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        this.logger.error('PAYMENT_WEBHOOK_SECRET not configured in production — rejecting payment');
        return false;
      }
      this.logger.warn('⚠️  PAYMENT_WEBHOOK_SECRET not configured — skipping verification (dev only)');
      return true;
    }

    const crypto = require('crypto');
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${payload.orderId}:${payload.amount}`)
      .digest('hex');

    // Ensure lengths match before timing-safe comparison
    if (payload.signature.length !== expectedSig.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(payload.signature),
      Buffer.from(expectedSig),
    );
  }
}
