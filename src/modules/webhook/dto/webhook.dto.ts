import { IsString, IsOptional, IsObject, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExecutionFinishedDto {
  @ApiProperty({ example: '12345', description: 'n8n Execution ID' })
  @IsString()
  executionId!: string;

  @ApiPropertyOptional({ example: 'tpl-telegram-autopost', description: 'n8n Workflow ID' })
  @IsOptional()
  @IsString()
  workflowId?: string | null;

  @ApiProperty({ example: 'Telegram Auto Post', description: 'Tên workflow trong n8n' })
  @IsString()
  workflowName!: string;

  @ApiProperty({
    example: 'success',
    enum: ['success', 'error', 'crashed', 'waiting'],
    description: 'Kết quả execution từ n8n',
  })
  @IsString()
  status!: string;

  @ApiProperty({ example: 'webhook', description: 'Chế độ chạy (webhook, trigger, manual)' })
  @IsString()
  mode!: string;

  @ApiPropertyOptional({ example: '2026-06-01T12:00:00Z', description: 'Thời điểm bắt đầu' })
  @IsOptional()
  @IsString()
  startedAt?: string;

  @ApiPropertyOptional({ example: '2026-06-01T12:00:05Z', description: 'Thời điểm kết thúc' })
  @IsOptional()
  @IsString()
  stoppedAt?: string;

  @ApiPropertyOptional({ example: 'Timeout after 60s', description: 'Thông báo lỗi (nếu có)' })
  @IsOptional()
  @IsString()
  errorMessage?: string | null;

  @ApiProperty({ example: 5, description: 'Số nodes trong workflow' })
  @IsNumber()
  nodeCount!: number;

  @ApiPropertyOptional({ description: 'Output data từ n8n workflow' })
  @IsOptional()
  @IsObject()
  outputData?: Record<string, unknown> | null;
}

class NodeEventPayloadData {
  @ApiProperty({ example: '12345', description: 'n8n Execution ID liên quan' })
  @IsString()
  executionId!: string;

  @ApiProperty({ example: 'Send Telegram Message', description: 'Tên node trong workflow' })
  @IsString()
  nodeName!: string;

  @ApiProperty({ example: 'n8n-nodes-base.telegram', description: 'Loại node' })
  @IsString()
  nodeType!: string;

  @ApiProperty({ example: 'tpl-telegram-autopost', description: 'Workflow ID' })
  @IsString()
  workflowId!: string;

  @ApiProperty({ example: '2026-06-01T12:00:01Z', description: 'Timestamp event' })
  @IsString()
  timestamp!: string;
}

export class NodeEventDto {
  @ApiProperty({
    example: 'n8n.node.started',
    enum: ['n8n.node.started', 'n8n.node.finished'],
    description: 'Tên event từ n8n Log Streaming',
  })
  @IsString()
  eventName!: string;

  @ApiProperty({ type: NodeEventPayloadData, description: 'Dữ liệu chi tiết node event' })
  @IsObject()
  payload!: NodeEventPayloadData;
}
