import { Controller, Post, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InternalSecretGuard } from '../../common/guards/internal-secret.guard';
import { WebhookService } from './webhook.service';
import { ExecutionFinishedDto, NodeEventDto } from './dto/webhook.dto';

@ApiTags('webhooks')
@UseGuards(InternalSecretGuard)
@Controller('webhooks/n8n')
export class WebhookController {
  constructor(private webhookService: WebhookService) {}

  @Post('execution-finished')
  @HttpCode(200)
  @ApiOperation({
    summary: '[Internal] n8n execution finished callback',
    description: 'Được gọi bởi n8n External Hook khi workflow execution hoàn thành (success/error). Xác thực bằng X-Webhook-Secret header.',
  })
  @ApiResponse({ status: 200, description: '{ received: true }' })
  @ApiResponse({ status: 401, description: 'Invalid webhook secret' })
  handleExecutionFinished(@Body() dto: ExecutionFinishedDto) {
    return this.webhookService.handleExecutionFinished(dto as any);
  }

  @Post('node-event')
  @HttpCode(200)
  @ApiOperation({
    summary: '[Internal] n8n node event (Log Streaming)',
    description: 'Realtime node-level events (started, completed, error) cho SSE streaming tới dashboard.',
  })
  @ApiResponse({ status: 200, description: '{ received: true }' })
  @ApiResponse({ status: 401, description: 'Invalid webhook secret' })
  handleNodeEvent(@Body() dto: NodeEventDto) {
    return this.webhookService.handleNodeEvent(dto);
  }

  @Post('ping')
  @HttpCode(200)
  @ApiOperation({ summary: '[Internal] Health check ping' })
  @ApiResponse({ status: 200, description: '{ status: "ok", timestamp: "..." }' })
  ping() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
