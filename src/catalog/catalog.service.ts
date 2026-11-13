import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import { DB } from "../db/db.module";
import type { DrizzleDb } from "../db/db.module";
import { levels, grades, subjects } from "../db/schema";
import type { CreateSubjectDto } from "./dto/create-subject.dto";

@Injectable()
export class CatalogService {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  // ---------- Levels ----------
  listLevels() {
    return this.db
      .select()
      .from(levels)
      .orderBy(levels.sortOrder);
  }

  // ---------- Grades ----------
  async listGrades(levelId?: string) {
    if (levelId) {
      return this.db
        .select()
        .from(grades)
        .where(eq(grades.levelId, levelId))
        .orderBy(grades.sortOrder);
    }
    return this.db.select().from(grades).orderBy(grades.sortOrder);
  }

  // ---------- Subjects ----------
  listSubjects() {
    return this.db.select().from(subjects).orderBy(subjects.name);
  }

  async createSubject(dto: CreateSubjectDto) {
    const exists = await this.db
      .select({ id: subjects.id })
      .from(subjects)
      .where(eq(subjects.slug, dto.slug))
      .limit(1);
    if (exists.length) {
      throw new ConflictException(`Subject con slug '${dto.slug}' ya existe`);
    }

    const [created] = await this.db
      .insert(subjects)
      .values({
        name: dto.name,
        slug: dto.slug,
        color: dto.color,
        iconUrl: dto.iconUrl,
      })
      .returning();

    return created;
  }
}

