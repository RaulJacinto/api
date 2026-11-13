CREATE TYPE "public"."activity_type" AS ENUM('video', 'game_standalone', 'game_after_video', 'quiz', 'reading', 'family', 'group');--> statement-breakpoint
CREATE TYPE "public"."completion_status" AS ENUM('not_started', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'dropped', 'completed');--> statement-breakpoint
CREATE TYPE "public"."level" AS ENUM('kinder', 'primaria', 'secundaria', 'prepa', 'superior', 'otra');--> statement-breakpoint
CREATE TYPE "public"."license_status" AS ENUM('active', 'blocked', 'expired', 'grace_offline');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'instructor', 'school_admin', 'teacher', 'student', 'parent');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"type" "activity_type" NOT NULL,
	"title" varchar(256) NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_gradable" boolean DEFAULT false NOT NULL,
	"unlock_rule" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"activity_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"score" numeric(5, 2),
	"passed" boolean,
	"ai_explanation_cache_key" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_dependencies" (
	"activity_id" uuid NOT NULL,
	"required_activity_id" uuid NOT NULL,
	CONSTRAINT "activity_dependencies_activity_id_required_activity_id_pk" PRIMARY KEY("activity_id","required_activity_id")
);
--> statement-breakpoint
CREATE TABLE "activity_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"activity_id" uuid NOT NULL,
	"completion_status" "completion_status" DEFAULT 'not_started' NOT NULL,
	"score" numeric(5, 2),
	"is_unlocked" boolean DEFAULT false NOT NULL,
	"unlocked_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"resume_position_sec" integer DEFAULT 0,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid,
	"actor_id" uuid,
	"action" varchar(128) NOT NULL,
	"entity_type" varchar(64),
	"entity_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"serial" varchar(64) NOT NULL,
	"pdf_url" text,
	CONSTRAINT "certificates_serial_unique" UNIQUE("serial")
);
--> statement-breakpoint
CREATE TABLE "content_library_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"core_item_id" varchar(128),
	"owner_school_id" uuid,
	"type" "activity_type" NOT NULL,
	"title" varchar(256) NOT NULL,
	"description" text,
	"subject_id" uuid,
	"grade_id" uuid,
	"thumbnail_url" text,
	"asset_url" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"approval_status" varchar(32) DEFAULT 'pending' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_dependencies" (
	"course_id" uuid NOT NULL,
	"required_course_id" uuid NOT NULL,
	CONSTRAINT "course_dependencies_course_id_required_course_id_pk" PRIMARY KEY("course_id","required_course_id")
);
--> statement-breakpoint
CREATE TABLE "course_library_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"activity_id" uuid,
	"library_item_id" uuid NOT NULL,
	"cloned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cloned_by" uuid
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"core_course_id" varchar(128),
	"school_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"grade_id" uuid NOT NULL,
	"title" varchar(256) NOT NULL,
	"description" text,
	"cover_url" text,
	"is_gradable" boolean DEFAULT false NOT NULL,
	"is_mandatory" boolean DEFAULT false NOT NULL,
	"unlock_rule" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"completion_status" "completion_status" DEFAULT 'not_started' NOT NULL,
	"score" numeric(5, 2),
	"is_unlocked" boolean DEFAULT false NOT NULL,
	"unlocked_at" timestamp with time zone,
	"status" "enrollment_status" DEFAULT 'active' NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid,
	"title" varchar(256) NOT NULL,
	"description" text,
	"instructions" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_activity_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_activity_id" uuid NOT NULL,
	"parent_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"feedback" text
);
--> statement-breakpoint
CREATE TABLE "gradebook_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"period" varchar(32) NOT NULL,
	"score" numeric(5, 2) NOT NULL,
	"max_score" numeric(5, 2) DEFAULT '100' NOT NULL,
	"graded_by" uuid,
	"graded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level_id" uuid NOT NULL,
	"name" varchar(32) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"course_id" uuid,
	"teacher_id" uuid NOT NULL,
	"title" varchar(256) NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_activity_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_activity_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"score" numeric(5, 2),
	"evaluated_by" uuid,
	"evaluated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"group_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_members_group_id_student_id_pk" PRIMARY KEY("group_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"teacher_id" uuid,
	"academic_year" varchar(16) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" "level" NOT NULL,
	"display_name" varchar(64) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "levels_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "license_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"license_jwt" text NOT NULL,
	"plan" varchar(64) NOT NULL,
	"status" "license_status" DEFAULT 'active' NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"allowed_content_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_heartbeat_at" timestamp with time zone,
	"offline_grace_until" timestamp with time zone,
	"blocked_reason" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "license_state_school_id_unique" UNIQUE("school_id")
);
--> statement-breakpoint
CREATE TABLE "parent_student_links" (
	"parent_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"relationship" varchar(64),
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parent_student_links_parent_id_student_id_pk" PRIMARY KEY("parent_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" "user_role" NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"core_school_id" varchar(128) NOT NULL,
	"name" varchar(256) NOT NULL,
	"slug" varchar(128) NOT NULL,
	"branding" jsonb DEFAULT '{}'::jsonb,
	"timezone" varchar(64) DEFAULT 'America/Mexico_City' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schools_core_school_id_unique" UNIQUE("core_school_id"),
	CONSTRAINT "schools_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"slug" varchar(128) NOT NULL,
	"color" varchar(16),
	"icon_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subjects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "telemetry_aggregates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"kind" varchar(32) NOT NULL,
	"payload" jsonb NOT NULL,
	"sent_to_core" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"scope_school_id" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_scope_school_id_pk" PRIMARY KEY("user_id","role_id","scope_school_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid,
	"email" varchar(256) NOT NULL,
	"password_hash" text,
	"display_name" varchar(128) NOT NULL,
	"avatar_url" text,
	"date_of_birth" timestamp,
	"locale" varchar(10) DEFAULT 'es' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_attempts" ADD CONSTRAINT "activity_attempts_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_attempts" ADD CONSTRAINT "activity_attempts_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_dependencies" ADD CONSTRAINT "activity_dependencies_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_dependencies" ADD CONSTRAINT "activity_dependencies_required_activity_id_activities_id_fk" FOREIGN KEY ("required_activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_progress" ADD CONSTRAINT "activity_progress_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_progress" ADD CONSTRAINT "activity_progress_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_library_items" ADD CONSTRAINT "content_library_items_owner_school_id_schools_id_fk" FOREIGN KEY ("owner_school_id") REFERENCES "public"."schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_library_items" ADD CONSTRAINT "content_library_items_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_library_items" ADD CONSTRAINT "content_library_items_grade_id_grades_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_library_items" ADD CONSTRAINT "content_library_items_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_library_items" ADD CONSTRAINT "content_library_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_dependencies" ADD CONSTRAINT "course_dependencies_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_dependencies" ADD CONSTRAINT "course_dependencies_required_course_id_courses_id_fk" FOREIGN KEY ("required_course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_library_links" ADD CONSTRAINT "course_library_links_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_library_links" ADD CONSTRAINT "course_library_links_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_library_links" ADD CONSTRAINT "course_library_links_library_item_id_content_library_items_id_fk" FOREIGN KEY ("library_item_id") REFERENCES "public"."content_library_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_library_links" ADD CONSTRAINT "course_library_links_cloned_by_users_id_fk" FOREIGN KEY ("cloned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_grade_id_grades_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_activities" ADD CONSTRAINT "family_activities_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_activity_submissions" ADD CONSTRAINT "family_activity_submissions_family_activity_id_family_activities_id_fk" FOREIGN KEY ("family_activity_id") REFERENCES "public"."family_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_activity_submissions" ADD CONSTRAINT "family_activity_submissions_parent_id_users_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_activity_submissions" ADD CONSTRAINT "family_activity_submissions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_activity_submissions" ADD CONSTRAINT "family_activity_submissions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gradebook_entries" ADD CONSTRAINT "gradebook_entries_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gradebook_entries" ADD CONSTRAINT "gradebook_entries_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gradebook_entries" ADD CONSTRAINT "gradebook_entries_graded_by_users_id_fk" FOREIGN KEY ("graded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_activities" ADD CONSTRAINT "group_activities_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_activities" ADD CONSTRAINT "group_activities_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_activities" ADD CONSTRAINT "group_activities_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_activity_results" ADD CONSTRAINT "group_activity_results_group_activity_id_group_activities_id_fk" FOREIGN KEY ("group_activity_id") REFERENCES "public"."group_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_activity_results" ADD CONSTRAINT "group_activity_results_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_activity_results" ADD CONSTRAINT "group_activity_results_evaluated_by_users_id_fk" FOREIGN KEY ("evaluated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_state" ADD CONSTRAINT "license_state_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_student_links" ADD CONSTRAINT "parent_student_links_parent_id_users_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_student_links" ADD CONSTRAINT "parent_student_links_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry_aggregates" ADD CONSTRAINT "telemetry_aggregates_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_scope_school_id_schools_id_fk" FOREIGN KEY ("scope_school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activities_course_pos_uniq" ON "activities" USING btree ("course_id","position");--> statement-breakpoint
CREATE INDEX "activity_attempts_student_activity_idx" ON "activity_attempts" USING btree ("student_id","activity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_attempts_student_activity_num_uniq" ON "activity_attempts" USING btree ("student_id","activity_id","attempt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_progress_student_activity_uniq" ON "activity_progress" USING btree ("student_id","activity_id");--> statement-breakpoint
CREATE INDEX "activity_progress_activity_idx" ON "activity_progress" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "activity_progress_unlocked_idx" ON "activity_progress" USING btree ("student_id","is_unlocked");--> statement-breakpoint
CREATE INDEX "audit_log_school_time_idx" ON "audit_log" USING btree ("school_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_student_course_uniq" ON "certificates" USING btree ("student_id","course_id");--> statement-breakpoint
CREATE INDEX "content_library_subject_grade_idx" ON "content_library_items" USING btree ("subject_id","grade_id");--> statement-breakpoint
CREATE INDEX "content_library_approval_idx" ON "content_library_items" USING btree ("approval_status");--> statement-breakpoint
CREATE INDEX "course_dependencies_req_idx" ON "course_dependencies" USING btree ("required_course_id");--> statement-breakpoint
CREATE INDEX "course_library_links_course_idx" ON "course_library_links" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "courses_school_subject_grade_idx" ON "courses" USING btree ("school_id","subject_id","grade_id");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_student_course_uniq" ON "enrollments" USING btree ("student_id","course_id");--> statement-breakpoint
CREATE INDEX "enrollments_course_idx" ON "enrollments" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "enrollments_unlocked_idx" ON "enrollments" USING btree ("student_id","is_unlocked");--> statement-breakpoint
CREATE UNIQUE INDEX "family_submission_uniq" ON "family_activity_submissions" USING btree ("family_activity_id","parent_id","student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gradebook_student_course_period_uniq" ON "gradebook_entries" USING btree ("student_id","course_id","period");--> statement-breakpoint
CREATE UNIQUE INDEX "grades_level_name_uniq" ON "grades" USING btree ("level_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "group_activity_results_uniq" ON "group_activity_results" USING btree ("group_activity_id","student_id");--> statement-breakpoint
CREATE INDEX "group_members_student_idx" ON "group_members" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "groups_school_year_name_uniq" ON "groups" USING btree ("school_id","academic_year","name");--> statement-breakpoint
CREATE INDEX "groups_teacher_idx" ON "groups" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "parent_student_links_student_idx" ON "parent_student_links" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "telemetry_school_kind_period_idx" ON "telemetry_aggregates" USING btree ("school_id","kind","period_start");--> statement-breakpoint
CREATE INDEX "user_roles_user_idx" ON "user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_school_uniq" ON "users" USING btree ("school_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_core_uniq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_school_idx" ON "users" USING btree ("school_id");