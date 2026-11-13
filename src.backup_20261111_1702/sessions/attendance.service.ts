import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import { DB } from "../db/db.module";
import type { DrizzleDb } from "../db/db.module";
import {
  classSessions,
  groupMembers,
  sessionAttendance,
  users,
} from "../db/schema";
import { SessionsService } from "./sessions.service";
import type { BulkAttendanceDto } from "./dto/bulk-attendance.dto";

@Injectable()
export class AttendanceService {
  constructor(
    @Inject(DB) private readonly db: DrizzleDb,
    private readonly sessions: SessionsService
  ) {}

  async markBulk(schoolId: string, sessionId: string, markerId: string, dto: BulkAttendanceDto) {
    const session = await this.sessions.getOwned(schoolId, sessionId);

    // Validar alumnos en la escuela
    const studentIds = dto.entries.map((e) => e.studentId);
    const valid = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.schoolId, schoolId), inArray(users.id, studentIds)));
    if (valid.length !== studentIds.length) {
      throw new BadRequestException("Algún studentId no pertenece a la escuela");
    }

    // Opcional: si la sesión tiene groupId, validar que el alumno esté en el grupo
    if (session.groupId) {
      const members = await this.db
        .select({ studentId: groupMembers.studentId })
        .from(groupMembers)
        .where(eq(groupMembers.groupId, session.groupId));
      const set = new Set(members.map((m) => m.studentId));
      for (const e of dto.entries) {
        if (!set.has(e.studentId)) {
          throw new ForbiddenException(
            `Alumno ${e.studentId} no pertenece al grupo de la sesión`
          );
        }
      }
    }

    const now = new Date();
    let updated = 0;
    for (const entry of dto.entries) {
      await this.db
        .insert(sessionAttendance)
        .values({
          sessionId,
          studentId: entry.studentId,
          status: entry.status,
          markedById: markerId,
          markedAt: now,
          notes: entry.notes,
        })
        .onConflictDoUpdate({
          target: [sessionAttendance.sessionId, sessionAttendance.studentId],
          set: {
            status: entry.status,
            markedById: markerId,
            markedAt: now,
            notes: entry.notes,
          },
        });
      updated++;
    }

    return { updated };
  }

  async list(schoolId: string, sessionId: string) {
    await this.sessions.getOwned(schoolId, sessionId);
    return this.db
      .select()
      .from(sessionAttendance)
      .where(eq(sessionAttendance.sessionId, sessionId));
  }
}
