import { IsString, IsNotEmpty, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCredentialDto {
  @ApiProperty({ example: 'My Telegram Bot' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    example: 'telegram',
    description: 'Credential type: telegram, openai, shopee, google, etc.',
  })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty({
    example: { botToken: '123456:ABC-DEF' },
    description: 'Credential data (will be encrypted at rest)',
  })
  @IsObject()
  data!: Record<string, unknown>;
}

export class UpdateCredentialDto {
  @ApiProperty({
    example: { botToken: 'new-token-value' },
    description: 'Updated credential data (will replace existing)',
  })
  @IsObject()
  data!: Record<string, unknown>;
}
