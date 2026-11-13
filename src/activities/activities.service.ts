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
  activities,
  activityDependencies,
  activityProgress,
  courses,
  enrollments,
} from "../db/schema";
import { CoursesService } from "../courses/courses.service";
import { isActivityUnlocked } from "./activity-unlock.util";
import type { CreateActivityDto } from "./dto/create-activity.dto";
import type { UpdateActivityDto } from "./dto/update-activity.dto";
import type { CompleteActivityDto } from "./dto/complete-activity.dto";
import type { UpdateProgressDto } from "./dto/update-progress.dto";

@Injectable()
export class ActivitiesService {
  constructor(
    @Inject(DB) private readonly db: DrizzleDb,
    private readonly courses: CoursesService
  ) {}

  // ---------- Crear ----------
  async create(schoolId: string, courseId: string, dto: CreateActivityDto) {
    const [course] = await this.db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.schoolId, schoolId)))
      .limit(1);
    if (!course) throw new NotFoundException("Curso no encontrado");

    let position = dto.position;
    if (position === undefined) {
      const existing = await this.db
        .select({ position: activities.position })
        .from(activities)
        .where(eq(activities.courseId, courseId));
      position = existing.length ? Math.max(...existing.map((x) => x.position)) + 1 : 1;
    }

    const [created] = await this.db
      .insert(activities)
      .values({
        courseId,
        type: dto.type as any,
        title: dto.title,
        description: dto.description,
        config: dto.config ?? undefined,   // undefined, no null
        position,
        isGradable: dto.isGradable ?? false,
      })
      .returning();

    return created;
  }

  // ---------- Update ----------
  async update(schoolId: string, activityId: string, dto: UpdateActivityDto) {
    const act = await this.getOwned(schoolId, activityId);

    const [updated] = await this.db
      .update(activities)
      .set({
        title: dto.title ?? act.title,
        description: dto.description ?? act.description,
        config: dto.config ?? act.config ?? undefined,
        position: dto.position ?? act.position,
        updatedAt: new Date(),
      })
      .where(eq(activities.id, activityId))
      .returning();

    return updated;
  }

  // ---------- Get ----------
  async getForViewer(
    schoolId: string,
    activityId: string,
    viewerId: string,
    isStudent: boolean
  ) {
    const [row] = await this.db
      .select({ activity: activities })
      .from(activities)
      .innerJoin(courses, eq(activities.courseId, courses.id))
      .where(and(eq(activities.id, activityId), eq(courses.schoolId, schoolId)))
      .limit(1);

    if (!row) throw new NotFoundException("Actividad no encontrada");
    const activity = row.activity;

    if (!isStudent) {
      return { ...activity, progress: null };
    }

    const [enr] = await this.db
      .select({ isUnlocked: enrollments.isUnlocked })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, viewerId),
          eq(enrollments.courseId, activity.courseId)
        )
      )
      .limit(1);
    if (!enr) throw new ForbiddenException("No estás inscrito");
    if (!enr.isUnlocked) throw new ForbiddenException("Curso bloqueado");

    const [prog] = await this.db
      .select()
      .from(activityProgress)
      .where(
        and(
          eq(activityProgress.studentId, viewerId),
          eq(activityProgress.activityId, activityId)
        )
      )
      .limit(1);

    return { ...activity, progress: prog ?? null };
  }

  // ---------- Complete ----------
  async complete(
    schoolId: string,
    activityId: string,
    studentId: string,
    dto: CompleteActivityDto
  ) {
    const activity = await this.getOwned(schoolId, activityId);

    const [enr] = await this.db
      .select({ isUnlocked: enrollments.isUnlocked })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.courseId, activity.courseId)
        )
      )
      .limit(1);
    if (!enr) throw new ForbiddenException("No estás inscrito");
    if (!enr.isUnlocked) throw new ForbiddenException("Curso bloqueado");

    const deps = await this.db
      .select({ requiredActivityId: activityDependencies.requiredActivityId })
      .from(activityDependencies)
      .where(eq(activityDependencies.activityId, activityId));

    const completedRows = await this.db
      .select({ activityId: activityProgress.activityId })
      .from(activityProgress)
      .where(
        and(
          eq(activityProgress.studentId, studentId),
          eq(activityProgress.completionStatus, "completed")
        )
      );
    const completedSet = new Set(completedRows.map((r) => r.activityId));

    if (
      !isActivityUnlocked({
        dependencyActivityIds: deps.map((d) => d.requiredActivityId),
        completedActivityIds: completedSet,
      })
    ) {
      throw new ForbiddenException("Actividad bloqueada (dependencias sin completar)");
    }

    const now = new Date();
    await this.db
      .insert(activityProgress)
      .values({
        studentId,
        activityId,
        completionStatus: "completed",
        isUnlocked: true,
        score: dto.score !== undefined ? dto.score.toString() : undefined,
        startedAt: now,
        completedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [activityProgress.studentId, activityProgress.activityId],
        set: {
          completionStatus: "completed",
          isUnlocked: true,
          score: dto.score !== undefined ? dto.score.toString() : undefined,
          completedAt: now,
          updatedAt: now,
        },
      });

    await this.unlockDependents(studentId, activityId);
    await this.maybeCompleteCourse(studentId, schoolId, activity.courseId);

    return { ok: true };
  }

  // ---------- Dependencias ----------
  async addDependency(
    schoolId: string,
    activityId: string,
    requiredActivityId: string
  ) {
    if (activityId === requiredActivityId) {
      throw new BadRequestException("Una actividad no puede depender de sí misma");
    }

    const [act, req] = await Promise.all([
      this.getOwned(schoolId, activityId),
      this.getOwned(schoolId, requiredActivityId),
    ]);

    if (act.courseId !== req.courseId) {
      throw new BadRequestException("Las actividades deben ser del mismo curso");
    }

    // Ciclo
    const deps = await this.db
      .select()
      .from(activityDependencies);

    const graph = new Map<string, Set<string>>();
    for (const d of deps) {
      graph.set(d.activityId, new Set([...(graph.get(d.activityId) ?? []), d.requiredActivityId]));
    }
    graph.set(activityId, new Set([...(graph.get(activityId) ?? []), requiredActivityId]));

    if (this.hasCycle(graph)) {
      throw new ConflictException("Se produciría un ciclo de dependencias");
    }

    await this.db
      .insert(activityDependencies)
      .values({ activityId, requiredActivityId })
      .onConflictDoNothing();

    // Recalcular para todos los alumnos inscritos
    const students = await this.db
      .select({ studentId: enrollments.studentId })
      .from(enrollments)
      .where(eq(enrollments.courseId, act.courseId));

    for (const { studentId } of students) {
      await this.recalculateForStudent(studentId, act.courseId);
    }

    return { ok: true };
  }

  // ---------- Helpers ----------
  private async getOwned(schoolId: string, activityId: string) {
    const [row] = await this.db
      .select({ activity: activities })
      .from(activities)
      .innerJoin(courses, eq(activities.courseId, courses.id))
      .where(and(eq(activities.id, activityId), eq(courses.schoolId, schoolId)))
      .limit(1);
    if (!row) throw new NotFoundException("Actividad no encontrada");
    return row.activity;
  }

  private async unlockDependents(studentId: string, completedActivityId: string) {
    const dependents = await this.db
      .select({ activityId: activityDependencies.activityId })
      .from(activityDependencies)
      .where(eq(activityDependencies.requiredActivityId, completedActivityId));

    if (!dependents.length) return;

    const completedRows = await this.db
      .select({ activityId: activityProgress.activityId })
      .from(activityProgress)
      .where(
        and(
          eq(activityProgress.studentId, studentId),
          eq(activityProgress.completionStatus, "completed")
        )
      );
    const completedSet = new Set(completedRows.map((r) => r.activityId));

    for (const { activityId } of dependents) {
      const allDeps = await this.db
        .select({ requiredActivityId: activityDependencies.requiredActivityId })
        .from(activityDependencies)
        .where(eq(activityDependencies.activityId, activityId));

      const unlocked = isActivityUnlocked({
        dependencyActivityIds: allDeps.map((d) => d.requiredActivityId),
        completedActivityIds: completedSet,
      });

      if (unlocked) {
        await this.db
          .insert(activityProgress)
          .values({
            studentId,
            activityId,
            completionStatus: "not_started",
            isUnlocked: true,
          })
          .onConflictDoUpdate({
            target: [activityProgress.studentId, activityProgress.activityId],
            set: { isUnlocked: true, updatedAt: new Date() },
          });
      }
    }
  }

  private async recalculateForStudent(studentId: string, courseId: string) {
    const acts = await this.db
      .select({ id: activities.id })
      .from(activities)
      .where(eq(activities.courseId, courseId));
    if (!acts.length) return;

    const allDeps = await this.db
      .select()
      .from(activityDependencies);

    const courseActIds = new Set(acts.map((a) => a.id));
    const depsByAct: Record<string, string[]> = {};
    for (const d of allDeps) {
      if (!courseActIds.has(d.activityId)) continue;
      depsByAct[d.activityId] ??= [];
      depsByAct[d.activityId].push(d.requiredActivityId);
    }

    const completedRows = await this.db
      .select({ activityId: activityProgress.activityId })
      .from(activityProgress)
      .where(
        and(
          eq(activityProgress.studentId, studentId),
          eq(activityProgress.completionStatus, "completed")
        )
      );
    const completedSet = new Set(completedRows.map((r) => r.activityId));

    for (const a of acts) {
      const unlocked = isActivityUnlocked({
        dependencyActivityIds: depsByAct[a.id] ?? [],
        completedActivityIds: completedSet,
      });

      await this.db
        .insert(activityProgress)
        .values({
          studentId,
          activityId: a.id,
          completionStatus: "not_started",
          isUnlocked: unlocked,
        })
        .onConflictDoUpdate({
          target: [activityProgress.studentId, activityProgress.activityId],
          set: { isUnlocked: unlocked, updatedAt: new Date() },
        });
    }
  }

  private async maybeCompleteCourse(
    studentId: string,
    schoolId: string,
    courseId: string
  ) {
    const all = await this.db
      .select({ id: activities.id })
      .from(activities)
      .where(eq(activities.courseId, courseId));
    if (!all.length) return;

    const completed = await this.db
      .select({ activityId: activityProgress.activityId })
      .from(activityProgress)
      .where(
        and(
          eq(activityProgress.studentId, studentId),
          eq(activityProgress.completionStatus, "completed"),
          inArray(
            activityProgress.activityId,
            all.map((a) => a.id)
          )
        )
      );

    if (completed.length !== all.length) return;

    const now = new Date();
    await this.db
      .update(enrollments)
      .set({
        completionStatus: "completed",
        completedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.courseId, courseId)
        )
      );

    await this.courses.recalculateUnlockForStudent(studentId, schoolId);
  }

