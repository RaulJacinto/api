/**
 * Reglas de desbloqueo (compartidas con actividades en 3.3).
 *
 * Un curso se desbloquea si:
 *  - su unlockRule es null, o
 *  - unlockRule.type === "course": el curso requerido está completed, o
 *  - unlockRule.type === "volume": el alumno completó N cursos "libres"
 *    (isMandatory === false) de la misma escuela.
 *
 * También se bloquea si alguna dependencia en course_dependencies
 * no está completada.
 */

export type UnlockRule =
  | null
  | { type: "course"; requiredCourseId: string }
  | { type: "volume"; requiredFreeCoursesCount: number };

export interface UnlockContext {
  /** completed | not_started | in_progress del curso que se evalúa */
  rule: UnlockRule;
  /** IDs de cursos completed por el alumno */
  completedCourseIds: Set<string>;
  /** IDs de cursos libres completed por el alumno */
  completedFreeCourseIds: Set<string>;
  /** IDs de cursos requeridos vía course_dependencies (todos deben estar completed) */
  dependencyCourseIds: string[];
}

export function isCourseUnlocked(ctx: UnlockContext): boolean {
  // 1) dependencias duras: todas deben estar completed
  for (const dep of ctx.dependencyCourseIds) {
    if (!ctx.completedCourseIds.has(dep)) return false;
  }

  // 2) regla extra
  if (ctx.rule == null) return true;

  if (ctx.rule.type === "course") {
    return ctx.completedCourseIds.has(ctx.rule.requiredCourseId);
  }

  if (ctx.rule.type === "volume") {
    return ctx.completedFreeCourseIds.size >= ctx.rule.requiredFreeCoursesCount;
  }

  return false;
}
