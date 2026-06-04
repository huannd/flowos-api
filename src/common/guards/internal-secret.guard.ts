import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

/**
 * Guard for internal endpoints (n8n → FlowOS API).
 * Validates X-Webhook-Secret header using timing-safe comparison.
 */
@Injectable()
export class InternalSecretGuard implements CanActivate {
  private readonly secret: string;

  constructor(private configService: ConfigService) {
    this.secret =
      this.configService.get<string>('N8N_WEBHOOK_SECRET') || '';
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const headerSecret = request.headers['x-webhook-secret'] || '';

    if (!this.secret || !headerSecret) {
      throw new UnauthorizedException('Missing webhook secret');
    }

    const secretBuffer = Buffer.from(this.secret);
    const headerBuffer = Buffer.from(headerSecret);

    if (secretBuffer.length !== headerBuffer.length) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    if (!timingSafeEqual(secretBuffer, headerBuffer)) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    return true;
  }
}
