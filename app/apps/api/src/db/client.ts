import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL est absent de l'environnement. " +
      "Copier `.env.example` en `.env` a la racine du depot, puis relancer.",
  );
}

/**
 * Pool de connexions unique pour tout le process.
 * `postgres` (postgres.js) parametre systematiquement les requetes : les valeurs
 * interpolees dans un template tagge deviennent des placeholders $1, $2...
 * Aucune concatenation de chaine SQL n'est possible par ce biais.
 */
export const sql = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

/**
 * Instance Drizzle partagee. Les requetes passent par le query builder, jamais
 * par de la concatenation de chaine : cf. la checklist de la phase 9.
 */
export const db = drizzle(sql);

/**
 * Verifie que la base repond reellement, via un aller-retour SQL complet.
 * Ne se contente pas de tester que le pool existe.
 */
export async function pingDatabase(): Promise<boolean> {
  const rows = await sql<{ ok: number }[]>`SELECT 1 AS ok`;
  return rows[0]?.ok === 1;
}

export async function closeDatabase(): Promise<void> {
  await sql.end({ timeout: 5 });
}
