import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { RedisService } from '../../core/redis/redis.service';
import { N8nClientService } from '../../core/n8n/n8n-client.service';
import { QuotaService } from '../../core/quota/quota.service';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private n8nClient: N8nClientService,
    private quotaService: QuotaService,
  ) {}

  /**
   * Run a template automation for a user.
   *
   * Full flow:
   * 1. Rate limit check (5 requests/minute per user)
   * 2. Find & validate template
   * 3. Check template access (premium gate)
   * 4. Enforce execution quota
   * 5. Validate input against template's inputSchema (basic)
   * 6. Create Execution record (PENDING)
   * 7. Trigger n8n webhook (async)
   * 8. Update status → RUNNING
   * 9. Increment quota
   * 10. Publish SSE event
   * 11. Return executionId
   */
  async run(userId: string, templateId: string, inputData: Record<string, unknown>) {
    // 1. Rate limit (5 runs per minute per user)
    const rateLimitKey = `flowos:ratelimit:run:${userId}`;
    const rateCheck = await this.redis.checkRateLimit(rateLimitKey, 5, 60);
    if (!rateCheck.allowed) {
      throw new HttpException(
        {
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Bạn đang gửi yêu cầu quá nhanh. Vui lòng đợi một phút.',
          retryAfter: 60,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 2. Find template
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
      include: { category: true },
    });
    if (!template) {
      throw new NotFoundException('Template không tồn tại');
    }
    if (!template.isPublic) {
      throw new NotFoundException('Template không khả dụng');
    }

    // 3. Check premium access
    if (template.isPremium) {
      const hasAccess = await this.quotaService.checkTemplateAccess(
        userId,
        true,
        template.category?.slug,
      );
      if (!hasAccess) {
        throw new ForbiddenException({
          error: 'PREMIUM_REQUIRED',
          message: `Template "${template.name}" yêu cầu gói Premium. Vui lòng nâng cấp gói.`,
        });
      }
    }

    // 4. Enforce quota
    const quota = await this.quotaService.enforceQuota(userId);

    // 5. Validate required inputs
    this.validateInputs(template.inputSchema as any, inputData);

    // 6. Create execution record
    const execution = await this.prisma.execution.create({
      data: {
        userId,
        templateId,
        status: 'PENDING',
        inputData: inputData as any,
        startedAt: new Date(),
        metadata: {
          quotaSnapshot: {
            plan: quota.planName,
            used: quota.executionsUsed + 1,
            limit: quota.executionLimit,
          },
        } as any,
      },
    });

    // 7-10. Trigger n8n and update state (non-blocking)
    this.triggerAndTrack(execution.id, template, userId, inputData).catch((err) => {
      this.logger.error(`Fatal error in triggerAndTrack: exec=${execution.id}`, err);
    });

    return {
      executionId: execution.id,
      status: 'PENDING',
      templateName: template.name,
      templateIcon: template.icon,
      quota: {
        used: quota.executionsUsed + 1,
        limit: quota.executionLimit,
        remaining: quota.executionsRemaining - 1,
      },
    };
  }

  /**
   * Internal: Trigger n8n and track state changes.
   */
  private async triggerAndTrack(
    executionId: string,
    template: any,
    userId: string,
    inputData: Record<string, unknown>,
  ) {
    try {
      const webhookPath = template.webhookPath || template.n8nWorkflowId;
      const n8nPayload = {
        executionId,
        userId,
        templateId: template.id,
        templateName: template.name,
        inputs: inputData,
      };

      // Trigger n8n webhook
      const n8nResult = await this.n8nClient.triggerWebhook(webhookPath, n8nPayload);

      // Update status to RUNNING
      const updateData: any = { status: 'RUNNING' };

      // If n8n returns an executionId synchronously, store it
      if (n8nResult && typeof n8nResult === 'object') {
        const result = n8nResult as any;
        if (result.executionId) {
          updateData.n8nExecutionId = result.executionId.toString();
        }
      }

      await this.prisma.execution.update({
        where: { id: executionId },
        data: updateData,
      });

      // Increment quota (only after successful trigger)
      await this.quotaService.incrementUsage(userId);

      // Publish SSE event
      await this.redis.publish(`flowos:sse:exec:${executionId}`, {
        event: 'status',
        data: { status: 'RUNNING', executionId },
      });
      await this.redis.publish(`flowos:sse:user:${userId}`, {
        event: 'status',
        data: {
          executionId,
          status: 'RUNNING',
          templateId: template.id,
          templateName: template.name,
        },
      });

      this.logger.log(
        `🚀 Automation triggered: exec=${executionId} template="${template.name}" user=${userId}`,
      );
    } catch (error: any) {
      // Mark execution as ERROR
      await this.prisma.execution.update({
        where: { id: executionId },
        data: {
          status: 'ERROR',
          errorMessage: error.message || 'Failed to trigger automation engine',
          finishedAt: new Date(),
        },
      });

      // Publish error SSE
      await this.redis.publish(`flowos:sse:exec:${executionId}`, {
        event: 'error',
        data: {
          executionId,
          status: 'ERROR',
          errorMessage: error.message || 'Trigger failed',
        },
      });
      await this.redis.publish(`flowos:sse:user:${userId}`, {
        event: 'error',
        data: { executionId, status: 'ERROR' },
      });

      this.logger.error(`❌ Automation trigger failed: exec=${executionId}`, error);
    }
  }

  /**
   * Basic input validation against template's inputSchema.
   * Checks required fields are present.
   */
  private validateInputs(
    inputSchema: Record<string, unknown> | null,
    inputData: Record<string, unknown>,
  ): void {
    if (!inputSchema) return;

    // JSON Schema style validation (basic required fields check)
    const schema = inputSchema as any;
    if (schema.required && Array.isArray(schema.required)) {
      const missing = schema.required.filter(
        (field: string) =>
          inputData[field] === undefined || inputData[field] === null || inputData[field] === '',
      );
      if (missing.length > 0) {
        throw new BadRequestException({
          error: 'MISSING_REQUIRED_INPUTS',
          message: `Thiếu thông tin bắt buộc: ${missing.join(', ')}`,
          missingFields: missing,
        });
      }
    }

    // Type validation for properties
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties) as any[]) {
        const value = inputData[key];
        if (value === undefined || value === null) continue;

        if (propSchema.type === 'number' && typeof value !== 'number') {
          const num = Number(value);
          if (isNaN(num)) {
            throw new BadRequestException({
              error: 'INVALID_INPUT_TYPE',
              message: `Trường "${propSchema.title || key}" phải là số`,
              field: key,
            });
          }
        }

        if (propSchema.type === 'string' && typeof value !== 'string') {
          throw new BadRequestException({
            error: 'INVALID_INPUT_TYPE',
            message: `Trường "${propSchema.title || key}" phải là chuỗi`,
            field: key,
          });
        }

        // Enum validation
        if (propSchema.enum && !propSchema.enum.includes(value)) {
          throw new BadRequestException({
            error: 'INVALID_INPUT_VALUE',
            message: `Trường "${propSchema.title || key}" phải là một trong: ${propSchema.enum.join(', ')}`,
            field: key,
            allowedValues: propSchema.enum,
          });
        }
      }
    }
  }

  /**
   * Cancel a running/pending execution.
   */
  async cancel(userId: string, executionId: string) {
    const execution = await this.prisma.execution.findFirst({
      where: { id: executionId, userId },
    });
    if (!execution) {
      throw new NotFoundException('Execution không tồn tại');
    }
    if (!['PENDING', 'RUNNING'].includes(execution.status)) {
      throw new BadRequestException('Chỉ có thể hủy execution đang chạy');
    }

    await this.prisma.execution.update({
      where: { id: executionId },
      data: {
        status: 'CANCELED',
        errorMessage: 'Đã bị hủy bởi người dùng',
        finishedAt: new Date(),
      },
    });

    // Publish SSE
    await this.redis.publish(`flowos:sse:exec:${executionId}`, {
      event: 'canceled',
      data: { executionId, status: 'CANCELED' },
    });
    await this.redis.publish(`flowos:sse:user:${userId}`, {
      event: 'canceled',
      data: { executionId, status: 'CANCELED' },
    });

    return { executionId, status: 'CANCELED' };
  }

  /**
   * Retry a failed/timed-out execution.
   */
  async retry(userId: string, executionId: string) {
    const execution = await this.prisma.execution.findFirst({
      where: { id: executionId, userId },
      include: { template: true },
    });
    if (!execution) {
      throw new NotFoundException('Execution không tồn tại');
    }
    if (!['ERROR', 'TIMEOUT', 'CANCELED'].includes(execution.status)) {
      throw new BadRequestException('Chỉ có thể retry execution bị lỗi');
    }

    // Re-run with the same inputs
    return this.run(userId, execution.templateId, execution.inputData as Record<string, unknown>);
  }

  /**
   * Get execution history for a user (paginated + filtered).
   */
  async getHistory(userId: string, query?: { page?: number; limit?: number; status?: string }) {
    const page = query?.page || 1;
    const limit = Math.min(query?.limit || 20, 100);
    const where: any = { userId };
    if (query?.status) where.status = query.status;

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

    return { executions, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
