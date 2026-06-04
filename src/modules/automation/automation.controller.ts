import { Controller, Post, Get, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AutomationService } from './automation.service';
import { RunAutomationDto } from './dto/run-automation.dto';

@ApiTags('automations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('automations')
export class AutomationController {
  constructor(private automationService: AutomationService) {}

  @Post('run')
  @ApiOperation({
    summary: 'Run a template automation',
    description: 'Chạy workflow automation từ template. Rate limited: 5 lần/phút/user. Kiểm tra quota trước khi chạy.',
  })
  @ApiResponse({ status: 201, description: '{ execution: { id, status: "PENDING", ... }, message }' })
  @ApiResponse({ status: 400, description: 'Invalid input data (không khớp inputSchema)' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded (5/min) hoặc quota hết' })
  run(@Req() req: any, @Body() dto: RunAutomationDto) {
    return this.automationService.run(req.user.userId, dto.templateId, dto.inputs);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancel a running/pending execution',
    description: 'Hủy execution đang chạy hoặc pending. Chỉ owner mới có quyền hủy.',
  })
  @ApiParam({ name: 'id', description: 'Execution ID (UUID)' })
  @ApiResponse({ status: 200, description: '{ message: "Execution canceled" }' })
  @ApiResponse({ status: 400, description: 'Execution already completed or already canceled' })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  cancel(@Req() req: any, @Param('id') id: string) {
    return this.automationService.cancel(req.user.userId, id);
  }

  @Post(':id/retry')
  @ApiOperation({
    summary: 'Retry a failed/timed-out execution',
    description: 'Retry execution bị lỗi hoặc timeout. Tạo execution mới với cùng input data.',
  })
  @ApiParam({ name: 'id', description: 'Execution ID (UUID) cần retry' })
  @ApiResponse({ status: 201, description: '{ execution: { id, status: "PENDING" } }' })
  @ApiResponse({ status: 400, description: 'Execution chưa bị lỗi, không thể retry' })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  retry(@Req() req: any, @Param('id') id: string) {
    return this.automationService.retry(req.user.userId, id);
  }

  @Get('history')
  @ApiOperation({
    summary: 'Get execution history (alias for GET /executions)',
    description: 'Danh sách lịch sử execution phân trang.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'RUNNING', 'SUCCESS', 'ERROR', 'CANCELED', 'TIMEOUT'] })
  @ApiResponse({ status: 200, description: '{ data: [...], total, page, limit, totalPages }' })
  getHistory(
    @Req() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.automationService.getHistory(req.user.userId, { page, limit, status });
  }
}
