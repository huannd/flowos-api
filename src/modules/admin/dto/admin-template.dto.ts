import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  IsArray,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTemplateDto {
  @ApiProperty({ example: 'Telegram Channel Auto-Post', description: 'Tên template hiển thị' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'Tự động đăng bài lên kênh Telegram theo lịch', description: 'Mô tả ngắn' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Chi tiết mô tả template...', description: 'Mô tả dài (HTML/Markdown)' })
  @IsOptional()
  @IsString()
  longDescription?: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'ID danh mục' })
  @IsString()
  categoryId!: string;

  @ApiProperty({ example: 'tpl-telegram-autopost', description: 'n8n Workflow ID (unique)' })
  @IsString()
  n8nWorkflowId!: string;

  @ApiPropertyOptional({ example: 'flowos/telegram-autopost', description: 'Webhook path trên n8n' })
  @IsOptional()
  @IsString()
  webhookPath?: string;

  @ApiPropertyOptional({ example: '✈️', description: 'Emoji icon' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({
    description: 'JSON Schema mô tả form input',
    example: {
      type: 'object',
      required: ['message'],
      properties: {
        message: {
          type: 'string',
          title: 'Nội dung',
          'x-ui': { widget: 'textarea', rows: 5 },
        },
        channel: {
          type: 'string',
          title: 'Kênh',
          'x-ui': { widget: 'select', options: ['general', 'news'] },
        },
      },
    },
  })
  @IsObject()
  inputSchema!: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'JSON Schema mô tả output' })
  @IsOptional()
  @IsObject()
  outputSchema?: Record<string, unknown>;

  @ApiPropertyOptional({ example: ['telegram', 'social-media'], description: 'Tags tìm kiếm' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: false, description: 'Template chỉ dành cho gói trả phí' })
  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Hiển thị công khai trên marketplace' })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ example: 0, description: 'Thứ tự sắp xếp' })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateTemplateDto {
  @ApiPropertyOptional({ example: 'Telegram Auto-Post v2' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Mô tả mới...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  longDescription?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Cập nhật input schema' })
  @IsOptional()
  @IsObject()
  inputSchema?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  outputSchema?: Record<string, unknown>;

  @ApiPropertyOptional({ example: ['updated-tag'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ example: '✈️' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
