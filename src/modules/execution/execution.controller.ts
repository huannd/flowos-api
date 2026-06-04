import { Controller, Get, Param, Query, UseGuards, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ExecutionService } from './execution.service';

@ApiTags('executions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('executions')
export class ExecutionController {
  constructor(private executionService: ExecutionService) {}

  @Get()
  @ApiOperation({
    summary: 'List execution history with filters',
    description: 'Danh sách execution phân trang. Hỗ trợ filter theo status, templateId, khoảng thời gian.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Trang (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20, description: 'Số kết quả/trang (default: 20)' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'RUNNING', 'SUCCESS', 'ERROR', 'CANCELED', 'TIMEOUT'], description: 'Lọc theo trạng thái' })
  @ApiQuery({ name: 'templateId', required: false, type: String, description: 'Lọc theo template ID' })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'Từ ngày (ISO 8601: 2026-01-01)' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'Đến ngày (ISO 8601: 2026-12-31)' })
  @ApiResponse({ status: 200, description: '{ data: [...], total, page, limit, totalPages }' })
  findAll(
    @Req() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('templateId') templateId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.executionService.findAll(req.user.userId, {
      page,
      limit,
      status,
      templateId,
      from,
      to,
    });
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get execution statistics for dashboard',
    description: 'Thống kê tổng hợp: số lượng theo status (success, error, running, pending).',
  })
  @ApiResponse({ status: 200, description: '{ total, success, error, running, pending, canceled }' })
  getStats(@Req() req: any) {
    return this.executionService.getStats(req.user.userId);
  }

  @Get('stream/dashboard')
  @ApiOperation({
    summary: 'SSE stream — all execution updates for the current user',
    description: 'Server-Sent Events stream. Kết nối với EventSource. Nhận events: completed, error, status cho tất cả executions của user.\n\n**Ví dụ client:**\n```javascript\nconst es = new EventSource("/api/executions/stream/dashboard?token=JWT");\nes.onmessage = (e) => console.log(JSON.parse(e.data));\n```',
  })
  @ApiResponse({ status: 200, description: 'SSE stream (text/event-stream)' })
  streamDashboard(@Req() req: any, @Res() res: Response) {
    return this.executionService.streamDashboard(req.user.userId, res);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get execution detail',
    description: 'Chi tiết execution bao gồm: status, inputData, outputData, template info, timestamps.',
  })
  @ApiParam({ name: 'id', description: 'Execution ID (UUID)' })
  @ApiResponse({ status: 200, description: '{ id, status, inputData, outputData, template, createdAt, ... }' })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  findById(@Req() req: any, @Param('id') id: string) {
    return this.executionService.findById(id, req.user.userId);
  }

  @Get(':id/stream')
  @ApiOperation({
    summary: 'SSE stream — real-time status and node events for a single execution',
    description: 'SSE stream cho execution cụ thể. Events: initial_state, status, node_started, node_completed, completed, error, done.\n\n**Ví dụ client:**\n```javascript\nconst es = new EventSource("/api/executions/EXEC_ID/stream?token=JWT");\nes.addEventListener("node_started", (e) => console.log(JSON.parse(e.data)));\nes.addEventListener("completed", (e) => { console.log("Done!"); es.close(); });\n```',
  })
  @ApiParam({ name: 'id', description: 'Execution ID (UUID)' })
  @ApiResponse({ status: 200, description: 'SSE stream (text/event-stream)' })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  streamExecution(
    @Req() req: any,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    return this.executionService.streamExecution(id, req.user.userId, res);
  }
}
