import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiResponse } from '@nestjs/swagger';
import { TemplateService } from './template.service';

@ApiTags('templates')
@Controller('templates')
export class TemplateController {
  constructor(private templateService: TemplateService) {}

  @Get()
  @ApiOperation({
    summary: 'List public templates (marketplace)',
    description: 'Danh sách templates công khai. Hỗ trợ filter theo category, search tên/mô tả, phân trang.',
  })
  @ApiQuery({ name: 'categoryId', required: false, type: String, description: 'Lọc theo category ID' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Tìm kiếm theo tên hoặc mô tả' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: '{ data: [{ id, name, description, icon, category, isPremium, ... }], total, page, totalPages }' })
  findAll(
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.templateService.findAll({ categoryId, search, page, limit });
  }

  @Get('categories')
  @ApiOperation({
    summary: 'List template categories',
    description: 'Danh sách categories với số lượng templates mỗi category.',
  })
  @ApiResponse({ status: 200, description: '[{ id, name, icon, slug, templateCount }]' })
  findCategories() {
    return this.templateService.findCategories();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get template detail with inputSchema',
    description: 'Chi tiết template bao gồm inputSchema (JSON Schema) để render DynamicForm trên frontend.',
  })
  @ApiParam({ name: 'id', description: 'Template ID (UUID)' })
  @ApiResponse({ status: 200, description: '{ id, name, description, inputSchema, outputSchema, category, tags, ... }' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  findById(@Param('id') id: string) {
    return this.templateService.findById(id);
  }
}
