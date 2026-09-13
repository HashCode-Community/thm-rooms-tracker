import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatasetSchema } from "@thm/shared";

/**
 * `pnpm data:csv`
 *
 * Regenere le CSV de confort humain depuis `rooms.v1.json`.
 *
 * Ce fichier est un DERIVE, pas une source. Il vit dans `data/exports/`, qui est
 * gitignore : le versionner produirait un gros diff a chaque regeneration pour
 * zero information, alors que la source, elle, est deja versionnee et verifiee
 * par SHA-256.
 *
 * Deux differences avec le CSV livre initialement :
 *   - `code` est en PREMIERE colonne. Sans lui, le CSV n'etait rapprochable du
 *     JSON ligne a ligne par aucun moyen : la cle primaire en etait absente.
 *   - le tri suit celui de la source (`code` croissant), et non plus la
 *     popularite. Un CSV et un JSON dans le meme ordre se comparent ; dans deux
 *     ordres differents, non.
 */

const ROOT = resolve(import.meta.dirname, "../../../..");
const DEFAULT_INPUT = "data/datasets/rooms.v1.json";
const DEFAULT_OUTPUT = "data/exports/tryhackme_rooms_gratuites.csv";

const HEADER = [
  "code",
  "titre",
  "url",
  "difficulte",
  "type",
  "duree_min",
  "utilisateurs",
  "publie",
  "point_de_vue",
  "competences",
  "technologies",
  "outils",
  "description",
] as const;

/**
 * Echappement RFC 4180 : un champ contenant une virgule, un guillemet ou un
 * saut de ligne est entoure de guillemets, et les guillemets internes doublés.
 */
function escapeField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function main(): number {
  const argv = process.argv.slice(2);
  const inputArg = argv[argv.indexOf("--file") + 1];
  const outputArg = argv[argv.indexOf("--out") + 1];
  const inputPath = resolve(ROOT, argv.includes("--file") && inputArg ? inputArg : DEFAULT_INPUT);
  const outputPath = resolve(
    ROOT,
    argv.includes("--out") && outputArg ? outputArg : DEFAULT_OUTPUT,
  );

  const parsed = DatasetSchema.safeParse(JSON.parse(readFileSync(inputPath, "utf8")));
  if (!parsed.success) {
    console.error(
      `Le dataset ne respecte pas le contrat : ${parsed.error.issues.length} violation(s).\n` +
        "Lancer `pnpm data:audit` pour le detail. Aucun export produit.",
    );
    return 1;
  }

  // Meme tri que la source. Le dataset est deja trie par code, on le reaffirme
  // ici pour que l'export reste stable meme si la source cessait de l'etre.
  const rooms = [...parsed.data.rooms].sort((a, b) => a.code.localeCompare(b.code, "en"));

  const lines = [HEADER.join(",")];
  for (const room of rooms) {
    lines.push(
      [
        room.code,
        room.title,
        room.url,
        room.difficulty,
        room.type,
        room.durationMinutes?.toString() ?? "",
        room.usersCount?.toString() ?? "",
        room.publishedAt ?? "",
        (room.teams ?? []).join("|"),
        (room.skills ?? []).join("|"),
        (room.technologies ?? []).join("|"),
        (room.tools ?? []).join("|"),
        room.description ?? "",
      ]
        .map(escapeField)
        .join(","),
    );
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  // CRLF : c'est ce qu'attend Excel, qui est la seule raison d'etre de ce fichier.
  writeFileSync(outputPath, `${lines.join("\r\n")}\r\n`, "utf8");

  console.log(`CSV regenere : ${outputPath}`);
  console.log(`  ${rooms.length} rooms, ${HEADER.length} colonnes, triees par code croissant`);
  console.log("  derive regenerable, non versionne (cf. .gitignore)");
  return 0;
}

process.exitCode = main();
