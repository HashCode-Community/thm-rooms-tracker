import { relative, resolve } from "node:path";
import { closeDatabase } from "../db/client.js";
import {
  checkTrackCoherence,
  citedRoomCodes,
  type LoadedTrack,
  loadTrackFiles,
  RoadmapSourceError,
  TRACKS_DIR,
} from "./roadmap-source.js";
import { applyTracks, resolveCitedRooms } from "./roadmap-write.js";

/**
 * `pnpm roadmap:seed [--dir <chemin>] [--apply]`
 *
 * Charge `data/roadmap/tracks/*.yaml` en base.
 *
 * `--dry-run` est le DEFAUT, comme pour l'import du dataset. Il faut `--apply`
 * pour ecrire quoi que ce soit.
 *
 * ECHEC BRUYANT, jamais d'ignorance silencieuse. Le script refuse de tourner si :
 *   - un fichier ne respecte pas le contrat ;
 *   - deux parcours partagent un slug ou une position ;
 *   - une room est citee deux fois dans le meme parcours ;
 *   - une etape n'a aucune room `core` ;
 *   - un `code` de room N'EXISTE PAS en base ;
 *   - un `code` de room existe mais est INACTIF.
 *
 * Ce dernier cas merite d'etre distingue du precedent : une room inactive a
 * disparu du scrape, elle existait quand le parcours a ete ecrit. Le message le
 * dit, parce que la correction n'est pas la meme — une faute de frappe se corrige,
 * une room retiree par TryHackMe se remplace.
 */

type Options = { directory: string; apply: boolean };

/**
 * Les chemins se resolvent depuis la RACINE DU DEPOT, pas depuis le repertoire
 * courant. Le script tourne avec `cwd = apps/api` (pnpm --filter), donc un chemin
 * relatif brut designerait `apps/api/data/roadmap/tracks`. Meme convention que
 * `import-dataset.ts`.
 */
const ROOT = resolve(import.meta.dirname, "../../../..");

function parseArgs(argv: string[]): Options {
  const dirIndex = argv.indexOf("--dir");
  const raw = dirIndex >= 0 ? (argv[dirIndex + 1] ?? TRACKS_DIR) : TRACKS_DIR;
  return { directory: resolve(ROOT, raw), apply: argv.includes("--apply") };
}

function fail(title: string, lines: string[]): never {
  console.error(`\nSEED REFUSE — ${title}\n`);
  for (const line of lines) console.error(`  ${line}`);
  console.error("");
  process.exit(1);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  console.log("SEED DES PARCOURS");
  console.log(`  source : ${relative(ROOT, options.directory) || "."}`);
  console.log(`  mode   : ${options.apply ? "APPLIQUE" : "DRY-RUN, aucune ecriture"}\n`);

  let loaded: LoadedTrack[];
  try {
    loaded = loadTrackFiles(options.directory);
  } catch (error) {
    if (error instanceof RoadmapSourceError) {
      fail("contenu editorial invalide", error.message.split("\n"));
    }
    throw error;
  }

  if (loaded.length === 0) {
    fail("aucun parcours a charger", [
      `${relative(ROOT, options.directory)} ne contient aucun fichier .yaml.`,
      "Les parcours sont un CONTENU EDITORIAL : ils ne se deduisent d'aucune donnee",
      "TryHackMe et ne sont pas generes. Deposer les fichiers, puis relancer.",
    ]);
  }

  const coherence = checkTrackCoherence(loaded);
  if (coherence.length > 0) {
    fail(
      `${coherence.length} incoherence(s) dans le contenu editorial`,
      coherence.map((issue) => `[${issue.kind}] ${issue.detail}`),
    );
  }

  const { missing, inactive, idByCode } = await resolveCitedRooms([...citedRoomCodes(loaded)]);

  if (missing.length > 0) {
    fail(`${missing.length} room(s) citee(s) n'existent pas`, [
      ...missing.map((code) => `absente : "${code}"`),
      "",
      "La comparaison est SENSIBLE A LA CASSE (ADR-0001 Q1). Verifier l'orthographe",
      "exacte du code dans data/datasets/rooms.v1.json avant de conclure a une",
      "disparition.",
    ]);
  }

  if (inactive.length > 0) {
    fail(`${inactive.length} room(s) citee(s) sont INACTIVES`, [
      ...inactive.map((code) => `inactive : "${code}"`),
      "",
      "Ces rooms existent en base mais ont disparu du dernier scrape. Elles etaient",
      "la quand le parcours a ete ecrit. Ce n'est donc pas une faute de frappe : il",
      "faut remplacer la room dans le YAML, ou attendre qu'elle revienne.",
    ]);
  }

  // --- Resume avant ecriture ---------------------------------------------

  let totalSteps = 0;
  let totalCore = 0;
  let totalRooms = 0;
  for (const { track } of loaded) {
    totalSteps += track.steps.length;
    for (const step of track.steps) {
      totalRooms += step.rooms.length;
      totalCore += step.rooms.filter((room) => room.requirement === "core").length;
    }
  }

  console.log(`${loaded.length} parcours, ${totalSteps} etapes, ${totalRooms} liens de room.`);
  console.log(`  dont ${totalCore} \`core\` — c'est le denominateur de la progression.`);
  console.log(`  ${idByCode.size} rooms distinctes citees, toutes presentes et actives.\n`);

  for (const { file, track } of loaded) {
    const validated = track.provenance.validated_by_completion;
    console.log(`  ${track.position}. ${track.title}  (${track.slug}, ${track.level})`);
    console.log(`     ${file} — ${track.steps.length} etapes`);
    console.log(`     suivi de bout en bout par l'equipe : ${validated ? "OUI" : "NON"}`);
  }
  console.log("");

  if (!options.apply) {
    console.log("DRY-RUN : aucune ecriture. Ajouter --apply pour appliquer.\n");
    return;
  }

  // --- Ecriture ------------------------------------------------------------

  await applyTracks(loaded, idByCode);

  console.log(`APPLIQUE. ${loaded.length} parcours en base.\n`);
}

main()
  .catch((error: unknown) => {
    console.error("\nECHEC DU SEED\n");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => {
    void closeDatabase();
  });
