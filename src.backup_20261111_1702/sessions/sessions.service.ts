import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { DB } from "../db/db.module";
import type { DrizzleDb } from "../db/db.module";
import {
  classSessions,
  courses,
  enrollments,
  groupMembers,
  groups,
  roles as rolesTable,
  sessionAttendance,
  userRoles,
  users,
} from "../db/schema";
import type { CreateSessionDto } from "./dto/create-session.dto";
import type { UpdateSessionDto } from "./dto/update-session.dto";

@Injectable()
export class SessionsService {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  // ---------- Crear ----------
  async create(schoolId: string, createdById: string, dto: CreateSessionDto) {
    if (!schoolId) throw new ForbiddenException("Usuario sin escuela");

    const starts = new Date(dto.startsAt);
    const ends = new Date(dto.endsAt);
    if (ends <= starts) {
      throw new BadRequestException("endsAt debe ser posterior a startsAt");
    }

    const [course] = await this.db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.id, dto.courseId), eq(courses.schoolId, schoolId)))
      .limit(1);
    if (!course) throw new BadRequestException("courseId inválido");

    const [teacher] = await this.db
      .select({ id: users.id })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(rolesTable, eq(rolesTable.id, userRoles.roleId))
      .where(
        and(
          eq(users.id, dto.teacherId),
          eq(users.schoolId, schoolId),
          inArray(rolesTable.name, ["teacher", "school_admin"])
        )
      )
      .limit(1);
    if (!teacher) {
      throw new BadRequestException("teacherId inválido o sin rol teacher");
    }

    if (dto.groupId) {
      const [g] = await this.db
        .select({ id: groups.id })
        .from(groups)
        .where(and(eq(groups.id, dto.groupId), eq(groups.schoolId, schoolId)))
        .limit(1);
      if (!g) throw new BadRequestException("groupId inválido");
    }

    if (dto.mode === "in_person" && !dto.location) {
      throw new BadRequestException("mode=in_person requiere location");
    }
    if (dto.mode === "virtual" && !dto.virtualUrl) {
      throw new BadRequestException("mode=virtual requiere virtualUrl");
    }
    if (dto.mode === "hybrid" && !dto.location && !dto.virtualUrl) {
      throw new BadRequestException("mode=hybrid requiere location o virtualUrl");
    }

    const [created] = await this.db
      .insert(classSessions)
      .values({
        courseId: dto.courseId,
        groupId: dto.groupId,
        teacherId: dto.teacherId,
        title: dto.title,
        startsAt: starts,
        endsAt: ends,
        mode: dto.mode,
        location: dto.location,
        virtualUrl: dto.virtualUrl,
        notes: dto.notes,
        createdById,
      })
      .returning();

    return created;
  }

  // ---------- Update ----------
  async update(schoolId: string, sessionId: string, dto: UpdateSessionDto) {
    const existing = await this.getOwned(schoolId, sessionId);

    const starts = dto.startsAt ? new Date(dto.startsAt) : existing.startsAt;
    const ends = dto.endsAt ? new Date(dto.endsAt) : existing.endsAt;
    if (ends <= starts) {
      throw new BadRequestException("endsAt debe ser posterior a startsAt");
    }

    const [updated] = await this.db
      .update(classSessions)
      .set({
        title: dto.title ?? existing.title,
        startsAt: starts,
        endsAt: ends,
        mode: dto.mode ?? existing.mode,
        status: dto.status ?? existing.status,
        location: dto.location ?? existing.location,
        virtualUrl: dto.virtualUrl ?? existing.virtualUrl,
        notes: dto.notes ?? existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(classSessions.id, sessionId))
      .returning();

    return updated;
  }

  // ---------- Listar (admin/teacher) ----------
  async listForAdmin(
    schoolId: string,
    filters?: { courseId?: string; from?: string; to?: string; status?: string }
  ) {
    const where: any[] = [eq(courses.schoolId, schoolId)];
    if (filters?.courseId) where.push(eq(classSessions.courseId, filters.courseId));
    if (filters?.from) where.push(gte(classSessions.startsAt, new Date(filters.from)));
    if (filters?.to) where.push(lte(classSessions.startsAt, new Date(filters.to)));
    if (filters?.status) where.push(eq(classSessions.status, filters.status as any));

    return this.db
      .select({
        id: classSessions.id,
        courseId: classSessions.courseId,
        groupId: classSessions.groupId,
        teacherId: classSessions.teacherId,
        title: classSessions.title,
        startsAt: classSessions.startsAt,
        endsAt: classSessions.endsAt,
        mode: classSessions.mode,
        status: classSessions.status,
        location: classSessions.location,
        virtualUrl: classSessions.virtualUrl,
      })
      .from(classSessions)
      .innerJoin(courses, eq(classSessions.courseId, courses.id))
      .where(and(...where))
      .orderBy(classSessions.startsAt);
  }

  // ---------- Listar (student) ----------
  async listForStudent(studentId: string, schoolId: string) {
    const enrolledRows = await this.db
      .select({ courseId: enrollments.courseId })
      .from(enrollments)
      .where(eq(enrollments.studentId, studentId));
    const enrolledCourses = enrolledRows.map((r) => r.courseId);
    if (!enrolledCourses.length) return [];

    const memberRows = await this.db
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .where(eq(groupMembers.studentId, studentId));
    const groupIds = memberRows.map((r) => r.groupId);

    const groupCondition =
      groupIds.length > 0
        ? or(isNull(classSessions.groupId), inArray(classSessions.groupId, groupIds))
        : isNull(classSessions.groupId);

    const sessions = await this.db
      .select({
        id: classSessions.id,
        courseId: classSessions.courseId,
        groupId: classSessions.groupId,
        title: classSessions.title,
        startsAt: classSessions.startsAt,
        endsAt: classSessions.endsAt,
        mode: classSessions.mode,
        status: classSessions.status,
        location: classSessions.location,
        virtualUrl: classSessions.virtualUrl,
      })
      .from(classSessions)
      .innerJoin(courses, eq(classSessions.courseId, courses.id))
      .where(
        and(
          eq(courses.schoolId, schoolId),
          inArray(classSessions.courseId, enrolledCourses),
          groupCondition
        )
      )
      .orderBy(classSessions.startsAt);

    if (!sessions.length) return [];

    const sessionIds = sessions.map((s) => s.id);
    const attRows = await this.db
      .select({
        sessionId: sessionAttendance.sessionId,
        status: sessionAttendance.status,
      })
      .from(sessionAttendance)
      .where(
        and(
          eq(sessionAttendance.studentId, studentId),
          inArray(sessionAttendance.sessionId, sessionIds)
        )
      );
    const attendanceBySession: Record<string, string> = {};
    for (const a of attRows) attendanceBySession[a.sessionId] = a.status;

    return sessions.map((s) => ({
      ...s,
      myAttendance: attendanceBySession[s.id] ?? null,
    }));
  }

  // ---------- Detalle ----------
  async getDetail(schoolId: string, sessionId: string) {
    const ses = await this.getOwned(schoolId, sessionId);
    const attendance = await this.db
      .select()
      .from(sessionAttendance)
      .where(eq(sessionAttendance.sessionId, sessionId));
    return { ...ses, attendance };
  }

  // ---------- Helpers ----------
  async getOwned(schoolId: string, sessionId: string) {
    if (!sessionId || sessionId === "null" || sessionId === "undefined") {
      throw new NotFoundException("sessionId inválido");
    }
    const [row] = await this.db
      .select({ session: classSessions })
      .from(classSessions)
      .innerJoin(courses, eq(classSessions.courseId, courses.id))
      .where(and(eq(classSessions.id, sessionId), eq(courses.schoolId, schoolId)))
      .limit(1);
    if (!row) throw new NotFoundException("Sesión no encontrada");
    return row.session;
  }
}
