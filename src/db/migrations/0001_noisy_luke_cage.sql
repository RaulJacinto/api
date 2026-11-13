CREATE TYPE "public"."attendance_status" AS ENUM('present', 'absent', 'late', 'excused');--> statement-breakpoint
CREATE TYPE "public"."session_mode" AS ENUM('in_person', 'virtual', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('scheduled', 'live', 'ended', 'cancelled');--> statement-breakpoint
CREATE TABLE "class_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"group_id" uuid,
	"teacher_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"mode" "session_mode" DEFAULT 'in_person' NOT NULL,
	"status" "session_status" DEFAULT 'scheduled' NOT NULL,
	"location" varchar(255),
	"virtual_url" text,
	"notes" text,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" "attendance_status" DEFAULT 'absent' NOT NULL,
	"marked_by_id" uuid,
	"marked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" varchar(255)
);
--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_attendance" ADD CONSTRAINT "session_attendance_session_id_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_attendance" ADD CONSTRAINT "session_attendance_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_attendance" ADD CONSTRAINT "session_attendance_marked_by_id_users_id_fk" FOREIGN KEY ("marked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "class_sessions_course_idx" ON "class_sessions" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "class_sessions_starts_idx" ON "class_sessions" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "class_sessions_teacher_idx" ON "class_sessions" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "class_sessions_status_idx" ON "class_sessions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "session_attendance_session_student_uniq" ON "session_attendance" USING btree ("session_id","student_id");--> statement-breakpoint
CREATE INDEX "session_attendance_session_idx" ON "session_attendance" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "session_attendance_student_idx" ON "session_attendance" USING btree ("student_id");