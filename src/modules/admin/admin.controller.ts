import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth,
  ApiResponse, ApiParam, ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/admin-template.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  // ═══ Templates ═══

  @Post('templates')
  @ApiOperation({
    summary: '[Admin] Create template',
    description: 'Tạo template mới trên marketplace. Yêu cầu role ADMIN hoặc SUPER_ADMIN. Template sẽ được map với n8n workflow ID.',
  })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error — missing required fields' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  createTemplate(@Body() dto: CreateTemplateDto) {
    return this.adminService.createTemplate(dto);
  }

  @Put('templates/:id')
  @ApiOperation({
    summary: '[Admin] Update template',
    description: 'Cập nhật template. Chỉ gửi các field cần thay đổi.',
  })
  @ApiParam({ name: 'id', description: 'Template ID (UUID)', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: 200, description: 'Template updated' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  updateTemplate(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.adminService.updateTemplate(id, dto);
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: '[Admin] Delete template' })
  @ApiParam({ name: 'id', description: 'Template ID (UUID)' })
  @ApiResponse({ status: 200, description: '{ deleted: true }' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  deleteTemplate(@Param('id') id: string) {
    return this.adminService.deleteTemplate(id);
  }

  // ═══ Users ═══

  @Get('users')
  @ApiOperation({
    summary: '[Admin] List users with execution counts',
    description: 'Danh sách users phân trang, hỗ trợ tìm kiếm theo email hoặc tên.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Tìm theo email hoặc tên' })
  @ApiResponse({ status: 200, description: '{ users: [...], total, page, limit, totalPages }' })
  getUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.adminService.getUsers({ page, limit, search });
  }

  // ═══ Analytics ═══

  @Get('analytics')
  @ApiOperation({
    summary: '[Admin] Dashboard analytics overview',
    description: 'Tổng quan: total users, new this month, growth %, executions, MRR, success rate.',
  })
  @ApiResponse({ status: 200, description: '{ overview: { totalUsers, newUsersThisMonth, userGrowth, ... }, revenue: { mrr, currency, activeSubscribers } }' })
  getAnalytics() {
    return this.adminService.getAnalytics();
  }

  @Get('analytics/execution-trends')
  @ApiOperation({
    summary: '[Admin] Execution trend data (for charts)',
    description: 'Dữ liệu daily execution counts để vẽ chart. Mặc định 30 ngày.',
  })
  @ApiQuery({ name: 'days', required: false, type: Number, example: 30, description: 'Số ngày lấy dữ liệu (default: 30)' })
  @ApiResponse({ status: 200, description: '{ byStatus: [{ status, count }], daily: [{ date, count }] }' })
  getExecutionTrends(@Query('days') days?: number) {
    return this.adminService.getExecutionTrends(days || 30);
  }

  @Get('analytics/top-templates')
  @ApiOperation({
    summary: '[Admin] Top templates by usage',
    description: 'Templates phổ biến nhất sắp xếp theo usageCount.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10, description: 'Số lượng kết quả (default: 10)' })
  @ApiResponse({ status: 200, description: '[{ id, name, icon, isPremium, usageCount, _count }]' })
  getTopTemplates(@Query('limit') limit?: number) {
    return this.adminService.getTopTemplates(limit || 10);
  }

  @Get('analytics/user-distribution')
  @ApiOperation({
    summary: '[Admin] User distribution by plan and role',
    description: 'Phân bố users theo plan (Free/Pro/Business) và role (USER/ADMIN).',
  })
  @ApiResponse({ status: 200, description: '{ byPlan: [{ plan, count }], byRole: [{ role, count }] }' })
  getUserDistribution() {
    return this.adminService.getUserDistribution();
  }

  // ═══ Audit Logs ═══

  @Get('audit-logs')
  @ApiOperation({
    summary: '[Admin] View audit logs',
    description: 'Lịch sử hành động admin: tạo/sửa/xóa template, thay đổi plan, payment events.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiResponse({ status: 200, description: '{ logs: [...], total, page, limit }' })
  getAuditLogs(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.getAuditLogs({ page, limit });
  }

  // ═══ System ═══

  @Get('system/health')
  @ApiOperation({
    summary: '[Admin] Detailed system health check',
    description: 'Trạng thái chi tiết: API, PostgreSQL, Redis, n8n. Memory usage, uptime.',
  })
  @ApiResponse({ status: 200, description: '{ status, uptime, memoryUsage, services: { api, database, redis, n8n }, stats }' })
  systemHealth() {
    return this.adminService.systemHealth();
  }
}
