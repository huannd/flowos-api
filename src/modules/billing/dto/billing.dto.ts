import { IsString, IsNumber, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpgradePlanDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID của plan muốn nâng cấp',
  })
  @IsString()
  planId!: string;
}

export class PaymentWebhookDto {
  @ApiProperty({ example: 'vnpay', description: 'Payment provider (vnpay, momo, stripe)' })
  @IsString()
  provider!: string;

  @ApiProperty({ example: 'ORD-2026-001', description: 'Mã đơn hàng từ payment provider' })
  @IsString()
  orderId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'User ID' })
  @IsString()
  userId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001', description: 'Plan ID được mua' })
  @IsString()
  planId!: string;

  @ApiProperty({ example: 299000, description: 'Số tiền (VND)' })
  @IsNumber()
  amount!: number;

  @ApiProperty({ example: 'success', enum: ['success', 'completed', 'failed', 'pending'], description: 'Trạng thái thanh toán' })
  @IsString()
  status!: string;

  @ApiProperty({ example: 'a1b2c3d4e5f6...', description: 'HMAC-SHA256 chữ ký xác thực' })
  @IsString()
  signature!: string;

  @ApiPropertyOptional({ description: 'Raw payload từ payment provider' })
  @IsOptional()
  @IsObject()
  rawPayload?: Record<string, unknown>;
}
