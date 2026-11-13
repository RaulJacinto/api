// ============================================================================
// LMS EDUDIN — Esquema Drizzle (v2)
// Dialecto: PostgreSQL 16
// ============================================================================
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// ENUMS
// ============================================================================
export const userRoleEnum = pgEnum("user_role", [
  "super_admin",   // EDUDIN Core
  "instructor",    // EDUDIN Core
  "school_admin",  // Escuela
  "teacher",       // Escuela
  "student",       // Escuela
  "parent",        // Escuela
]);

export const levelEnum = pgEnum("level", [
  "kinder",
  "primaria",
  "secundaria",
  "prepa",
  "superior",
  "otra",
]);

export const activityTypeEnum = pgEnum("activity_type", [
  "video",
  "game_standalone",
  "game_after_video",
  "quiz",
  "reading",
  "family",
  "group",
]);

export const completionStatusEnum = pgEnum("completion_status", [
  "not_started",
  "in_progress",
  "completed",
]);

export const licenseStatusEnum = pgEnum("license_status", [
  "active",
  "blocked",
  "expired",
  "grace_offline",
]);

export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "active",
  "dropped",
  "completed",
]);

// ============================================================================
// 8.1 IDENTIDAD Y TENENCIA
// ============================================================================
export const schools = pgTable("schools", {
  id: uuid("id").primaryKey().defaultRandom(),
  coreSchoolId: varchar("core_school_id", { length: 128 }).notNull().unique(), // ID en EDUDIN Core
  name: varchar("name", { length: 256 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  branding: jsonb("branding").$type<{
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    treeLogoUrl?: string;
  }>().default({}),
  timezone: varchar("timezone", { length: 64 }).notNull().default("America/Mexico_City"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }), // null para usuarios de Core
    email: varchar("email", { length: 256 }).notNull(),
    passwordHash: text("password_hash"), // nullable si usan SSO futuro
    displayName: varchar("display_name", { length: 128 }).notNull(),
    avatarUrl: text("avatar_url"),
    dateOfBirth: timestamp("date_of_birth", { withTimezone: false }), // útil para adaptar contenido por edad
    locale: varchar("locale", { length: 10 }).notNull().default("es"),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailPerSchoolUniq: uniqueIndex("users_email_school_uniq").on(t.schoolId, t.email),
    emailCoreUniq: uniqueIndex("users_email_core_uniq").on(t.email), // colisión evitada por emailPorSchool; de facto el email es único por escuela o global para core
    schoolIdx: index("users_school_idx").on(t.schoolId),
  })
);

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: userRoleEnum("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    scopeSchoolId: uuid("scope_school_id").references(() => schools.id, { onDelete: "cascade" }), // null = scope global (Core)
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.roleId, t.scopeSchoolId] }),
    userIdx: index("user_roles_user_idx").on(t.userId),
  })
);

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    teacherId: uuid("teacher_id").references(() => users.id, { onDelete: "set null" }),
    academicYear: varchar("academic_year", { length: 16 }).notNull(), // "2025-2026"
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    schoolYearNameUniq: uniqueIndex("groups_school_year_name_uniq").on(
      t.schoolId,
      t.academicYear,
      t.name
    ),
    teacherIdx: index("groups_teacher_idx").on(t.teacherId),
  })
);

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.groupId, t.studentId] }),
    studentIdx: index("group_members_student_idx").on(t.studentId),
  })
);

