import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Nguyễn Văn A', description: 'Họ và tên' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg', description: 'URL avatar' })
  @IsOptional()
  @IsString()
  avatar?: string;
}
