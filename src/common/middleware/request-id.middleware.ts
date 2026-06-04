import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';

/**
 * Attaches a unique X-Request-Id to every incoming request.
 * If the client sends one, it's reused; otherwise a new UUID is generated.
 * The ID is also set on the response header for traceability.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const requestId =
      req.headers['x-request-id'] || `req_${randomUUID().replace(/-/g, '')}`;
    req.headers['x-request-id'] = requestId;
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  }
}
