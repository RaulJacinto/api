import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;

  onModuleInit() {
    this.client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  get raw(): Redis {
    return this.client;
  }

  async saveRefreshToken(userId: string, jti: string, ttlSeconds: number) {
    await this.client.set(`refresh:${userId}:${jti}`, "1", "EX", ttlSeconds);
  }

  async isRefreshTokenValid(userId: string, jti: string): Promise<boolean> {
    const v = await this.client.get(`refresh:${userId}:${jti}`);
    return v === "1";
  }

  async revokeRefreshToken(userId: string, jti: string) {
    await this.client.del(`refresh:${userId}:${jti}`);
  }

  async revokeAllRefreshTokens(userId: string) {
    const keys = await this.client.keys(`refresh:${userId}:*`);
    if (keys.length) await this.client.del(...keys);
  }
}
