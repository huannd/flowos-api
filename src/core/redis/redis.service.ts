import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private subscriber: Redis;

  constructor(private configService: ConfigService) {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') ||
      'redis://localhost:6379';

    this.client = new Redis(redisUrl, { lazyConnect: true });
    this.subscriber = new Redis(redisUrl, { lazyConnect: true });
  }

  async onModuleInit() {
    await this.client.connect();
    await this.subscriber.connect();
    this.logger.log('✅ Redis connected (client + subscriber)');
  }

  async onModuleDestroy() {
    await this.client.quit();
    await this.subscriber.quit();
  }

  /** Get the main Redis client for commands */
  getClient(): Redis {
    return this.client;
  }

  /** Get the subscriber Redis client for Pub/Sub */
  getSubscriber(): Redis {
    return this.subscriber;
  }

  // === Cache helpers ===

  async cacheGet<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async cacheDel(key: string): Promise<void> {
    await this.client.del(key);
  }

  // === Pub/Sub helpers ===

  async publish(channel: string, data: unknown): Promise<void> {
    await this.client.publish(channel, JSON.stringify(data));
  }

  async subscribe(
    channel: string,
    callback: (data: unknown) => void,
  ): Promise<void> {
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        try {
          callback(JSON.parse(message));
        } catch {
          callback(message);
        }
      }
    });
  }

  async unsubscribe(channel: string): Promise<void> {
    await this.subscriber.unsubscribe(channel);
  }

  // === Rate Limiting (sliding window) ===

  async checkRateLimit(
    key: string,
    maxRequests: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number }> {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    const pipeline = this.client.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zadd(key, now.toString(), `${now}-${Math.random()}`);
    pipeline.zcard(key);
    pipeline.expire(key, windowSeconds);

    const results = await pipeline.exec();
    const currentCount = (results?.[2]?.[1] as number) || 0;

    return {
      allowed: currentCount <= maxRequests,
      remaining: Math.max(0, maxRequests - currentCount),
    };
  }

  // === Quota counter (atomic increment) ===

  async incrementQuota(userId: string, month: string): Promise<number> {
    const key = `flowos:quota:${userId}:${month}`;
    const count = await this.client.incr(key);
    // Set TTL to 35 days on first increment
    if (count === 1) {
      await this.client.expire(key, 35 * 24 * 60 * 60);
    }
    return count;
  }

  async getQuota(userId: string, month: string): Promise<number> {
    const key = `flowos:quota:${userId}:${month}`;
    const count = await this.client.get(key);
    return count ? parseInt(count, 10) : 0;
  }

  async setQuota(userId: string, month: string, value: number): Promise<void> {
    const key = `flowos:quota:${userId}:${month}`;
    await this.client.set(key, value.toString(), 'EX', 35 * 24 * 60 * 60);
  }

  /** Health check — returns 'PONG' */
  async ping(): Promise<string> {
    return this.client.ping();
  }
}