async updateProgress(
    schoolId: string,
    activityId: string,
    studentId: string,
    dto: UpdateProgressDto
  ) {
    const activity = await this.getOwned(schoolId, activityId);

    // Verificar inscripción + curso desbloqueado
    const [enr] = await this.db
      .select({ isUnlocked: enrollments.isUnlocked })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.courseId, activity.courseId)
        )
      )
      .limit(1);
    if (!enr) throw new ForbiddenException("No estás inscrito");
    if (!enr.isUnlocked) throw new ForbiddenException("Curso bloqueado");

    // Verificar que la ACTIVIDAD esté desbloqueada (dependencias)
    const deps = await this.db
      .select({ requiredActivityId: activityDependencies.requiredActivityId })
      .from(activityDependencies)
      .where(eq(activityDependencies.activityId, activityId));

    const completedRows = await this.db
      .select({ activityId: activityProgress.activityId })
      .from(activityProgress)
      .where(
        and(
          eq(activityProgress.studentId, studentId),
          eq(activityProgress.completionStatus, "completed")
        )
      );
    const completedSet = new Set(completedRows.map((r) => r.activityId));

    if (
      !isActivityUnlocked({
        dependencyActivityIds: deps.map((d) => d.requiredActivityId),
        completedActivityIds: completedSet,
      })
    ) {
      throw new ForbiddenException("Actividad bloqueada (dependencias sin completar)");
    }

    // Leer progreso actual
    const [existing] = await this.db
      .select()
      .from(activityProgress)
      .where(
        and(
          eq(activityProgress.studentId, studentId),
          eq(activityProgress.activityId, activityId)
        )
      )
      .limit(1);

    const now = new Date();
    const resume = dto.resumePositionSec ?? existing?.resumePositionSec ?? 0;
    // No retroceder: si el alumno intenta volver a 0 en video, guardamos el máximo.
    const finalResume =
      existing && existing.resumePositionSec !== null
        ? Math.max(existing.resumePositionSec, resume)
        : resume;

    // Nuevo status: si estaba not_started → in_progress (pero no bajamos un completed)
    let newStatus = existing?.completionStatus ?? "not_started";
    if (newStatus === "not_started") newStatus = "in_progress";

    await this.db
      .insert(activityProgress)
      .values({
        studentId,
        activityId,
        completionStatus: "in_progress",
        isUnlocked: true,
        resumePositionSec: finalResume,
        startedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [activityProgress.studentId, activityProgress.activityId],
        set: {
          completionStatus: newStatus,
          resumePositionSec: finalResume,
          startedAt: existing?.startedAt ?? now,
          updatedAt: now,
        },
      });

    return {
      ok: true,
      resumePositionSec: finalResume,
      completionStatus: newStatus,
    };
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
