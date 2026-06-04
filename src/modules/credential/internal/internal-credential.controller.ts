import { Controller, Get, Query, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InternalSecretGuard } from '../../../common/guards/internal-secret.guard';
import { CredentialService } from '../credential.service';

/**
 * Internal Credential API — for n8n workers to fetch decrypted credentials.
 *
 * Protected by InternalSecretGuard (X-Webhook-Secret header, timing-safe).
 * This endpoint is NOT exposed to end users.
 *
 * Flow:
 * 1. n8n workflow node needs user's credential (e.g., Telegram bot token)
 * 2. Workflow has an HTTP Request node that calls this API
 * 3. API decrypts the credential from DB and returns it
 * 4. n8n uses the credential for the automation step
 *
 * Security:
 * - X-Webhook-Secret header validation
 * - Credentials are never stored in n8n's internal credential store
 * - Each request is logged for audit
 */
@ApiTags('webhooks')
@UseGuards(InternalSecretGuard)
@Controller('internal/credentials')
export class InternalCredentialController {
  constructor(private credentialService: CredentialService) {}

  @Get('fetch')
  @HttpCode(200)
  @ApiOperation({
    summary: '[Internal] Fetch decrypted credential for n8n worker',
    description: 'Protected by X-Webhook-Secret. Returns decrypted credential data.',
  })
  @ApiQuery({ name: 'userId', required: true, description: 'User ID' })
  @ApiQuery({ name: 'type', required: true, description: 'Credential type (e.g., telegram, openai)' })
  @ApiQuery({ name: 'name', required: false, description: 'Credential name (optional, for users with multiple of same type)' })
  async fetchCredential(
    @Query('userId') userId: string,
    @Query('type') type: string,
    @Query('name') name?: string,
  ) {
    const data = await this.credentialService.decryptForWorker(userId, type, name);

    if (!data) {
      return {
        found: false,
        message: `No credential found for type "${type}"`,
      };
    }

    return {
      found: true,
      type,
      data,
    };
  }

  @Get('check')
  @HttpCode(200)
  @ApiOperation({
    summary: '[Internal] Check if user has a specific credential type',
  })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'type', required: true })
  async checkCredential(
    @Query('userId') userId: string,
    @Query('type') type: string,
  ) {
    const exists = await this.credentialService.hasCredential(userId, type);
    return { exists, type };
  }
}