export const parentStudentLinks = pgTable(
  "parent_student_links",
  {
    parentId: uuid("parent_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    relationship: varchar("relationship", { length: 64 }), // "madre", "padre", "tutor"
    verified: boolean("verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.parentId, t.studentId] }),
    studentIdx: index("parent_student_links_student_idx").on(t.studentId),
  })
);

// ============================================================================
// 8.2 CATÁLOGO CURRICULAR
// ============================================================================
export const levels = pgTable("levels", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: levelEnum("name").notNull().unique(),
  displayName: varchar("display_name", { length: 64 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const grades = pgTable(
  "grades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    levelId: uuid("level_id")
      .notNull()
      .references(() => levels.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 32 }).notNull(), // "1º", "2º"
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => ({
    levelNameUniq: uniqueIndex("grades_level_name_uniq").on(t.levelId, t.name),
  })
);

export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 128 }).notNull(),
    slug: varchar("slug", { length: 128 }).notNull().unique(),
    color: varchar("color", { length: 16 }),
    iconUrl: text("icon_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    coreCourseId: varchar("core_course_id", { length: 128 }), // ID en edudin-core si fue distribuido por stream
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }), // el curso vive en una escuela
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id),
    gradeId: uuid("grade_id")
      .notNull()
      .references(() => grades.id),
    title: varchar("title", { length: 256 }).notNull(),
    description: text("description"),
    coverUrl: text("cover_url"),
    isGradable: boolean("is_gradable").notNull().default(false),
    isMandatory: boolean("is_mandatory").notNull().default(false), // obligatorio vs libre
    /** 
     * Regla de desbloqueo. Ejemplos:
     *  { type: "course", requiredCourseId: "..." }
     *  { type: "volume", requiredFreeCoursesCount: 3 }
     *  null => siempre desbloqueado
     */
    unlockRule: jsonb("unlock_rule").$type<
      | null
      | { type: "course"; requiredCourseId: string }
      | { type: "volume"; requiredFreeCoursesCount: number }
    >(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    schoolSubjectGradeIdx: index("courses_school_subject_grade_idx").on(
      t.schoolId,
      t.subjectId,
      t.gradeId
    ),
  })
);

export const courseDependencies = pgTable(
  "course_dependencies",
  {
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    requiredCourseId: uuid("required_course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.courseId, t.requiredCourseId] }),
    depIdx: index("course_dependencies_req_idx").on(t.requiredCourseId),
  })
);

export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    type: activityTypeEnum("type").notNull(),
    title: varchar("title", { length: 256 }).notNull(),
    description: text("description"),
    position: integer("position").notNull().default(0),
    /** Configuración específica por tipo:
     *  video: { vimeoId, durationSec, triggerGame: bool }
     *  game_*: { threeJsAssetUrl, fallbackImageUrl }
     *  quiz: { questions: [...], passingScore }
     */
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    isGradable: boolean("is_gradable").notNull().default(false),
    /** 
     * Regla de desbloqueo a nivel actividad. Misma forma que en cursos.
     *  { type: "activity", requiredActivityId: "..." }
     */
    unlockRule: jsonb("unlock_rule").$type<
      | null
      | { type: "activity"; requiredActivityId: string }
    >(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    coursePosUniq: uniqueIndex("activities_course_pos_uniq").on(t.courseId, t.position),
  })
);

export const activityDependencies = pgTable(
  "activity_dependencies",
  {
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    requiredActivityId: uuid("required_activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.activityId, t.requiredActivityId] }),
  })
);

// ============================================================================
// 8.3 BIBLIOTECA DE CONTENIDO
// ============================================================================
export const contentLibraryItems = pgTable(
  "content_library_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Item origen en Core; puede ser null si el item lo generó la escuela. */
    coreItemId: varchar("core_item_id", { length: 128 }),
    ownerSchoolId: uuid("owner_school_id").references(() => schools.id, {
      onDelete: "set null",
    }),
    type: activityTypeEnum("type").notNull(),
    title: varchar("title", { length: 256 }).notNull(),
    description: text("description"),
    subjectId: uuid("subject_id").references(() => subjects.id),
    gradeId: uuid("grade_id").references(() => grades.id),
    thumbnailUrl: text("thumbnail_url"),
    assetUrl: text("asset_url"), // se sirve por stream desde Core
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    /** Estado de aprobación por el Super Admin de Core. */
    approvalStatus: varchar("approval_status", { length: 32 })
      .notNull()
      .default("pending"), // pending | approved | rejected
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    subjectGradeIdx: index("content_library_subject_grade_idx").on(t.subjectId, t.gradeId),
    approvalIdx: index("content_library_approval_idx").on(t.approvalStatus),
  })
);

