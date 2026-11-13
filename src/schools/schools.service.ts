import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DB } from "../db/db.module";
import type { DrizzleDb } from "../db/db.module";
import { schools } from "../db/schema";
import type { UpdateBrandingDto } from "./dto/update-branding.dto";

/**
 * Shape del JSONB `branding` en schools.
 */
export type SchoolBranding = {
  logoUrl?: string;
  treeLogoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  address?: string;
};

@Injectable()
export class SchoolsService {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  // ---------- Get (lectura pública para usuarios autenticados) ----------
  async getMe(schoolId: string) {
    if (!schoolId) throw new ForbiddenException("Usuario sin escuela");

    const [school] = await this.db
      .select({
        id: schools.id,
        name: schools.name,
        slug: schools.slug,
        timezone: schools.timezone,
        branding: schools.branding,
        isActive: schools.isActive,
      })
      .from(schools)
      .where(eq(schools.id, schoolId))
      .limit(1);

    if (!school) throw new NotFoundException("Escuela no encontrada");

    return {
      ...school,
      branding: (school.branding ?? {}) as SchoolBranding,
    };
  }

  // ---------- Update branding (solo admin) ----------
  async updateBranding(schoolId: string, dto: UpdateBrandingDto) {
    if (!schoolId) throw new ForbiddenException("Usuario sin escuela");

    const [existing] = await this.db
      .select({ id: schools.id, name: schools.name, branding: schools.branding })
      .from(schools)
      .where(eq(schools.id, schoolId))
      .limit(1);
    if (!existing) throw new NotFoundException("Escuela no encontrada");

    // Merge branding: solo sobreescribe los campos presentes en dto
    const currentBranding = (existing.branding ?? {}) as SchoolBranding;
    const nextBranding: SchoolBranding = {
      ...currentBranding,
      ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
      ...(dto.treeLogoUrl !== undefined && { treeLogoUrl: dto.treeLogoUrl }),
      ...(dto.primaryColor !== undefined && { primaryColor: dto.primaryColor }),
      ...(dto.secondaryColor !== undefined && {
        secondaryColor: dto.secondaryColor,
      }),
      ...(dto.address !== undefined && { address: dto.address }),
    };

    // `name` y `timezone` son columnas, no parte del JSONB
    const [updated] = await this.db
      .update(schools)
      .set({
        name: dto.name ?? existing.name,
        timezone: dto.timezone ?? undefined,
        branding: nextBranding,
      })
      .where(eq(schools.id, schoolId))
      .returning({
        id: schools.id,
        name: schools.name,
        slug: schools.slug,
        timezone: schools.timezone,
        branding: schools.branding,
      });

    return {
      ...updated,
      branding: (updated.branding ?? {}) as SchoolBranding,
    };
  }
}
