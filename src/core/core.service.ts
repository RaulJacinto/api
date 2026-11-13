import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, gte } from "drizzle-orm";
import { DB } from "../db/db.module";
import type { DrizzleDb } from "../db/db.module";
import { auditLog, licenseState } from "../db/schema";
import type { HeartbeatDto } from "./dto/heartbeat.dto";
import type { AuditEventDto } from "./dto/audit-event.dto";

/**
 * Estado calculado on-read. Coincide con license_status enum reales:
 *   active | blocked | expired | grace_offline
 * - active:  validUntil futuro + heartbeat fresco (<48h) o dentro de gracia
 * - grace_offline: validUntil futuro, heartbeat viejo, offlineGraceUntil vigente
 * - expired: validUntil ya pasó, o gracia vencida sin heartbeat fresco
 * - blocked: bloqueo manual (máxima prioridad)
 */
export type ComputedLicenseStatus =
  | "active"
  | "grace_offline"
  | "expired"
  | "blocked";

@Injectable()
export class CoreService {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  // ---------- License ----------
  async getLicense(schoolId: string) {
    if (!schoolId) throw new ForbiddenException("Usuario sin escuela");

    const [lic] = await this.db
      .select()
      .from(licenseState)
      .where(eq(licenseState.schoolId, schoolId))
      .limit(1);

    if (!lic) throw new NotFoundException("Esta escuela no tiene licencia registrada");

    const now = new Date();
    const computed = this.computeStatus(
      lic.status,
      lic.validUntil,
      lic.offlineGraceUntil,
      lic.lastHeartbeatAt,
      now
    );
    const daysLeft = Math.max(
      0,
      Math.floor(
        (lic.validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )
    );

    return {
      schoolId: lic.schoolId,
      plan: lic.plan,
      status: computed,
      statusInDb: lic.status,
      validFrom: lic.validFrom,
      validUntil: lic.validUntil,
      daysLeft,
      lastHeartbeatAt: lic.lastHeartbeatAt,
      offlineGraceUntil: lic.offlineGraceUntil,
      blockedReason: lic.blockedReason,
    };
  }

  private computeStatus(
    dbStatus: string,
    validUntil: Date,
    offlineGraceUntil: Date | null,
    lastHeartbeatAt: Date | null,
    now: Date
  ): ComputedLicenseStatus {
    // 1) Bloqueo manual tiene prioridad absoluta
    if (dbStatus === "blocked") return "blocked";

    // 2) validUntil pasó → expired
    if (validUntil.getTime() < now.getTime()) return "expired";

    // 3) ¿Heartbeat fresco? (últimas 48h)
    const HEARTBEAT_FRESH_MS = 48 * 60 * 60 * 1000;
    const hbFresh =
      lastHeartbeatAt !== null &&
      now.getTime() - lastHeartbeatAt.getTime() < HEARTBEAT_FRESH_MS;

    // 4) Sin heartbeat fresco pero dentro de la gracia offline
    if (
      !hbFresh &&
      offlineGraceUntil &&
      offlineGraceUntil.getTime() > now.getTime()
    ) {
      return "grace_offline";
    }

    // 5) Sin heartbeat y sin gracia vigente → expired
    if (
      !hbFresh &&
      (!offlineGraceUntil || offlineGraceUntil.getTime() <= now.getTime())
    ) {
      return "expired";
    }

    // 6) Todo en orden → active
    return "active";
  }

  // ---------- Heartbeat ----------
  async heartbeat(schoolId: string, dto: HeartbeatDto) {
    if (!schoolId) throw new ForbiddenException("Usuario sin escuela");

    const [lic] = await this.db
      .select({ id: licenseState.id })
      .from(licenseState)
      .where(eq(licenseState.schoolId, schoolId))
      .limit(1);

    if (!lic) throw new NotFoundException("Esta escuela no tiene licencia registrada");

    const now = new Date();
    await this.db
      .update(licenseState)
      .set({
        lastHeartbeatAt: now,
        updatedAt: now,
      })
      .where(eq(licenseState.schoolId, schoolId));

    return this.getLicense(schoolId);
  }

  // ---------- Audit ----------
  async recordAudit(
    schoolId: string,
    actorId: string,
    ip: string | null,
    dto: AuditEventDto
  ) {
    if (!schoolId) throw new ForbiddenException("Usuario sin escuela");

    const [created] = await this.db
      .insert(auditLog)
      .values({
        schoolId,
        actorId,
        action: dto.action,
        entityType: dto.entityType,
        entityId: dto.entityId,
        metadata: dto.metadata ?? {},
        ip: ip ?? undefined,
      })
      .returning();

    return created;
  }

  async listAudit(
    schoolId: string,
    opts?: { limit?: number; since?: string; action?: string }
  ) {
    if (!schoolId) throw new ForbiddenException("Usuario sin escuela");

    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    const where: any[] = [eq(auditLog.schoolId, schoolId)];
    if (opts?.since) where.push(gte(auditLog.createdAt, new Date(opts.since)));
    if (opts?.action) where.push(eq(auditLog.action, opts.action));

    return this.db
      .select()
      .from(auditLog)
      .where(and(...where))
      .orderBy(desc(auditLog.createdAt))
      .limit(limit);
  }
}
