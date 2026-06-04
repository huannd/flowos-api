import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { RedisService } from '../../core/redis/redis.service';

interface ExecutionCallbackPayload {
  executionId: string;
  workflowId: string | null;
  workflowName: string;
  status: 'success' | 'error' | 'crashed' | 'waiting';
  mode: string;
  startedAt?: string;
  stoppedAt?: string;
  errorMessage?: string | null;
  nodeCount: number;
  outputData?: Record<string, unknown> | null;
}

interface NodeEventPayload {
  eventName: string; // "n8n.node.started" | "n8n.node.finished"
  payload: {
    executionId: string;
    nodeName: string;
    nodeType: string;
    workflowId: string;
    timestamp: string;
  };
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /**
   * Handle execution finished callback from n8n.
   */
  async handleExecutionFinished(payload: ExecutionCallbackPayload) {
    this.logger.log(
      `📡 Execution callback: exec=${payload.executionId} status=${payload.status}`,
    );

    // Find execution by n8nExecutionId OR our internal ID
    let execution = await this.prisma.execution.findUnique({
      where: { n8nExecutionId: payload.executionId },
    });

    // Try by our internal execution ID (we pass it as metadata in webhook trigger)
    if (!execution) {
      execution = await this.prisma.execution.findUnique({
        where: { id: payload.executionId },
      });
    }

    if (!execution) {
      this.logger.warn(`⚠️ No matching execution for ${payload.executionId}`);
      return { received: true, matched: false };
    }

    // Map n8n status to our ExecutionStatus enum
    const statusMap: Record<string, string> = {
      success: 'SUCCESS',
      error: 'ERROR',
      crashed: 'ERROR',
      waiting: 'RUNNING',
    };

    const finishedAt = payload.stoppedAt ? new Date(payload.stoppedAt) : new Date();
    const duration = execution.startedAt
      ? finishedAt.getTime() - new Date(execution.startedAt).getTime()
      : null;

    // Update execution in DB
    await this.prisma.execution.update({
      where: { id: execution.id },
      data: {
        status: (statusMap[payload.status] || 'ERROR') as any,
        n8nExecutionId: payload.executionId,
        finishedAt,
        duration,
        errorMessage: payload.errorMessage,
        outputData: payload.outputData as any,
      },
    });

    // Update template usage count
    await this.prisma.template.update({
      where: { id: execution.templateId },
      data: { usageCount: { increment: 1 } },
    });

    // Publish SSE event
    const sseEvent = payload.status === 'success' ? 'completed' : 'error';
    await this.redis.publish(`flowos:sse:exec:${execution.id}`, {
      event: sseEvent,
      data: {
        executionId: execution.id,
        status: statusMap[payload.status],
        duration,
        outputData: payload.outputData,
        errorMessage: payload.errorMessage,
        finishedAt,
      },
    });

    // Also publish to user dashboard channel
    await this.redis.publish(`flowos:sse:user:${execution.userId}`, {
      event: sseEvent,
      data: {
        executionId: execution.id,
        status: statusMap[payload.status],
        templateId: execution.templateId,
      },
    });

    this.logger.log(
      `✅ Execution updated: exec=${execution.id} status=${statusMap[payload.status]} duration=${duration}ms`,
    );

    return { received: true, matched: true };
  }

  /**
   * Handle node-level event from n8n Log Streaming.
   */
  async handleNodeEvent(payload: NodeEventPayload) {
    const { executionId, nodeName, nodeType } = payload.payload;
    const isStarted = payload.eventName === 'n8n.node.started';

    // Publish SSE event for live tracking
    await this.redis.publish(`flowos:sse:exec:${executionId}`, {
      event: isStarted ? 'node_started' : 'node_completed',
      data: {
        nodeName,
        nodeType,
        timestamp: payload.payload.timestamp,
      },
    });
  }
}
