import { Injectable, Inject, OnModuleDestroy, Logger } from '@nestjs/common';
import type Redis from 'ioredis';

/**
 * RedisService — wrapper reutilizável para operações Redis.
 *
 * Uso atual: Cart (JSON com TTL)
 * Extensível para: Cache de rotas, Sessions, Rate limiting counters,
 *                   Pub/Sub para invalidação de cache, Locks distribuídos
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async onModuleDestroy() {
    await this.redis.quit?.();
  }

  // ─── Key-Value ────────────────────────────────────────────

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redis.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.redis.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  // ─── JSON helpers ─────────────────────────────────────────

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async getJson<T = unknown>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  // ─── Hash ─────────────────────────────────────────────────

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.redis.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.redis.hget(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.redis.hgetall(key);
  }

  async hdel(key: string, field: string): Promise<void> {
    await this.redis.hdel(key, field);
  }

  // ─── Utility ──────────────────────────────────────────────

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.redis.expire(key, ttlSeconds);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.redis.keys(pattern);
  }

  async incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }

  async ttl(key: string): Promise<number> {
    return this.redis.ttl(key);
  }

  /**
   * Acesso direto ao client para operações avançadas
   * (pipelines, transactions, pub/sub, etc.)
   */
  getClient(): Redis {
    return this.redis;
  }
}
