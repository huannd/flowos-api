import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CredentialService } from './credential.service';
import { CreateCredentialDto, UpdateCredentialDto } from './dto/credential.dto';

@ApiTags('credentials')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('credentials')
export class CredentialController {
  constructor(private credentialService: CredentialService) {}

  @Get()
  @ApiOperation({
    summary: 'List credentials (masked — no encrypted data returned)',
    description: 'Danh sách credentials của user. Chỉ trả về metadata (name, type), không trả về data đã mã hóa.',
  })
  @ApiResponse({ status: 200, description: '[{ id, name, type, createdAt, updatedAt }]' })
  findAll(@Req() req: any) {
    return this.credentialService.findAll(req.user.userId);
  }

  @Get('types')
  @ApiOperation({
    summary: 'Get credential types the user has configured',
    description: 'Danh sách types đã được user cấu hình (e.g., "telegram", "openai", "google_sheets").',
  })
  @ApiResponse({ status: 200, description: '["telegram", "openai", ...]' })
  getConfiguredTypes(@Req() req: any) {
    return this.credentialService.getConfiguredTypes(req.user.userId);
  }

  @Post()
  @ApiOperation({
    summary: 'Add a new credential',
    description: 'Tạo credential mới. Data sẽ được mã hóa AES-256-GCM trước khi lưu vào database.',
  })
  @ApiResponse({ status: 201, description: '{ id, name, type, createdAt }' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  create(@Req() req: any, @Body() dto: CreateCredentialDto) {
    return this.credentialService.create(
      req.user.userId,
      dto.name,
      dto.type,
      dto.data,
    );
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update credential data',
    description: 'Cập nhật data mã hóa cho credential hiện có. Chỉ owner mới được cập nhật.',
  })
  @ApiParam({ name: 'id', description: 'Credential ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Updated credential' })
  @ApiResponse({ status: 404, description: 'Credential not found' })
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCredentialDto,
  ) {
    return this.credentialService.update(req.user.userId, id, dto.data);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a credential',
    description: 'Xóa credential vĩnh viễn. Dữ liệu đã mã hóa sẽ bị xóa hoàn toàn.',
  })
  @ApiParam({ name: 'id', description: 'Credential ID (UUID)' })
  @ApiResponse({ status: 200, description: '{ deleted: true }' })
  @ApiResponse({ status: 404, description: 'Credential not found' })
  delete(@Req() req: any, @Param('id') id: string) {
    return this.credentialService.delete(req.user.userId, id);
  }
}
