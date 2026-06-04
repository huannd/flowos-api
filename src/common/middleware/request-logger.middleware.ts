import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const { method, originalUrl } = req;
    const requestId = (req as any).requestId || req.headers['x-request-id'] || '-';

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Skip health check and SSE streams from excessive logging
      if (originalUrl.includes('/health') || originalUrl.includes('/stream')) {
        return;
      }

      // Structured log: [requestId] METHOD /path → STATUS (Xms)
      const logMessage = `[${requestId}] ${method} ${originalUrl} → ${statusCode} (${duration}ms)`;

      if (statusCode >= 500) {
        this.logger.error(logMessage);
      } else if (statusCode >= 400) {
        this.logger.warn(logMessage);
      } else {
        this.logger.log(logMessage);
      }
    });

    next();
  }
}
