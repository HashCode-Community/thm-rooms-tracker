import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * `pnpm db:migrate`
 *
 * Cree les extensions requises, puis joue les migrations versionnees.
 *
 * Les extensions ne sont pas gerees par drizzle-kit : le SQL genere utilise
 * `citext` et `gin_trgm_ops`, et echouerait sans elles. Les creer ici, en amont
 * et de facon idempotente, evite une migration manuelle a maintenir a la main
 * et garantit que l'ordre est le bon sur une base vierge comme sur une base
 * existante.
 *
 * Connexion dediee avec `max: 1` : le migrateur pose des verrous, un pool
 * multiplierait les connexions pour rien.
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL absent. Copier `.env.example` en `.env` a la racine du depot.");
}

const REQUIRED_EXTENSIONS = [
  // Recherche tolerante aux fautes de frappe : index trigram sur rooms.title,
  // utilise en repli quand websearch_to_tsquery ne ramene rien.
  { name: "pg_trgm", why: "index trigram sur rooms.title" },
  // Comparaison insensible a la casse sur users.email UNIQUEMENT.
  // Surtout pas sur rooms.code : cf. ADR-0001 Q1.
  { name: "citext", why: "users.email insensible a la casse" },
] as const;

const sql = postgres(connectionString, { max: 1 });

try {
  console.log("\nExtensions");
  for (const extension of REQUIRED_EXTENSIONS) {
    // Identifiant litteral, pas d'interpolation de variable : la liste est close
    // et definie dans ce fichier.
    if (extension.name === "pg_trgm") {
      await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
    } else {
      await sql`CREATE EXTENSION IF NOT EXISTS citext`;
    }
    console.log(`  ok  ${extension.name.padEnd(10)} ${extension.why}`);
  }

  console.log("\nMigrations");
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: resolve(import.meta.dirname, "migrations") });
  console.log("  ok  migrations appliquees");

  const tables = await sql<{ table_name: string }[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  console.log(`\n${tables.length} tables en base :`);
  console.log(tables.map((t) => `  ${t.table_name}`).join("\n"));
  console.log("");
} catch (error) {
  console.error("\nEchec de la migration :", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