export const courseLibraryLinks = pgTable(
  "course_library_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    activityId: uuid("activity_id").references(() => activities.id, {
      onDelete: "cascade",
    }), // opcional: un item puede asociarse al curso o a una actividad específica
    libraryItemId: uuid("library_item_id")
      .notNull()
      .references(() => contentLibraryItems.id, { onDelete: "cascade" }),
    clonedAt: timestamp("cloned_at", { withTimezone: true }).notNull().defaultNow(),
    clonedBy: uuid("cloned_by").references(() => users.id),
  },
  (t) => ({
    courseItemIdx: index("course_library_links_course_idx").on(t.courseId),
  })
);

// ============================================================================
// 8.4 PROGRESO Y EVALUACIÓN
// ============================================================================
export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    // ---- Progreso (2 campos separados) ----
    completionStatus: completionStatusEnum("completion_status")
      .notNull()
      .default("not_started"),
    score: numeric("score", { precision: 5, scale: 2 }), // null si no es calificable
    // ---- Materialización de desbloqueo ----
    isUnlocked: boolean("is_unlocked").notNull().default(false),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
    // ---- Ciclo de vida ----
    status: enrollmentStatusEnum("status").notNull().default("active"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    studentCourseUniq: uniqueIndex("enrollments_student_course_uniq").on(
      t.studentId,
      t.courseId
    ),
    courseIdx: index("enrollments_course_idx").on(t.courseId),
    unlockedIdx: index("enrollments_unlocked_idx").on(t.studentId, t.isUnlocked),
  })
);

export const activityProgress = pgTable(
  "activity_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    // ---- Progreso (2 campos separados) ----
    completionStatus: completionStatusEnum("completion_status")
      .notNull()
      .default("not_started"),
    score: numeric("score", { precision: 5, scale: 2 }), // null si no es calificable
    // ---- Materialización de desbloqueo ----
    isUnlocked: boolean("is_unlocked").notNull().default(false),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
    // ---- Ciclo de vida ----
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** Para reanudar video/juego: segundos donde quedó. */
    resumePositionSec: integer("resume_position_sec").default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    studentActivityUniq: uniqueIndex("activity_progress_student_activity_uniq").on(
      t.studentId,
      t.activityId
    ),
    activityIdx: index("activity_progress_activity_idx").on(t.activityId),
    unlockedIdx: index("activity_progress_unlocked_idx").on(t.studentId, t.isUnlocked),
  })
);

export const activityAttempts = pgTable(
  "activity_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    /** Respuesta o payload del intento (para IA de reforzamiento). */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    score: numeric("score", { precision: 5, scale: 2 }),
    passed: boolean("passed"),
    /** ID de una explicación generada por IA (si aplica). */
    aiExplanationCacheKey: varchar("ai_explanation_cache_key", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    studentActivityIdx: index("activity_attempts_student_activity_idx").on(
      t.studentId,
      t.activityId
    ),
    attemptUniq: uniqueIndex("activity_attempts_student_activity_num_uniq").on(
      t.studentId,
      t.activityId,
      t.attemptNumber
    ),
  })
);

export const gradebookEntries = pgTable(
  "gradebook_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    period: varchar("period", { length: 32 }).notNull(), // "trimester-1", "final", etc.
    score: numeric("score", { precision: 5, scale: 2 }).notNull(),
    maxScore: numeric("max_score", { precision: 5, scale: 2 }).notNull().default("100"),
    gradedBy: uuid("graded_by").references(() => users.id),
    gradedAt: timestamp("graded_at", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
  },
  (t) => ({
    uniq: uniqueIndex("gradebook_student_course_period_uniq").on(
      t.studentId,
      t.courseId,
      t.period
    ),
  })
);

