import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * `pnpm typecheck:guard`
 *
 * Verifie que la sonde d'inference est encore capable d'ECHOUER.
 *
 * `pnpm typecheck` prouve que l'inference tient. Il ne prouve pas que la sonde
 * marche encore : si quelqu'un vidait ses assertions, tout resterait vert et le
 * garde aurait cesse de garder en silence. Ce script compile une fixture figee,
 * volontairement empoisonnee, et exige que tsc echoue.
 *
 * Deliberement dix lignes de logique. Pas de framework de mutation testing :
 * une etape suffit.
 */

const API_DIR = resolve(import.meta.dirname, "..");

/** Erreurs que la fixture DOIT produire. Leur absence est aussi un echec. */
const EXPECTED_ERRORS = [
  { code: "TS2345", what: "un `any` passe a travers assertNotAny" },
  { code: "TS2345", what: "deux types differents acceptes par assertExact" },
] as const;

// Le binaire tsc est resolu directement, sans passer par un shell : `shell: true`
// concatene les arguments sans les echapper (DEP0190) et n'apporte rien ici.
const tscEntry = resolve(
  API_DIR,
  "../../node_modules/typescript/lib/_tsc.js",
);
const tscFallback = resolve(API_DIR, "../../node_modules/typescript/lib/tsc.js");
const entry = existsSync(tscEntry) ? tscEntry : tscFallback;

const result = spawnSync(process.execPath, [entry, "-p", "tsconfig.guard.json"], {
  cwd: API_DIR,
  encoding: "utf8",
});

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
const errorCount = (output.match(/error TS\d+/g) ?? []).length;

console.log("\nGarde de la sonde d'inference");
console.log(`  fixture : tests/fixtures/type-inference.poisoned.ts`);
console.log(`  tsc     : code de sortie ${result.status}, ${errorCount} erreur(s)`);

if (result.status === 0) {
  console.error(
    "\nECHEC : la fixture empoisonnee compile SANS erreur.\n" +
      "  La sonde d'inference ne mord plus. Deux causes possibles :\n" +
      "    - les helpers assertNotAny / assertExact ont ete affaiblis ;\n" +
      "    - le compilateur a change de comportement (cf. porte ADR-0002).\n" +
      "  Ne PAS corriger la fixture : c'est le mecanisme qu'il faut reparer.",
  );
  process.exitCode = 1;
} else if (errorCount < EXPECTED_ERRORS.length) {
  console.error(
    `\nECHEC : ${errorCount} erreur(s) au lieu des ${EXPECTED_ERRORS.length} attendues.\n` +
      EXPECTED_ERRORS.map((e) => `    ${e.code} : ${e.what}`).join("\n") +
      `\n\nSortie de tsc :\n${output}`,
  );
  process.exitCode = 1;
} else {
  for (const line of output.split(/\r?\n/).filter((l) => l.includes("error TS"))) {
    console.log(`    ${line.trim()}`);
  }
  console.log("\nOK — la sonde echoue quand elle doit. Le garde garde.\n");
}
