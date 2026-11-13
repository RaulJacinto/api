import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import { randomBytes } from "crypto";
import { DB } from "../db/db.module";
import type { DrizzleDb } from "../db/db.module";
import {
  activities,
  activityProgress,
  certificates,
  courses,
  enrollments,
  gradebookEntries,
  users,
} from "../db/schema";
import type { CreateEntryDto } from "./dto/create-entry.dto";
import type { UpdateEntryDto } from "./dto/update-entry.dto";

@Injectable()
export class GradebookService {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  // ---------- Upsert (create or update entry) ----------
  async upsertEntry(schoolId: string, gradedBy: string, dto: CreateEntryDto) {
    // Validar curso + alumno + que el alumno esté inscrito
    const [course] = await this.db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.id, dto.courseId), eq(courses.schoolId, schoolId)))
      .limit(1);
    if (!course) throw new BadRequestException("courseId inválido");

    const [enr] = await this.db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, dto.studentId),
          eq(enrollments.courseId, dto.courseId)
        )
      )
      .limit(1);
    if (!enr) throw new BadRequestException("El alumno no está inscrito en el curso");

    const maxScore = dto.maxScore ?? 100;
    if (dto.score > maxScore) {
      throw new BadRequestException("score no puede ser mayor que maxScore");
    }

    const [row] = await this.db
      .insert(gradebookEntries)
      .values({
        studentId: dto.studentId,
        courseId: dto.courseId,
        period: dto.period,
        score: dto.score.toString(),
        maxScore: maxScore.toString(),
        gradedBy,
        notes: dto.notes,
      })
      .onConflictDoUpdate({
        target: [
          gradebookEntries.studentId,
          gradebookEntries.courseId,
          gradebookEntries.period,
        ],
        set: {
          score: dto.score.toString(),
          maxScore: maxScore.toString(),
          gradedBy,
          gradedAt: new Date(),
          notes: dto.notes,
        },
      })
      .returning();

    return row;
  }

  // ---------- Update by id ----------
  async updateById(schoolId: string, entryId: string, dto: UpdateEntryDto, gradedBy: string) {
    const existing = await this.getOwned(schoolId, entryId);

    const nextScore = dto.score ?? Number(existing.score);
    const nextMax = dto.maxScore ?? Number(existing.maxScore);
    if (nextScore > nextMax) {
      throw new BadRequestException("score no puede ser mayor que maxScore");
    }

    const [updated] = await this.db
      .update(gradebookEntries)
      .set({
        score: nextScore.toString(),
        maxScore: nextMax.toString(),
        notes: dto.notes ?? existing.notes,
        gradedBy,
        gradedAt: new Date(),
      })
      .where(eq(gradebookEntries.id, entryId))
      .returning();

    return updated;
  }

  // ---------- Delete ----------
  async deleteById(schoolId: string, entryId: string) {
    await this.getOwned(schoolId, entryId);
    await this.db.delete(gradebookEntries).where(eq(gradebookEntries.id, entryId));
    return { ok: true };
  }

  // ---------- Libro del curso (admin/teacher) ----------
  async courseSheet(schoolId: string, courseId: string) {
    const [course] = await this.db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.schoolId, schoolId)))
      .limit(1);
    if (!course) throw new NotFoundException("Curso no encontrado");

    // Lista de alumnos inscritos
    const enrolled = await this.db
      .select({
        studentId: enrollments.studentId,
      })
      .from(enrollments)
      .where(eq(enrollments.courseId, courseId));

    const studentIds = enrolled.map((e) => e.studentId);

    // Nombre + email de los alumnos
    const studentInfo = studentIds.length
      ? await this.db
          .select({
            id: users.id,
            displayName: users.displayName,
            email: users.email,
          })
          .from(users)
          .where(inArray(users.id, studentIds))
      : [];

    // Entradas del curso
    const entries = await this.db
      .select()
      .from(gradebookEntries)
      .where(eq(gradebookEntries.courseId, courseId));

    // Agrupar entradas por alumno
    const byStudent: Record<string, typeof entries> = {};
    for (const e of entries) {
      byStudent[e.studentId] ??= [];
      byStudent[e.studentId].push(e);
    }

    return studentInfo.map((s) => ({
      studentId: s.id,
      displayName: s.displayName,
      email: s.email,
      entries: byStudent[s.id] ?? [],
    }));
  }

  // ---------- Boletín del alumno ----------
  async studentReportCard(
    schoolId: string,
    requestedStudentId: string,
    viewerId: string,
    viewerRoles: string[]
  ) {
    // Reglas:
    //  - admin/teacher: cualquier alumno de su escuela
    //  - student: solo el propio
    //  - parent: por ahora rechazamos (Fase 5)
    const isStaff = viewerRoles.includes("school_admin") || viewerRoles.includes("teacher");
    if (!isStaff && viewerId !== requestedStudentId) {
      throw new ForbiddenException("No puedes ver el boletín de otro alumno");
    }

    // Verificar alumno y escuela
    const [student] = await this.db
      .select({ id: users.id, displayName: users.displayName, email: users.email })
      .from(users)
      .where(and(eq(users.id, requestedStudentId), eq(users.schoolId, schoolId)))
      .limit(1);
    if (!student) throw new NotFoundException("Alumno no encontrado");

    const entries = await this.db
      .select()
      .from(gradebookEntries)
      .where(eq(gradebookEntries.studentId, requestedStudentId));

    // Agrupar por curso
    const courseIds = [...new Set(entries.map((e) => e.courseId))];
    const courseInfo = courseIds.length
      ? await this.db
          .select({ id: courses.id, title: courses.title })
          .from(courses)
          .where(inArray(courses.id, courseIds))
      : [];

    const byCourse = courseInfo.map((c) => {
      const courseEntries = entries.filter((e) => e.courseId === c.id);
      // Calcular promedio simple por curso (score/maxScore * 100)
      const percentages = courseEntries.map(
        (e) => (Number(e.score) / Number(e.maxScore)) * 100
      );
      const avgPercent =
        percentages.length > 0
          ? percentages.reduce((a, b) => a + b, 0) / percentages.length
          : null;

      return {
        courseId: c.id,
        courseTitle: c.title,
        entries: courseEntries,
        averagePercent: avgPercent !== null ? Math.round(avgPercent * 100) / 100 : null,
      };
    });

    return {
      studentId: student.id,
      displayName: student.displayName,
      email: student.email,
      courses: byCourse,
    };
  }

  // ---------- Emitir certificado ----------
  async issueCertificate(schoolId: string, courseId: string, studentId: string) {
    // Verificar curso
    const [course] = await this.db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.schoolId, schoolId)))
      .limit(1);
    if (!course) throw new NotFoundException("Curso no encontrado");

    // Verificar alumno inscrito + curso completado
    const [enr] = await this.db
      .select({
        completionStatus: enrollments.completionStatus,
      })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.courseId, courseId)
        )
      )
      .limit(1);
    if (!enr) throw new BadRequestException("Alumno no inscrito");
    if (enr.completionStatus !== "completed") {
      throw new BadRequestException("El curso aún no está completado por el alumno");
    }

    // Verificar que no exista ya
    const [existing] = await this.db
      .select({ id: certificates.id })
      .from(certificates)
      .where(
        and(
          eq(certificates.studentId, studentId),
          eq(certificates.courseId, courseId)
        )
      )
      .limit(1);
    if (existing) {
      throw new BadRequestException("El certificado ya existe para este alumno/curso");
    }

    // Serial único: timestamp + random hex
    const serial = `CERT-${Date.now()}-${randomBytes(4).toString("hex").toUpperCase()}`;

    const [cert] = await this.db
      .insert(certificates)
      .values({
        studentId,
        courseId,
        serial,
      })
      .returning();

    return cert;
  }

  async getCertificate(schoolId: string, courseId: string, studentId: string) {
    const [course] = await this.db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.schoolId, schoolId)))
      .limit(1);
    if (!course) throw new NotFoundException("Curso no encontrado");

    const [cert] = await this.db
      .select()
      .from(certificates)
      .where(
        and(
          eq(certificates.studentId, studentId),
          eq(certificates.courseId, courseId)
        )
      )
      .limit(1);
    if (!cert) throw new NotFoundException("Certificado no encontrado");
    return cert;
  }

  // ---------- Helpers ----------
  private async getOwned(schoolId: string, entryId: string) {
    const [row] = await this.db
      .select({ entry: gradebookEntries })
      .from(gradebookEntries)
      .innerJoin(courses, eq(gradebookEntries.courseId, courses.id))
      .where(and(eq(gradebookEntries.id, entryId), eq(courses.schoolId, schoolId)))
      .limit(1);
    if (!row) throw new NotFoundException("Entrada de gradebook no encontrada");
    return row.entry;
  }
}