export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    serial: varchar("serial", { length: 64 }).notNull().unique(),
    pdfUrl: text("pdf_url"),
  },
  (t) => ({
    uniq: uniqueIndex("certificates_student_course_uniq").on(t.studentId, t.courseId),
  })
);

// ============================================================================
// 8.5 ACTIVIDADES ESPECIALES
// ============================================================================
export const familyActivities = pgTable("family_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Puede estar ligada a un curso concreto o ser independiente.
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  instructions: text("instructions"),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  dueAt: timestamp("due_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const familyActivitySubmissions = pgTable(
  "family_activity_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyActivityId: uuid("family_activity_id")
      .notNull()
      .references(() => familyActivities.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    feedback: text("feedback"),
  },
  (t) => ({
    uniq: uniqueIndex("family_submission_uniq").on(
      t.familyActivityId,
      t.parentId,
      t.studentId
    ),
  })
);

export const groupActivities = pgTable("group_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
  teacherId: uuid("teacher_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 256 }).notNull(),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groupActivityResults = pgTable(
  "group_activity_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupActivityId: uuid("group_activity_id")
      .notNull()
      .references(() => groupActivities.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    result: jsonb("result").$type<Record<string, unknown>>().notNull().default({}),
    score: numeric("score", { precision: 5, scale: 2 }),
    evaluatedBy: uuid("evaluated_by").references(() => users.id),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true }),
  },
  (t) => ({
    uniq: uniqueIndex("group_activity_results_uniq").on(t.groupActivityId, t.studentId),
  })
);

// ============================================================================
// 8.6 OPERACIÓN Y TELEMETRÍA
// ============================================================================
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 128 }).notNull(), // "school.blocked", "grade.updated", "unlock_rule.changed" ...
    entityType: varchar("entity_type", { length: 64 }),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ip: varchar("ip", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    schoolTimeIdx: index("audit_log_school_time_idx").on(t.schoolId, t.createdAt),
    actionIdx: index("audit_log_action_idx").on(t.action),
  })
);

export const licenseState = pgTable("license_state", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" })
    .unique(),
  /** JWT firmado por Core, guardado para operar offline. */
  licenseJwt: text("license_jwt").notNull(),
  plan: varchar("plan", { length: 64 }).notNull(),
  status: licenseStatusEnum("status").notNull().default("active"),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
  validUntil: timestamp("valid_until", { withTimezone: true }).notNull(), // +1 año
  /** Contenido permitido por contrato. */
  allowedContentIds: jsonb("allowed_content_ids").$type<string[]>().notNull().default([]),
  /** Último heartbeat exitoso con Core. */
  lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
  /** Hasta cuándo puede operar offline. */
  offlineGraceUntil: timestamp("offline_grace_until", { withTimezone: true }),
  /** Motivo del bloqueo actual (si status es blocked). */
  blockedReason: text("blocked_reason"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const telemetryAggregates = pgTable(
  "telemetry_aggregates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    /** Ventana temporal del agregado. */
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    /** Tipo de agregado: "operations" | "group_performance" */
    kind: varchar("kind", { length: 32 }).notNull(),
    /** Datos agregados SIN PII. Ej:
     *  operations: { activeUsers: 120, sessionsCount: 340, averageSessionMin: 22 }
     *  group_performance: { groupId, courseId, avgCompletionRate: 0.82, avgScore: 78.5 }
     */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    /** Flag de envío a Core (para el heartbeat). */
    sentToCore: boolean("sent_to_core").notNull().default(false),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    schoolKindPeriodIdx: index("telemetry_school_kind_period_idx").on(
      t.schoolId,
      t.kind,
      t.periodStart
    ),
  })
);

