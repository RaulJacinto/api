import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { DB } from "../db/db.module";
import type { DrizzleDb } from "../db/db.module";
import { users, schools, roles as rolesTable, userRoles } from "../db/schema";
import { RedisService } from "../redis/redis.service";
import type { JwtPayload } from "./strategies/jwt.strategy";
import type { LoginDto } from "./dto/login.dto";
import type { RegisterSchoolAdminDto } from "./dto/register.dto";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    schoolId: string | null;
    roles: string[];
  };
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: DrizzleDb,
    private readonly jwt: JwtService,
    private readonly redis: RedisService
  ) {}

  private get accessTtlSec(): number {
    return parseDurationSeconds(process.env.JWT_ACCESS_TTL ?? "15m");
  }
  private get refreshTtlSec(): number {
    return parseDurationSeconds(process.env.JWT_REFRESH_TTL ?? "7d");
  }

  private async loadUserRoles(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ name: rolesTable.name })
      .from(userRoles)
      .innerJoin(rolesTable, eq(userRoles.roleId, rolesTable.id))
      .where(eq(userRoles.userId, userId));
    return rows.map((r) => r.name);
  }

  private async issueTokens(
    payload: Omit<JwtPayload, "type" | "jti">
  ): Promise<AuthTokens> {
    const jti = randomUUID();

    const accessPayload: JwtPayload = { ...payload, type: "access" };
    const refreshPayload: JwtPayload = { ...payload, type: "refresh", jti };

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: process.env.JWT_ACCESS_SECRET!,
      expiresIn: this.accessTtlSec,
    });

    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: process.env.JWT_REFRESH_SECRET!,
      expiresIn: this.refreshTtlSec,
    });

    await this.redis.saveRefreshToken(payload.sub, jti, this.refreshTtlSec);

    const [u] = await this.db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        schoolId: users.schoolId,
      })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    return {
      accessToken,
      refreshToken,
      user: {
        id: payload.sub,
        email: payload.email,
        displayName: u?.displayName ?? "",
        schoolId: payload.schoolId,
        roles: payload.roles,
      },
    };
  }

  async registerSchoolAdmin(dto: RegisterSchoolAdminDto): Promise<AuthTokens> {
    const existing = await this.db
      .select({ id: users.id })
      .from(users)
      .innerJoin(schools, eq(users.schoolId, schools.id))
      .where(and(eq(users.email, dto.email), eq(schools.slug, dto.schoolSlug)))
      .limit(1);

    if (existing.length) {
      throw new ConflictException("Ya existe un usuario con ese email en esa escuela");
    }

    const passwordHash = await argon2.hash(dto.password);

    return await this.db.transaction(async (tx) => {
      const [school] = await tx
        .insert(schools)
        .values({
          coreSchoolId: `local-${dto.schoolSlug}`,
          name: dto.schoolName,
          slug: dto.schoolSlug,
          timezone: dto.timezone ?? "America/Mexico_City",
        })
        .returning();

      const [user] = await tx
        .insert(users)
        .values({
          schoolId: school.id,
          email: dto.email,
          passwordHash,
          displayName: dto.displayName,
        })
        .returning();

      const [adminRole] = await tx
        .select()
        .from(rolesTable)
        .where(eq(rolesTable.name, "school_admin"))
        .limit(1);

      if (!adminRole) throw new UnauthorizedException("Falta seed de roles");

      await tx.insert(userRoles).values({
        userId: user.id,
        roleId: adminRole.id,
        scopeSchoolId: school.id,
      });

      return this.issueTokens({
        sub: user.id,
        schoolId: school.id,
        email: user.email,
        roles: ["school_admin"],
      });
    });
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Credenciales inválidas");
    }
    if (!user.isActive) throw new UnauthorizedException("Usuario inactivo");

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException("Credenciales inválidas");

    const roles = await this.loadUserRoles(user.id);

    return this.issueTokens({
      sub: user.id,
      schoolId: user.schoolId,
      email: user.email,
      roles,
    });
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET!,
      });
    } catch {
      throw new UnauthorizedException("Refresh token inválido");
    }

    if (payload.type !== "refresh" || !payload.jti) {
      throw new UnauthorizedException("Refresh token inválido");
    }

    const valid = await this.redis.isRefreshTokenValid(payload.sub, payload.jti);
    if (!valid) throw new UnauthorizedException("Refresh token revocado");

    await this.redis.revokeRefreshToken(payload.sub, payload.jti);

    const roles = await this.loadUserRoles(payload.sub);

    return this.issueTokens({
      sub: payload.sub,
      schoolId: payload.schoolId,
      email: payload.email,
      roles,
    });
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      try {
        const p = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
          secret: process.env.JWT_REFRESH_SECRET!,
        });
        if (p.jti) await this.redis.revokeRefreshToken(userId, p.jti);
      } catch {
        await this.redis.revokeAllRefreshTokens(userId);
      }
    } else {
      await this.redis.revokeAllRefreshTokens(userId);
    }
    return { ok: true };
  }

  async me(userId: string) {
    const [user] = await this.db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        schoolId: users.schoolId,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw new UnauthorizedException();
    const roles = await this.loadUserRoles(userId);
    return { ...user, roles };
  }
}

function parseDurationSeconds(s: string): number {
  const m = /^(\d+)([smhd])?$/.exec(s);
  if (!m) return parseInt(s, 10) || 900;
  const n = parseInt(m[1], 10);
  const unit = m[2] ?? "s";
  const mult = { s: 1, m: 60, h: 3600, d: 86400 } as const;
  return n * mult[unit as keyof typeof mult];
}
