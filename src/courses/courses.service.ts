import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import { DB } from "../db/db.module";
import type { DrizzleDb } from "../db/db.module";
import {
  courses,
  courseDependencies,
  enrollments,
  activities,
  subjects,
  grades,
  users,
} from "../db/schema";
import type { CreateCourseDto } from "./dto/create-course.dto";
import type { EnrollDto } from "./dto/enroll.dto";
import { isCourseUnlocked } from "./unlock.util";

@Injectable()
export class CoursesService {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  // ---------- Crear curso ----------
  async create(schoolId: string, userId: string, dto: CreateCourseDto) {
    if (!schoolId) throw new ForbiddenException("Usuario sin escuela");

    // validar subject y grade
    const [subj] = await this.db
      .select({ id: subjects.id })
      .from(subjects)
      .where(eq(subjects.id, dto.subjectId))
      .limit(1);
    if (!subj) throw new BadRequestException("subjectId inválido");

    const [gr] = await this.db
      .select({ id: grades.id })
      .from(grades)
      .where(eq(grades.id, dto.gradeId))
      .limit(1);
    if (!gr) throw new BadRequestException("gradeId inválido");

    const [created] = await this.db
      .insert(courses)
      .values({
        schoolId,
        subjectId: dto.subjectId,
        gradeId: dto.gradeId,
        title: dto.title,
        description: dto.description,
        coverUrl: dto.coverUrl,
        isGradable: dto.isGradable ?? false,
        isMandatory: dto.isMandatory ?? false,
        sortOrder: dto.sortOrder ?? 0,
        createdBy: userId,
      })
      .returning();

    return created;
  }

  // ---------- Listar ----------
  async list(schoolId: string, studentId?: string) {
    if (!schoolId) throw new ForbiddenException("Usuario sin escuela");

    const courseRows = await this.db
      .select({
        id: courses.id,
        title: courses.title,
        description: courses.description,
        coverUrl: courses.coverUrl,
        subjectId: courses.subjectId,
        gradeId: courses.gradeId,
        isGradable: courses.isGradable,
        isMandatory: courses.isMandatory,
        sortOrder: courses.sortOrder,
        createdAt: courses.createdAt,
      })
      .from(courses)
      .where(eq(courses.schoolId, schoolId))
      .orderBy(courses.sortOrder);

    // Si es alumno, añadimos estado de desbloqueo
    if (studentId) {
      const enrolledRows = await this.db
        .select({
          courseId: enrollments.courseId,
          completionStatus: enrollments.completionStatus,
          score: enrollments.score,
          isUnlocked: enrollments.isUnlocked,
        })
        .from(enrollments)
        .where(eq(enrollments.studentId, studentId));

      const byCourse: Record<string, (typeof enrolledRows)[number]> = {};
      for (const e of enrolledRows) byCourse[e.courseId] = e;

      return courseRows.map((c) => {
        const e = byCourse[c.id];
        return {
          ...c,
          isEnrolled: !!e,
          isUnlocked: e?.isUnlocked ?? false,
          completionStatus: e?.completionStatus ?? "not_started",
          score: e?.score ?? null,
        };
      });
    }

    return courseRows;
  }

