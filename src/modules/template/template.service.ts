import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { RedisService } from '../../core/redis/redis.service';

@Injectable()
export class TemplateService {
  private readonly CACHE_KEY = 'flowos:cache:templates';
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async findAll(query?: { categoryId?: string; search?: string; page?: number; limit?: number }) {
    // Try cache first
    const cacheKey = `${this.CACHE_KEY}:${JSON.stringify(query || {})}`;
    const cached = await this.redis.cacheGet(cacheKey);
    if (cached) return cached;

    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const where: any = { isPublic: true };

    if (query?.categoryId) where.categoryId = query.categoryId;
    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [templates, total] = await Promise.all([
      this.prisma.template.findMany({
        where,
        include: { category: true },
        orderBy: { sortOrder: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.template.count({ where }),
    ]);

    const result = { templates, total, page, limit };
    await this.redis.cacheSet(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  async findById(id: string) {
    return this.prisma.template.findUnique({
      where: { id },
      include: { category: true },
    });
  }

  async findCategories() {
    const cacheKey = `${this.CACHE_KEY}:categories`;
    const cached = await this.redis.cacheGet(cacheKey);
    if (cached) return cached;

    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { templates: true } } },
    });

    await this.redis.cacheSet(cacheKey, categories, this.CACHE_TTL);
    return categories;
  }

  async invalidateCache() {
    // Clear all template cache entries
    const client = this.redis.getClient();
    const keys = await client.keys(`${this.CACHE_KEY}:*`);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  }
}
