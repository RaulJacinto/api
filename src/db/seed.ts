import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";   
import { roles, levels, subjects, grades } from "./schema";
import "dotenv/config";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  await db.insert(roles).values([
    { name: "super_admin" },
    { name: "instructor" },
    { name: "school_admin" },
    { name: "teacher" },
    { name: "student" },
    { name: "parent" },
  ]).onConflictDoNothing();

  await db.insert(levels).values([
    { name: "kinder", displayName: "Kinder", sortOrder: 1 },
    { name: "primaria", displayName: "Primaria", sortOrder: 2 },
    { name: "secundaria", displayName: "Secundaria", sortOrder: 3 },
    { name: "prepa", displayName: "Prepa", sortOrder: 4 },
    { name: "superior", displayName: "Superior", sortOrder: 5 },
    { name: "otra", displayName: "Otra", sortOrder: 6 },
  ]).onConflictDoNothing();

// --- Subjects base ---
  await db
    .insert(subjects)
    .values([
      { name: "Matemáticas", slug: "matematicas", color: "#4A90E2" },
      { name: "Español", slug: "espanol", color: "#E94B3C" },
      { name: "Ciencias Naturales", slug: "ciencias-naturales", color: "#50B83C" },
      { name: "Ciencias Sociales", slug: "ciencias-sociales", color: "#F5A623" },
      { name: "Valores", slug: "valores", color: "#9B51E0" },
      { name: "Inglés", slug: "ingles", color: "#FF6B6B" },
      { name: "Arte", slug: "arte", color: "#FFD93D" },
      { name: "Educación Física", slug: "educacion-fisica", color: "#6BCF7F" },
    ])
    .onConflictDoNothing();
const [primaria] = await db
    .select()
    .from(levels)
    .where(eq(levels.name, "primaria"))
    .limit(1);

  if (primaria) {
    await db
      .insert(grades)
      .values([
        { levelId: primaria.id, name: "1º", sortOrder: 1 },
        { levelId: primaria.id, name: "2º", sortOrder: 2 },
        { levelId: primaria.id, name: "3º", sortOrder: 3 },
        { levelId: primaria.id, name: "4º", sortOrder: 4 },
        { levelId: primaria.id, name: "5º", sortOrder: 5 },
        { levelId: primaria.id, name: "6º", sortOrder: 6 },
      ])
      .onConflictDoNothing();
  }

  console.log("✅ Seed ok: roles + levels + subjects + grades");

  console.log("✅ Seed ok: roles + levels + subjects");
  await pool.end();
}

main();
