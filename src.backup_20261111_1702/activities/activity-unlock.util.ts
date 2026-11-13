/**
 * Reglas de desbloqueo para ACTIVIDADES.
 *
 * Una actividad se desbloquea si:
 *  - No tiene dependencias (activity_dependencies).
 *  - O si TODAS las actividades de las que depende están completed para ese alumno.
 *
 * Nota: para cursos usamos courses/unlock.util.ts. Este archivo se enfoca
 * exclusivamente en actividades dentro de un curso.
 */

export interface ActivityUnlockContext {
  /** IDs de actividades de las que depende esta actividad */
  dependencyActivityIds: string[];
  /** IDs de actividades que el alumno ya completó */
  completedActivityIds: Set<string>;
}

export function isActivityUnlocked(ctx: ActivityUnlockContext): boolean {
  for (const dep of ctx.dependencyActivityIds) {
    if (!ctx.completedActivityIds.has(dep)) return false;
  }
  return true;
}
