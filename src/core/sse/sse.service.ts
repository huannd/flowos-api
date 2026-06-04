import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Response } from 'express';
import { RedisService } from '../../core/redis/redis.service';
import Redis from 'ioredis';

interface SseClient {
  id: string;
  res: Response;
  channel: string;
  connectedAt: Date;
}

/**
 * SSE (Server-Sent Events) Service
 *
 * Architecture: Redis Pub/Sub → SSE adapter
 * - Each SSE connection subscribes to a Redis channel
 * - Uses a dedicated Redis subscriber per channel (shared across clients)
 * - Heartbeat every 30s to keep connections alive
 * - Auto-cleanup on disconnect
 *
 * Channels:
 * - flowos:sse:exec:{executionId}  → single execution tracking
 * - flowos:sse:user:{userId}       → dashboard live updates
 */
@Injectable()
export class SseService implements OnModuleDestroy {
  private readonly logger = new Logger(SseService.name);
  private clients = new Map<string, SseClient>();
  private channelSubscribers = new Map<string, Redis>();
  private channelClientCount = new Map<string, number>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private redisUrl: string;

  constructor(private redisService: RedisService) {
    // Get Redis URL from the existing service's client
    const client = this.redisService.getClient();
    const options = client.options;
    if (options.password) {
      this.redisUrl = `redis://:${options.password}@${options.host || 'localhost'}:${options.port || 6379}`;
    } else {
      this.redisUrl = `redis://${options.host || 'localhost'}:${options.port || 6379}`;
    }

    // Start heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000);
  }

  onModuleDestroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    // Close all client connections
    for (const [clientId, client] of this.clients) {
      try {
        client.res.end();
      } catch {
        // Client already disconnected
      }
      this.clients.delete(clientId);
    }
    // Close all subscriber connections
    for (const [channel, subscriber] of this.channelSubscribers) {
      subscriber.quit().catch(() => {});
      this.channelSubscribers.delete(channel);
    }
  }

  /**
   * Register a new SSE client for a specific channel.
   */
  async addClient(
    clientId: string,
    res: Response,
    channel: string,
  ): Promise<void> {
    // Setup SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    });

    // Send initial connection event
    this.sendEvent(res, 'connected', {
      clientId,
      channel,
      timestamp: new Date().toISOString(),
    });

    // Register client
    const client: SseClient = {
      id: clientId,
      res,
      channel,
      connectedAt: new Date(),
    };
    this.clients.set(clientId, client);

    // Track channel client count
    const currentCount = this.channelClientCount.get(channel) || 0;
    this.channelClientCount.set(channel, currentCount + 1);

    // Subscribe to Redis channel if first client on this channel
    if (!this.channelSubscribers.has(channel)) {
      await this.subscribeToChannel(channel);
    }

    // Handle disconnect
    res.on('close', () => {
      this.removeClient(clientId, channel);
    });

    this.logger.log(
      `📡 SSE client connected: ${clientId} → ${channel} (total: ${this.clients.size})`,
    );
  }

  /**
   * Remove a client and clean up channel subscription if no more clients.
   */
  private removeClient(clientId: string, channel: string): void {
    this.clients.delete(clientId);

    const currentCount = (this.channelClientCount.get(channel) || 1) - 1;
    if (currentCount <= 0) {
      this.channelClientCount.delete(channel);
      // Unsubscribe from Redis channel
      const subscriber = this.channelSubscribers.get(channel);
      if (subscriber) {
        subscriber.unsubscribe(channel).catch(() => {});
        subscriber.quit().catch(() => {});
        this.channelSubscribers.delete(channel);
      }
    } else {
      this.channelClientCount.set(channel, currentCount);
    }

    this.logger.log(
      `📡 SSE client disconnected: ${clientId} (remaining: ${this.clients.size})`,
    );
  }

  /**
   * Subscribe to a Redis Pub/Sub channel and forward messages to SSE clients.
   */
  private async subscribeToChannel(channel: string): Promise<void> {
    const subscriber = new Redis(this.redisUrl, {
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });

    await subscriber.connect();
    await subscriber.subscribe(channel);

    subscriber.on('message', (ch, message) => {
      if (ch !== channel) return;

      try {
        const parsed = JSON.parse(message);
        const event = parsed.event || 'message';
        const data = parsed.data || parsed;

        // Broadcast to all clients on this channel
        for (const [, client] of this.clients) {
          if (client.channel === channel) {
            this.sendEvent(client.res, event, data);
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to parse SSE message on ${channel}: ${err}`);
      }
    });

    subscriber.on('error', (err) => {
      this.logger.error(`Redis subscriber error for ${channel}: ${err.message}`);
    });

    this.channelSubscribers.set(channel, subscriber);
    this.logger.log(`🔌 Subscribed to Redis channel: ${channel}`);
  }

  /**
   * Send an SSE event to a client response.
   */
  private sendEvent(res: Response, event: string, data: unknown): void {
    try {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      res.write(`event: ${event}\n`);
      res.write(`data: ${payload}\n\n`);
    } catch {
      // Client disconnected — will be cleaned up
    }
  }

  /**
   * Send heartbeat to all connected clients.
   */
  private sendHeartbeat(): void {
    const now = new Date().toISOString();
    for (const [, client] of this.clients) {
      try {
        client.res.write(`: heartbeat ${now}\n\n`);
      } catch {
        // Will be cleaned up by 'close' handler
      }
    }
  }

  /**
   * Get stats about SSE connections.
   */
  getStats(): {
    totalClients: number;
    channels: { channel: string; clients: number }[];
  } {
    const channels: { channel: string; clients: number }[] = [];
    for (const [channel, count] of this.channelClientCount) {
      channels.push({ channel, clients: count });
    }
    return {
      totalClients: this.clients.size,
      channels,
    };
  }
}
