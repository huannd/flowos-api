import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../../core/redis/redis.service';

export const THROTTLE_KEY = 'flowos:throttle';

/**
 * Generic throttle guard. Apply to specific routes with @UseGuards(ThrottleGuard)
 * and set metadata via @SetMetadata('throttle', { limit: 10, window: 60 })
 *
 * Defaults: 30 req/min per IP for public, 60 req/min for authenticated.
 */
@Injectable()
export class ThrottleGuard implements CanActivate {
  constructor(
    private redis: RedisService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    // Get route-specific config or defaults
    const throttleConfig = this.reflector.get<{ limit: number; window: number }>(
      'throttle',
      context.getHandler(),
    );

    const limit = throttleConfig?.limit || (req.user ? 60 : 30);
    const window = throttleConfig?.window || 60; // seconds

    // Key: IP + route for unauthenticated, userId + route for authenticated
    const identifier = req.user?.userId || req.ip || 'anonymous';
    const route = `${req.method}:${req.route?.path || req.url}`;
    const key = `${THROTTLE_KEY}:${identifier}:${route}`;

    const result = await this.redis.checkRateLimit(key, limit, window);

    // Set rate limit headers
    const res = context.switchToHttp().getResponse();
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Window', `${window}s`);

    if (!result.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