  // ---------- Detalle ----------
  async getById(schoolId: string, courseId: string, studentId?: string) {
    const [course] = await this.db
      .select()
      .from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.schoolId, schoolId)))
      .limit(1);
    if (!course) throw new NotFoundException("Curso no encontrado");

    const acts = await this.db
      .select({
        id: activities.id,
        type: activities.type,
        title: activities.title,
        position: activities.position,
        isGradable: activities.isGradable,
      })
      .from(activities)
      .where(eq(activities.courseId, courseId))
      .orderBy(activities.position);

    let enrollment: typeof enrollments.$inferSelect | null = null;
    if (studentId) {
      const [e] = await this.db
        .select()
        .from(enrollments)
        .where(
          and(eq(enrollments.studentId, studentId), eq(enrollments.courseId, courseId))
        )
        .limit(1);
      enrollment = e ?? null;
    }

    return { ...course, activities: acts, enrollment };
  }

  // ---------- Inscribir ----------
  async enroll(schoolId: string, courseId: string, dto: EnrollDto) {
    // 1) validar curso
    const [course] = await this.db
      .select()
      .from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.schoolId, schoolId)))
      .limit(1);
    if (!course) throw new NotFoundException("Curso no encontrado");

    // 2) validar que todos los alumnos pertenecen a la escuela
    const valid = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.schoolId, schoolId), inArray(users.id, dto.studentIds)));
    if (valid.length !== dto.studentIds.length) {
      throw new BadRequestException("Algún studentId no pertenece a esta escuela");
    }

    // 3) insertar enrollments (idempotente)
    const inserted = await this.db
      .insert(enrollments)
      .values(
        dto.studentIds.map((sid) => ({
          studentId: sid,
          courseId,
          completionStatus: "not_started" as const,
          isUnlocked: false,
        }))
      )
      .onConflictDoNothing()
      .returning();

    // 4) recalcular desbloqueo para cada alumno
    for (const sid of dto.studentIds) {
      await this.recalculateUnlockForStudent(sid, schoolId, courseId);
    }

    return { enrolled: inserted.length, requested: dto.studentIds.length };
  }

  // ---------- Dependencias ----------
  async addDependency(schoolId: string, courseId: string, requiredCourseId: string) {
    if (courseId === requiredCourseId) {
      throw new BadRequestException("Un curso no puede depender de sí mismo");
    }

    // ambos deben ser de la misma escuela
    const valid = await this.db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.schoolId, schoolId), inArray(courses.id, [courseId, requiredCourseId])));
    if (valid.length !== 2) throw new BadRequestException("Curso o dependencia inválidos");

    // detección de ciclo simple: requiredCourseId no debe depender (transitivamente) de courseId
    const graph = await this.loadCourseGraph(schoolId);
    graph.get(courseId)?.add(requiredCourseId); // simular
    if (this.hasCycle(graph)) {
      throw new ConflictException("Se produciría un ciclo de dependencias");
    }
    graph.get(courseId)?.delete(requiredCourseId);

    await this.db
      .insert(courseDependencies)
      .values({ courseId, requiredCourseId })
      .onConflictDoNothing();

    // recalcular desbloqueo de todos los alumnos inscritos en courseId
    const enrolled = await this.db
      .select({ studentId: enrollments.studentId })
      .from(enrollments)
      .where(eq(enrollments.courseId, courseId));

    for (const { studentId } of enrolled) {
      await this.recalculateUnlockForStudent(studentId, schoolId, courseId);
    }

    return { ok: true };
  }

  // ---------- Desbloqueo ----------
  /**
   * Recalcula is_unlocked para el alumno en el curso indicado
   * (y opcionalmente en todos los cursos de la escuela donde el alumno esté inscrito).
   */
  async recalculateUnlockForStudent(
    studentId: string,
    schoolId: string,
    onlyCourseId?: string
  ) {
    // 1) cursos completed del alumno (es esta escuela)
    const completedRows = await this.db
      .select({ courseId: enrollments.courseId })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(courses.schoolId, schoolId),
          eq(enrollments.completionStatus, "completed")
        )
      );
    const completed = new Set(completedRows.map((r) => r.courseId));

    // cursos "libres" completados (isMandatory = false)
    const freeCompletedRows = await this.db
      .select({ courseId: enrollments.courseId })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(courses.schoolId, schoolId),
          eq(enrollments.completionStatus, "completed"),
          eq(courses.isMandatory, false)
        )
      );
    const freeCompleted = new Set(freeCompletedRows.map((r) => r.courseId));

    // 2) cursos a evaluar: inscritos del alumno (o solo uno)
    const targetsQ = this.db
      .select({
        courseId: enrollments.courseId,
        unlockRule: courses.unlockRule,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(courses.schoolId, schoolId),
          ...(onlyCourseId ? [eq(enrollments.courseId, onlyCourseId)] : [])
        )
      );

    const targets = await targetsQ;

    // 3) dependencias por curso
    const ids = targets.map((t) => t.courseId);
    const deps = ids.length
      ? await this.db
          .select()
          .from(courseDependencies)
          .where(inArray(courseDependencies.courseId, ids))
      : [];
    const depsByCourse: Record<string, string[]> = {};
    for (const d of deps) {
      depsByCourse[d.courseId] ??= [];
      depsByCourse[d.courseId].push(d.requiredCourseId);
    }

    // 4) evaluar y actualizar
    for (const t of targets) {
      const unlocked = isCourseUnlocked({
        rule: t.unlockRule as any,
        completedCourseIds: completed,
        completedFreeCourseIds: freeCompleted,
        dependencyCourseIds: depsByCourse[t.courseId] ?? [],
      });
      await this.db
        .update(enrollments)
        .set({ isUnlocked: unlocked, updatedAt: new Date() })
        .where(
          and(eq(enrollments.studentId, studentId), eq(enrollments.courseId, t.courseId))
        );
    }
  }

  // ---------- Grafo (para ciclos) ----------
  private async loadCourseGraph(schoolId: string): Promise<Map<string, Set<string>>> {
    const rows = await this.db
      .select({
        courseId: courseDependencies.courseId,
        requiredCourseId: courseDependencies.requiredCourseId,
      })
      .from(courseDependencies)
      .innerJoin(courses, eq(courseDependencies.courseId, courses.id))
      .where(eq(courses.schoolId, schoolId));

    const graph = new Map<string, Set<string>>();
    for (const r of rows) {
      if (!graph.has(r.courseId)) graph.set(r.courseId, new Set());
      graph.get(r.courseId)!.add(r.requiredCourseId);
    }
    return graph;
  }

  private hasCycle(graph: Map<string, Set<string>>): boolean {
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<string, number>();
    const visit = (n: string): boolean => {
      color.set(n, GRAY);
      for (const m of graph.get(n) ?? []) {
        const c = color.get(m) ?? WHITE;
        if (c === GRAY) return true;
        if (c === WHITE && visit(m)) return true;
      }
      color.set(n, BLACK);
      return false;
    };
    for (const n of graph.keys()) {
      if ((color.get(n) ?? WHITE) === WHITE && visit(n)) return true;
    }
    return false;
  }
}
