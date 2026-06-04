import { IsString, IsObject, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RunAutomationDto {
  @ApiProperty({ description: 'Template ID to run' })
  @IsString()
  @IsNotEmpty()
  templateId!: string;

  @ApiProperty({
    description: 'Input data matching the template inputSchema',
    example: { target_channel: '@my_channel', message: 'Hello World' },
  })
  @IsObject()
  inputs!: Record<string, unknown>;
}
