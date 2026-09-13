import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import { type AppConfig, loadConfig } from "../../src/config.js";
import { closeDatabase, pingDatabase } from "../../src/db/client.js";

/**
 * Harnais des tests d'API.
 *
 * Ces tests ont BESOIN d'une base peuplee. Ils ne se sautent pas en silence
 * quand elle manque : un test qui se desactive tout seul est un test qui ment.
 * Ils echouent, avec la commande a taper.
 *
 * C'est aussi la raison des deux scripts distincts :
 *   `pnpm test:unit` -> le jeu de tests du dataset, sans infrastructure
 *   `pnpm test:api`  -> celui-ci, qui exige Docker
 *   `pnpm test`      -> les deux
 */

export const EXPECTED_ROOMS = 714;

export async function assertDatabaseReady(): Promise<void> {
  let reachable = false;
  try {
    reachable = await pingDatabase();
  } catch (error) {
    throw new Error(
      "Base inaccessible. Les tests d'API ne se sautent pas : ils echouent.\n" +
        "  docker compose up -d\n" +
        "  pnpm --filter @thm/api db:migrate && pnpm --filter @thm/api db:seed\n" +
        "  pnpm data:import --apply\n" +
        `Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!reachable) throw new Error("La base repond mais `SELECT 1` n'a pas rendu 1.");
}

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return { ...loadConfig({ ...process.env, NODE_ENV: "test" }), ...overrides };
}

export async function buildTestApp(overrides: Partial<AppConfig> = {}): Promise<FastifyInstance> {
  const app = await buildApp(testConfig(overrides));
  await app.ready();
  return app;
}

export async function closeTestResources(app: FastifyInstance): Promise<void> {
  await app.close();
}

export { closeDatabase };
