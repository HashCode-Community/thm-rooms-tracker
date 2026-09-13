import { DIFFICULTIES, DIFFICULTY_LEVEL, ROOM_TYPES, TEAMS } from "@thm/shared";
import { sql as drizzleSql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { difficulties, roomTypes, teams } from "./schema.js";

/**
 * `pnpm db:seed`
 *
 * Peuple les trois referentiels a valeurs fermees. Idempotent : relancable sans
 * effet de bord, `onConflictDoUpdate` sur la cle naturelle.
 *
 * Les cles viennent de `@thm/shared`, donc du contrat Zod, donc du JSON Schema.
 * Une valeur ajoutee par TryHackMe ne peut pas apparaitre ici sans passer
 * d'abord par le contrat : c'est voulu.
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL absent. Copier `.env.example` en `.env` a la racine du depot.");
}

const LABELS: Record<string, string> = {
  info: "Informatif",
  easy: "Facile",
  medium: "Intermediaire",
  hard: "Difficile",
  insane: "Extreme",
  walkthrough: "Guide",
  challenge: "Defi",
  Red: "Offensive",
  Blue: "Defensive",
  Purple: "Mixte",
};

/**
 * Couleurs d'accent. Elles ne sont JAMAIS l'unique porteur d'information :
 * chaque badge porte aussi son libelle. Contrastes choisis pour rester >= 4.5:1
 * sur fond clair, a verifier en phase 6 avec le design reel.
 */
const TEAM_COLORS: Record<string, string> = {
  Red: "#b3261e",
  Blue: "#1b5e9e",
  Purple: "#6b3fa0",
};

/**
 * `excluded.<col>` dans un ON CONFLICT DO UPDATE, exprime avec le template SQL
 * de Drizzle. Volontairement PAS `sql.unsafe(\`excluded.${col}\`)` : une chaine
 * construite ressemble a de la concatenation SQL, et la phase 9 doit pouvoir
 * prouver par grep qu'il n'y en a aucune dans le depot.
 */
const excluded = {
  label: drizzleSql`excluded.label`,
  level: drizzleSql`excluded.level`,
  color: drizzleSql`excluded.color`,
};

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

try {
  await db.transaction(async (tx) => {
    await tx
      .insert(difficulties)
      .values(
        DIFFICULTIES.map((key) => ({
          key,
          label: LABELS[key] ?? key,
          level: DIFFICULTY_LEVEL[key],
        })),
      )
      .onConflictDoUpdate({
        target: difficulties.key,
        set: {
          label: excluded.label,
          level: excluded.level,
        },
      });

    await tx
      .insert(roomTypes)
      .values(ROOM_TYPES.map((key) => ({ key, label: LABELS[key] ?? key })))
      .onConflictDoUpdate({ target: roomTypes.key, set: { label: excluded.label } });

    await tx
      .insert(teams)
      .values(
        TEAMS.map((key) => ({
          key,
          label: LABELS[key] ?? key,
          color: TEAM_COLORS[key] ?? "#555555",
        })),
      )
      .onConflictDoUpdate({
        target: teams.key,
        set: { label: excluded.label, color: excluded.color },
      });
  });

  const rows = await sql<{ key: string; label: string; level: number | null }[]>`
    SELECT key, label, level FROM difficulties ORDER BY level
  `;
  console.log("\ndifficulties (triees par level, ce que l'enum texte ne permet pas) :");
  for (const row of rows) console.log(`  ${row.level}  ${row.key.padEnd(8)} ${row.label}`);

  const types = await sql<{ key: string; label: string }[]>`
    SELECT key, label FROM room_types ORDER BY key
  `;
  console.log("\nroom_types :");
  for (const row of types) console.log(`     ${row.key.padEnd(12)} ${row.label}`);

  const teamRows = await sql<{ key: string; label: string; color: string }[]>`
    SELECT key, label, color FROM teams ORDER BY key
  `;
  console.log("\nteams :");
  for (const row of teamRows)
    console.log(`     ${row.key.padEnd(8)} ${row.label.padEnd(10)} ${row.color}`);
  console.log("");
} catch (error) {
  console.error("\nEchec du seed :", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