// ============================================================================
// SESIONES EN VIVO
// ============================================================================

export const sessionModeEnum = pgEnum("session_mode", [
  "in_person",
  "virtual",
  "hybrid",
]);

export const sessionStatusEnum = pgEnum("session_status", [
  "scheduled",
  "live",
  "ended",
  "cancelled",
]);

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "absent",
  "late",
  "excused",
]);

export const classSessions = pgTable(
  "class_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    /** Opcional: aula/grupo escolar que asiste. null = todos los inscritos. */
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 200 }).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    mode: sessionModeEnum("mode").notNull().default("in_person"),
    status: sessionStatusEnum("status").notNull().default("scheduled"),
    location: varchar("location", { length: 255 }),
    virtualUrl: text("virtual_url"),
    notes: text("notes"),
    createdById: uuid("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    courseIdx: index("class_sessions_course_idx").on(t.courseId),
    startsIdx: index("class_sessions_starts_idx").on(t.startsAt),
    teacherIdx: index("class_sessions_teacher_idx").on(t.teacherId),
    statusIdx: index("class_sessions_status_idx").on(t.status),
  })
);

export const sessionAttendance = pgTable(
  "session_attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => classSessions.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: attendanceStatusEnum("status").notNull().default("absent"),
    markedById: uuid("marked_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    markedAt: timestamp("marked_at", { withTimezone: true }).notNull().defaultNow(),
    notes: varchar("notes", { length: 255 }),
  },
  (t) => ({
    sessionStudentUniq: uniqueIndex("session_attendance_session_student_uniq").on(
      t.sessionId,
      t.studentId
    ),
    sessionIdx: index("session_attendance_session_idx").on(t.sessionId),
    studentIdx: index("session_attendance_student_idx").on(t.studentId),
  })
);


// ============================================================================
// RELACIONES (para drizzle-orm/relations)
// ============================================================================
export const schoolsRelations = relations(schools, ({ many, one }) => ({
  users: many(users),
  groups: many(groups),
  courses: many(courses),
  license: one(licenseState, {
    fields: [schools.id],
    references: [licenseState.schoolId],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  school: one(schools, {
    fields: [users.schoolId],
    references: [schools.id],
  }),
  userRoles: many(userRoles),
  enrollments: many(enrollments),
  activityProgress: many(activityProgress),
  attempts: many(activityAttempts),
  groupsAsTeacher: many(groups),
  groupMemberships: many(groupMembers),
  parentLinks: many(parentStudentLinks, { relationName: "parentLinks" }),
  childLinks: many(parentStudentLinks, { relationName: "childLinks" }),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  school: one(schools, {
    fields: [courses.schoolId],
    references: [schools.id],
  }),
  subject: one(subjects, {
    fields: [courses.subjectId],
    references: [subjects.id],
  }),
  grade: one(grades, {
    fields: [courses.gradeId],
    references: [grades.id],
  }),
  activities: many(activities),
  enrollments: many(enrollments),
  dependencies: many(courseDependencies, { relationName: "deps" }),
  dependents: many(courseDependencies, { relationName: "reverseDeps" }),
}));

export const activitiesRelations = relations(activities, ({ one, many }) => ({
  course: one(courses, {
    fields: [activities.courseId],
    references: [courses.id],
  }),
  progress: many(activityProgress),
  attempts: many(activityAttempts),
  dependencies: many(activityDependencies, { relationName: "deps" }),
  dependents: many(activityDependencies, { relationName: "reverseDeps" }),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  student: one(users, {
    fields: [enrollments.studentId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [enrollments.courseId],
    references: [courses.id],
  }),
}));

export const activityProgressRelations = relations(activityProgress, ({ one }) => ({
  student: one(users, {
    fields: [activityProgress.studentId],
    references: [users.id],
  }),
  activity: one(activities, {
    fields: [activityProgress.activityId],
    references: [activities.id],
  }),
}));
