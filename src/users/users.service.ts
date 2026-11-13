import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as argon2 from "argon2";
import { and, eq, inArray } from "drizzle-orm";
import { DB } from "../db/db.module";
import type { DrizzleDb } from "../db/db.module";
import {
  users,
  roles as rolesTable,
  userRoles,
  parentStudentLinks,
} from "../db/schema";
import type { CreateUserDto } from "./dto/create-user.dto";
import type { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  private async findRoleIdByName(name: string): Promise<string> {
    const [role] = await this.db
      .select({ id: rolesTable.id })
      .from(rolesTable)
      .where(eq(rolesTable.name, name as any))
      .limit(1);
    if (!role) throw new BadRequestException(`Rol '${name}' no existe (falta seed)`);
    return role.id;
  }

  async create(schoolId: string, dto: CreateUserDto) {
    if (!schoolId) throw new ForbiddenException("Usuario sin escuela");

    // Evitar duplicados email dentro de la misma escuela
    const dup = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.schoolId, schoolId), eq(users.email, dto.email)))
      .limit(1);
    if (dup.length) throw new BadRequestException("Email ya existe en esta escuela");

    const passwordHash = await argon2.hash(dto.password);
    const roleId = await this.findRoleIdByName(dto.role);

    // Si es parent, validar que los alumnos existan en la misma escuela
    if (dto.role === "parent" && dto.studentIds?.length) {
      const students = await this.db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.schoolId, schoolId), inArray(users.id, dto.studentIds)));

      if (students.length !== dto.studentIds.length) {
        throw new BadRequestException("Uno o más studentIds no existen en esta escuela");
      }
    }

    return await this.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          schoolId,
          email: dto.email,
          passwordHash,
          displayName: dto.displayName,
        })
        .returning({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          schoolId: users.schoolId,
          isActive: users.isActive,
          createdAt: users.createdAt,
        });

      await tx.insert(userRoles).values({
        userId: user.id,
        roleId,
        scopeSchoolId: schoolId,
      });

      if (dto.role === "parent" && dto.studentIds?.length) {
        await tx.insert(parentStudentLinks).values(
          dto.studentIds.map((sid) => ({
            parentId: user.id,
            studentId: sid,
            verified: false,
          }))
        );
      }

      return { ...user, roles: [dto.role] };
    });
  }

  async list(schoolId: string, page = 1, pageSize = 20) {
    if (!schoolId) throw new ForbiddenException("Usuario sin escuela");

    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.schoolId, schoolId))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // cargar roles por usuario
    const ids = rows.map((r) => r.id);
    const rolesMap: Record<string, string[]> = {};
    if (ids.length) {
      const roleRows = await this.db
        .select({ userId: userRoles.userId, role: rolesTable.name })
        .from(userRoles)
        .innerJoin(rolesTable, eq(userRoles.roleId, rolesTable.id))
        .where(inArray(userRoles.userId, ids));
      for (const r of roleRows) {
        rolesMap[r.userId] ??= [];
        rolesMap[r.userId].push(r.role);
      }
    }
    return rows.map((r) => ({ ...r, roles: rolesMap[r.id] ?? [] }));
  }

  async getById(schoolId: string, id: string) {
    const [u] = await this.db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        isActive: users.isActive,
        schoolId: users.schoolId,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(eq(users.id, id), eq(users.schoolId, schoolId)))
      .limit(1);
    if (!u) throw new NotFoundException("Usuario no encontrado");

    const roleRows = await this.db
      .select({ role: rolesTable.name })
      .from(userRoles)
      .innerJoin(rolesTable, eq(userRoles.roleId, rolesTable.id))
      .where(eq(userRoles.userId, id));

    return { ...u, roles: roleRows.map((r) => r.role) };
  }

  async update(schoolId: string, id: string, dto: UpdateUserDto) {
    const existing = await this.getById(schoolId, id); // valida pertenencia
    if (existing.roles.includes("school_admin") && dto.isActive === false) {
      throw new BadRequestException("No se puede desactivar a un school_admin");
    }

    const [updated] = await this.db
      .update(users)
      .set({ isActive: dto.isActive, updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.schoolId, schoolId)))
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        isActive: users.isActive,
      });

    return { ...updated, roles: existing.roles };
  }

  async linkParent(schoolId: string, parentId: string, studentId: string) {
    // validar que ambos existan en la misma escuela
    const [p] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, parentId), eq(users.schoolId, schoolId)))
      .limit(1);
    const [s] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, studentId), eq(users.schoolId, schoolId)))
      .limit(1);
    if (!p || !s) throw new BadRequestException("Padre o alumno inválido");

    await this.db
      .insert(parentStudentLinks)
      .values({ parentId, studentId, verified: false })
      .onConflictDoNothing();

    return { ok: true };
  }
}
