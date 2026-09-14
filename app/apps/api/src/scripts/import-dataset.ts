import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { checkDatasetVersion, DatasetSchema, SUPPORTED_DATASET_RANGE } from "@thm/shared";
import { eq, inArray, notInArray, sql as raw } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  difficulties,
  importRuns,
  rooms,
  roomTags,
  roomTeams,
  roomTypes,
  tags,
  teams,
} from "../db/schema.js";
import { sha256Hex } from "./dataset-analysis.js";
import {
  buildTagLedger,
  loadMapping,
  type Mapping,
  resolveTags,
  roomTagSlugs,
  type TagLedger,
  trimText,
} from "./normalise.js";

/**
 * `pnpm data:import [--file <chemin>] [--apply] [--apply-mappings] [--force]`
 *
 * --dry-run est le DEFAUT. Il faut `--apply` pour ecrire quoi que ce soit :
 * une commande destructrice ne doit pas etre celle qu'on tape par reflexe.
 *
 * Garanties :
 *   - idempotent : deux executions consecutives, la seconde a 0 modification ;
 *   - upsert par `code`, JAMAIS par titre ;
 *   - une room absente du dataset est DESACTIVEE, jamais supprimee ;
 *   - refus d'executer si plus de 5 % des rooms seraient desactivees, sauf --force ;
 *   - transaction unique sur les DONNEES : tout ou rien.
 *
 * Le journal `import_runs` est HORS de cette transaction, sur une connexion
 * separee. S'il etait dedans, un import qui echoue le rollbackrait aussi — et on
 * perdrait precisement la trace qui interesse. Une ligne est ecrite au demarrage
 * en `running`, puis passee a `succeeded` ou `failed` quoi qu'il arrive. Un
 * import interrompu brutalement laisse une ligne `running` orpheline : c'est une
 * information, pas un defaut.
 */

const ROOT = resolve(import.meta.dirname, "../../../..");
const DEFAULT_DATASET = "data/datasets/rooms.v1.json";
const DEFAULT_MAPPING = "data/mappings/normalisation-outils.yaml";
const DEACTIVATION_THRESHOLD = 0.05;

// --- Arguments -------------------------------------------------------------

type Args = {
  file: string;
  mapping: string;
  apply: boolean;
  applyMappings: boolean;
  force: boolean;
};

function parseArgs(argv: readonly string[]): Args {
  const valueAfter = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  return {
    file: valueAfter("--file") ?? DEFAULT_DATASET,
    mapping: valueAfter("--mapping") ?? DEFAULT_MAPPING,
    apply: argv.includes("--apply"),
    applyMappings: argv.includes("--apply-mappings"),
    force: argv.includes("--force"),
  };
}

// --- Rapport ---------------------------------------------------------------

type FieldChange = { code: string; field: string; before: unknown; after: unknown };

type Report = {
  datasetVersion: string;
  checksum: string;
  roomsSeen: number;
  added: string[];
  updated: FieldChange[];
  unchanged: number;
  deactivated: string[];
  reactivated: string[];
  trimmed: Array<{ code: string; field: string }>;
  tagsCreated: number;
  tagsTotal: number;
  collisions: Array<{ kind: string; slug: string; names: string[] }>;
  /** Trajet de chaque valeur brute jusqu'a la table `tags`. */
  tagLedger: TagLedger | null;
  warnings: string[];
};

const emptyReport = (datasetVersion: string, checksum: string): Report => ({
  datasetVersion,
  checksum,
  roomsSeen: 0,
  added: [],
  updated: [],
  unchanged: 0,
  deactivated: [],
  reactivated: [],
  trimmed: [],
  tagsCreated: 0,
  tagsTotal: 0,
  collisions: [],
  tagLedger: null,
  warnings: [],
});

// --- Main ------------------------------------------------------------------

const args = parseArgs(process.argv.slice(2));
const datasetPath = resolve(ROOT, args.file);
const mappingPath = resolve(ROOT, args.mapping);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL absent. Copier `.env.example` en `.env` a la racine du depot.");
}

/** Connexion du journal : SEPAREE de celle des donnees, et jamais dans la transaction. */
const journalSql = postgres(connectionString, { max: 1 });
const dataSql = postgres(connectionString, { max: 1 });
const db = drizzle(dataSql);

let runId: number | null = null;

function fail(message: string, details: readonly string[] = []): never {
  console.error(`\nIMPORT REFUSE\n  ${message}`);
  for (const line of details) console.error(`    ${line}`);
  console.error("");
  throw new ImportRefused(message);
}

class ImportRefused extends Error {}

try {
  // --- 1. Integrite (bloquant) ---------------------------------------------
  const bytes = readFileSync(datasetPath);
  const rawSha = sha256Hex(bytes);
  const sidecarPath = `${datasetPath}.sha256`;
  let sidecarExpected: string;
  try {
    sidecarExpected = (
      readFileSync(sidecarPath, "utf8").trim().split(/\s+/)[0] ?? ""
    ).toLowerCase();
  } catch {
    fail(`Sidecar d'integrite introuvable : ${basename(sidecarPath)}.`, [
      "Sans empreinte, on ne peut pas savoir si le fichier est celui que Malick a produit.",
      "Voir docs/data-contract.md section 3.",
    ]);
  }
  if (sidecarExpected !== rawSha) {
    fail("Le SHA-256 des octets bruts ne correspond pas au sidecar.", [
      `attendu ${sidecarExpected}`,
      `obtenu  ${rawSha}`,
      "Le fichier a ete modifie apres la generation de son empreinte, ou le sidecar est perime.",
    ]);
  }

  // --- 2. Version (bloquant, AVANT Zod) ------------------------------------
  const parsedJson: unknown = JSON.parse(bytes.toString("utf8"));
  const declared =
    parsedJson !== null && typeof parsedJson === "object" && "meta" in parsedJson
      ? ((parsedJson as { meta?: { datasetVersion?: unknown } }).meta?.datasetVersion ?? null)
      : null;
  const version = checkDatasetVersion(declared);
  if (!version.ok) fail(version.reason);

  // --- 3. Contrat (bloquant) -----------------------------------------------
  const parsed = DatasetSchema.safeParse(parsedJson);
  if (!parsed.success) {
    fail(`Le dataset viole le contrat : ${parsed.error.issues.length} violation(s).`, [
      ...parsed.error.issues
        .slice(0, 10)
        .map((issue) => `${issue.path.join(".") || "$"} : ${issue.message}`),
      "Lancer `pnpm data:audit` pour le detail complet.",
    ]);
  }
  const dataset = parsed.data;
  const report = emptyReport(dataset.meta.datasetVersion, rawSha);
  report.roomsSeen = dataset.rooms.length;

  // --- 4. Doublons de code (bloquant) --------------------------------------
  const codes = dataset.rooms.map((room) => room.code);
  const duplicates = [...new Set(codes.filter((code, i) => codes.indexOf(code) !== i))];
  if (duplicates.length > 0) {
    fail(`${duplicates.length} code(s) duplique(s) : la cle primaire est violee.`, duplicates);
  }

  // --- 5. Mapping et collisions de slug (bloquant) -------------------------
  let mapping: Mapping = { version: 0, merge: {}, rename: {}, canonical: {} };
  if (args.applyMappings) {
    mapping = loadMapping(mappingPath);
    console.log(`\nMapping applique : ${basename(mappingPath)} (version ${mapping.version})`);
    console.log(
      `  ${Object.keys(mapping.merge).length} merge, ${Object.keys(mapping.rename).length} rename, ` +
        `${Object.keys(mapping.canonical).length} forme(s) canonique(s)`,
    );
  } else {
    console.log("\nMapping NON applique (ajouter --apply-mappings). Donnees brutes.");
  }

  const resolved = resolveTags(dataset.rooms, mapping);
  report.collisions = resolved.collisions;
  report.tagsTotal = resolved.tags.length;

  if (resolved.unresolved.length > 0) {
    fail(`${resolved.unresolved.length} collision(s) de slug sans forme canonique declaree.`, [
      ...resolved.unresolved.map((c) => `${c.kind} "${c.slug}" <- ${JSON.stringify(c.names)}`),
      "",
      "Deux valeurs distinctes ne feront qu'une seule ligne en base : il faut decider",
      "laquelle atterrit dans `tags.name`. Sans declaration, ce serait « la premiere",
      "rencontree », donc l'ordre de parcours des rooms - stable aujourd'hui, instable",
      "des que l'ordre changera.",
      "",
      `Declarer la forme retenue dans ${basename(mappingPath)}, section \`canonical:\` :`,
      ...resolved.unresolved.map((c) => `  ${c.slug}: "${c.names[0] ?? c.slug}"`),
    ]);
  }

  // --- 5 bis. Journal des tags, et sa reconciliation (bloquant) ------------
  //
  // 304 valeurs brutes distinctes donnent 296 tags. L'ecart est legitime, mais
  // il doit etre ECRIT : un chiffre qui baisse sans explication tombe sous la
  // regle « aucune modification silencieuse des donnees ».
  //
  // Le journal recompte depuis les rooms, par un chemin distinct de
  // `resolveTags`. Les deux doivent tomber sur le meme nombre. S'ils divergent,
  // c'est qu'une valeur disparait quelque part sans etre comptee, et l'import
  // s'arrete plutot que d'ecrire un chiffre qu'il ne sait pas justifier.
  const ledger = buildTagLedger(dataset.rooms, mapping);
  report.tagLedger = ledger;

  if (!ledger.reconciled) {
    fail("Le journal des tags ne se reconcilie pas.", [
      ...ledger.byKind
        .filter((k) => !k.reconciled)
        .map(
          (k) =>
            `${k.kind} : ${k.incoming} entrantes - ${k.discardedAbsence} absence(s) - ` +
            `${k.discardedEmptySlug} slug(s) vide(s) - ${k.absorbed} absorbee(s) != ${k.resulting}`,
        ),
      "",
      "Des valeurs disparaissent sans etre comptees. Ne pas relacher le controle :",
      "c'est le comptage ou la normalisation qu'il faut corriger.",
    ]);
  }

  if (ledger.totals.resulting !== resolved.tags.length) {
    fail("Les deux comptages de tags divergent.", [
      `journal      : ${ledger.totals.resulting} tags`,
      `resolveTags  : ${resolved.tags.length} tags`,
      "",
      "Les deux chemins partent des memes rooms et du meme mapping. Une divergence",
      "signifie qu'ils ne traitent pas les memes valeurs de la meme facon.",
    ]);
  }

  if (ledger.totals.discardedEmptySlug > 0) {
    report.warnings.push(
      `${ledger.totals.discardedEmptySlug} valeur(s) de tag ecartee(s) faute de slug : ` +
        ledger.entries
          .filter((e) => e.fate === "ecartee-slug-vide")
          .map((e) => JSON.stringify(e.raw))
          .join(", "),
    );
  }

  // --- 6. Etat courant -----------------------------------------------------
  const existing = await db
    .select({
      id: rooms.id,
      code: rooms.code,
      title: rooms.title,
      description: rooms.description,
      difficultyId: rooms.difficultyId,
      roomTypeId: rooms.roomTypeId,
      durationMinutes: rooms.durationMinutes,
      usersCount: rooms.usersCount,
      publishedAt: rooms.publishedAt,
      thmUrl: rooms.thmUrl,
      isActive: rooms.isActive,
    })
    .from(rooms);
  const existingByCode = new Map(existing.map((row) => [row.code, row]));

  const difficultyIds = new Map(
    (await db.select({ id: difficulties.id, key: difficulties.key }).from(difficulties)).map(
      (row) => [row.key, row.id],
    ),
  );
  const roomTypeIds = new Map(
    (await db.select({ id: roomTypes.id, key: roomTypes.key }).from(roomTypes)).map((row) => [
      row.key,
      row.id,
    ]),
  );
  const teamIds = new Map(
    (await db.select({ id: teams.id, key: teams.key }).from(teams)).map((row) => [row.key, row.id]),
  );

  if (difficultyIds.size === 0 || roomTypeIds.size === 0 || teamIds.size === 0) {
    fail("Referentiels vides. Lancer `pnpm db:seed` avant d'importer.");
  }

  // --- 7. Diff -------------------------------------------------------------
  const incomingCodes = new Set(codes);
  const toDeactivate = existing.filter((row) => row.isActive && !incomingCodes.has(row.code));

  const activeCount = existing.filter((row) => row.isActive).length;
  const ratio = activeCount === 0 ? 0 : toDeactivate.length / activeCount;
  if (ratio > DEACTIVATION_THRESHOLD && !args.force) {
    fail(
      `Ce run desactiverait ${toDeactivate.length} rooms sur ${activeCount} actives ` +
        `(${(ratio * 100).toFixed(1)} %), au-dela du seuil de ${DEACTIVATION_THRESHOLD * 100} %.`,
      [
        "Un scraper casse ne doit pas pouvoir vider la base.",
        "Verifier le dataset. Si la disparition est reelle, relancer avec --force.",
        ...toDeactivate.slice(0, 10).map((row) => `  - ${row.code}`),
        ...(toDeactivate.length > 10 ? [`  ... et ${toDeactivate.length - 10} autre(s)`] : []),
      ],
    );
  }

  const prepared = dataset.rooms.map((room) => {
    const title = trimText(room.title);
    if (title !== room.title) report.trimmed.push({ code: room.code, field: "title" });

    const rawDescription = room.description ?? "";
    const description = trimText(rawDescription);
    if (description !== rawDescription) {
      report.trimmed.push({ code: room.code, field: "description" });
    }

    const difficultyId = difficultyIds.get(room.difficulty);
    const roomTypeId = roomTypeIds.get(room.type);
    if (difficultyId === undefined || roomTypeId === undefined) {
      fail(`Referentiel manquant pour ${room.code} (${room.difficulty} / ${room.type}).`);
    }

    return {
      source: room,
      row: {
        code: room.code, // JAMAIS de toLowerCase : cf. ADR-0001 Q1.
        title,
        description: description === "" ? null : description,
        difficultyId,
        roomTypeId,
        durationMinutes: room.durationMinutes ?? null,
        usersCount: room.usersCount ?? null,
        publishedAt: room.publishedAt ?? null,
        thmUrl: room.url,
        isFree: true,
        isActive: true,
        raw: room,
      },
    };
  });

  const COMPARED_FIELDS = [
    "title",
    "description",
    "difficultyId",
    "roomTypeId",
    "durationMinutes",
    "usersCount",
    "publishedAt",
    "thmUrl",
  ] as const;

  for (const { row } of prepared) {
    const current = existingByCode.get(row.code);
    if (!current) {
      report.added.push(row.code);
      continue;
    }
    let changed = false;
    for (const field of COMPARED_FIELDS) {
      const before = current[field];
      const after = row[field];
      if (before !== after) {
        report.updated.push({ code: row.code, field, before, after });
        changed = true;
      }
    }
    if (!current.isActive) {
      report.reactivated.push(row.code);
      changed = true;
    }
    if (!changed) report.unchanged += 1;
  }
  report.deactivated = toDeactivate.map((row) => row.code);

  // --- 8. Restitution ------------------------------------------------------
  printReport(report, args);

  if (!args.apply) {
    console.log("DRY-RUN : aucune ecriture. Ajouter --apply pour appliquer.\n");
    // Volontairement AUCUNE ligne dans `import_runs` : un dry-run ne change
    // rien, le journaliser polluerait la trace des imports reels.
  } else {
    runId = await openRun(report);

    await db.transaction(async (tx) => {
      // Tags : upsert puis relecture des identifiants.
      if (resolved.tags.length > 0) {
        await tx
          .insert(tags)
          .values(resolved.tags)
          .onConflictDoUpdate({
            target: [tags.kind, tags.slug],
            set: { name: raw`excluded.name` },
          });
      }
      const tagIds = new Map(
        (await tx.select({ id: tags.id, kind: tags.kind, slug: tags.slug }).from(tags)).map(
          (row) => [`${row.kind}:${row.slug}`, row.id],
        ),
      );

      // Rooms : upsert par `code`.
      for (const { row } of prepared) {
        await tx
          .insert(rooms)
          .values(row)
          .onConflictDoUpdate({
            target: rooms.code,
            set: {
              title: raw`excluded.title`,
              description: raw`excluded.description`,
              difficultyId: raw`excluded.difficulty_id`,
              roomTypeId: raw`excluded.room_type_id`,
              durationMinutes: raw`excluded.duration_minutes`,
              usersCount: raw`excluded.users_count`,
              publishedAt: raw`excluded.published_at`,
              thmUrl: raw`excluded.thm_url`,
              isFree: raw`excluded.is_free`,
              isActive: raw`excluded.is_active`,
              raw: raw`excluded.raw`,
              lastSeenAt: raw`now()`,
            },
          });
      }

      const roomIds = new Map(
        (await tx.select({ id: rooms.id, code: rooms.code }).from(rooms)).map((row) => [
          row.code,
          row.id,
        ]),
      );

      // Liaisons : on remplace integralement celles des rooms vues.
      const seenIds = prepared
        .map(({ row }) => roomIds.get(row.code))
        .filter((id): id is number => id !== undefined);

      if (seenIds.length > 0) {
        await tx.delete(roomTags).where(inArray(roomTags.roomId, seenIds));
        await tx.delete(roomTeams).where(inArray(roomTeams.roomId, seenIds));
      }

      const tagLinks: Array<{ roomId: number; tagId: number }> = [];
      const teamLinks: Array<{ roomId: number; teamId: number }> = [];
      for (const { source, row } of prepared) {
        const roomId = roomIds.get(row.code);
        if (roomId === undefined) continue;
        for (const { kind, slug } of roomTagSlugs(source, mapping)) {
          const tagId = tagIds.get(`${kind}:${slug}`);
          if (tagId !== undefined) tagLinks.push({ roomId, tagId });
        }
        for (const team of new Set(source.teams ?? [])) {
          const teamId = teamIds.get(team);
          if (teamId !== undefined) teamLinks.push({ roomId, teamId });
        }
      }
      if (tagLinks.length > 0) await tx.insert(roomTags).values(tagLinks);
      if (teamLinks.length > 0) await tx.insert(roomTeams).values(teamLinks);

      // Desactivation. JAMAIS de DELETE.
      if (codes.length > 0) {
        await tx.update(rooms).set({ isActive: false }).where(notInArray(rooms.code, codes));
      }

      // Tags devenus orphelins : eux, peuvent disparaitre, ils ne portent
      // aucune progression utilisateur.
      await tx.execute(
        raw`DELETE FROM tags t WHERE NOT EXISTS (SELECT 1 FROM room_tags rt WHERE rt.tag_id = t.id)`,
      );
    });

    const after = await db.select({ total: raw<number>`count(*)::int` }).from(tags);
    report.tagsCreated = after[0]?.total ?? 0;

    console.log("APPLIQUE. Transaction unique : tout ou rien.\n");
    await finish("succeeded", report, null);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (!(error instanceof ImportRefused)) {
    console.error(`\nECHEC DE L'IMPORT : ${message}\n`);
  }
  await finish("failed", null, message);
  process.exitCode = 1;
} finally {
  await dataSql.end({ timeout: 5 });
  await journalSql.end({ timeout: 5 });
}

// --- Journal (hors transaction) --------------------------------------------

/**
 * Ouvre la ligne `import_runs` AVANT la transaction de donnees, sur une
 * connexion separee. Si elle etait dans la transaction, un import qui echoue la
 * rollbackrait — et on perdrait la trace de l'echec.
 */
async function openRun(report: Report): Promise<number> {
  const journal = drizzle(journalSql);
  const [row] = await journal
    .insert(importRuns)
    .values({
      datasetVersion: report.datasetVersion,
      checksum: report.checksum,
      roomsSeen: report.roomsSeen,
      report: { status: "running" },
    })
    .returning({ id: importRuns.id });
  return row?.id ?? 0;
}

async function finish(
  status: "succeeded" | "failed",
  report: Report | null,
  errorMessage: string | null,
): Promise<void> {
  if (runId === null) return;
  const journal = drizzle(journalSql);
  await journal
    .update(importRuns)
    .set({
      finishedAt: new Date(),
      added: report?.added.length ?? 0,
      updated: report ? new Set(report.updated.map((c) => c.code)).size : 0,
      deactivated: report?.deactivated.length ?? 0,
      report: { status, error: errorMessage, ...(report ?? {}) },
    })
    .where(eq(importRuns.id, runId));
}

// --- Affichage --------------------------------------------------------------

/**
 * Le trajet des tags, en clair.
 *
 * Le total seul ne dit rien : « 296 tags » ne permet a personne de verifier que
 * les 8 valeurs manquantes sont celles qu'on croit. Chaque ligne d'ecart est
 * donc nommee, et la reconciliation est ecrite comme une addition qu'un humain
 * peut refaire de tete.
 */
function printTagLedger(ledger: TagLedger): void {
  const { totals } = ledger;
  console.log(
    `\n  Tags : ${totals.incoming} valeurs brutes distinctes -> ${totals.resulting} tags`,
  );
  for (const kind of ledger.byKind) {
    const ecarts: string[] = [];
    if (kind.discardedAbsence > 0) ecarts.push(`${kind.discardedAbsence} ecartee(s) : absence`);
    if (kind.discardedEmptySlug > 0) ecarts.push(`${kind.discardedEmptySlug} sans slug`);
    if (kind.absorbed > 0) ecarts.push(`${kind.absorbed} absorbee(s) par fusion`);
    console.log(
      `    ${kind.kind.padEnd(11)} ${String(kind.incoming).padStart(4)} -> ` +
        `${String(kind.resulting).padStart(4)}` +
        (ecarts.length > 0 ? `   (${ecarts.join(", ")})` : ""),
    );
  }

  const discarded = ledger.entries.filter((entry) => entry.name === null || entry.slug === null);
  if (discarded.length > 0) {
    console.log("\n    Ecartees (jamais un tag) :");
    for (const entry of discarded) {
      const raison = entry.fate === "ecartee-absence" ? "absence" : "slug vide";
      console.log(
        `      ${entry.kind.padEnd(11)} ${JSON.stringify(entry.raw)} ` +
          `(${entry.occurrences} occ.) : ${raison}`,
      );
    }
  }

  if (ledger.fusions.length > 0) {
    console.log("\n    Fusions (plusieurs ecritures pour un seul tag) :");
    for (const fusion of ledger.fusions) {
      const sources = fusion.sources
        .map((source) => `${JSON.stringify(source.raw)} (${source.occurrences})`)
        .join(" + ");
      console.log(`      ${fusion.kind.padEnd(11)} ${JSON.stringify(fusion.name)} <- ${sources}`);
    }
  }

  if (ledger.renames.length > 0) {
    console.log("\n    Renommages sans fusion (le libelle change, le compte ne bouge pas) :");
    for (const rename of ledger.renames) {
      console.log(
        `      ${rename.kind.padEnd(11)} ${JSON.stringify(rename.from)} -> ` +
          `${JSON.stringify(rename.to)} (${rename.occurrences} occ.)`,
      );
    }
  }

  console.log(
    `\n    Reconciliation : ${totals.incoming} - ${totals.discardedAbsence} absence(s) - ` +
      `${totals.discardedEmptySlug} sans slug - ${totals.absorbed} absorbee(s) = ` +
      `${totals.resulting}  ${ledger.reconciled ? "OK" : "INCOHERENT"}`,
  );
}

function printReport(report: Report, options: Args): void {
  const updatedCodes = new Set(report.updated.map((change) => change.code));
  console.log(`\nDataset v${report.datasetVersion}  |  ${report.roomsSeen} rooms lues`);
  console.log(`  + ${String(report.added.length).padStart(4)} ajoutees`);
  console.log(`  ~ ${String(updatedCodes.size).padStart(4)} modifiees`);
  console.log(`  = ${String(report.unchanged).padStart(4)} inchangees`);
  console.log(`  ^ ${String(report.reactivated.length).padStart(4)} reactivees`);
  console.log(
    `  - ${String(report.deactivated.length).padStart(4)} desactivees (jamais supprimees)`,
  );
  console.log(`  # ${String(report.tagsTotal).padStart(4)} tags resolus`);

  if (report.trimmed.length > 0) {
    const byField = report.trimmed.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.field] = (acc[entry.field] ?? 0) + 1;
      return acc;
    }, {});
    console.log(
      `  ! ${String(report.trimmed.length).padStart(4)} champs trimmes ` +
        `(${Object.entries(byField)
          .map(([field, n]) => `${field}: ${n}`)
          .join(", ")})`,
    );
  }

  if (report.tagLedger !== null) printTagLedger(report.tagLedger);

  if (report.collisions.length > 0) {
    console.log(`\n  Collisions de slug resolues par \`canonical:\` :`);
    for (const collision of report.collisions) {
      console.log(
        `    ${collision.kind} "${collision.slug}" <- ${JSON.stringify(collision.names)}`,
      );
    }
  }

  if (updatedCodes.size > 0) {
    console.log("\n  Detail des modifications (champ par champ) :");
    for (const change of report.updated.slice(0, 25)) {
      console.log(
        `    ${change.code} . ${change.field} : ${JSON.stringify(change.before)} -> ${JSON.stringify(change.after)}`,
      );
    }
    if (report.updated.length > 25) {
      console.log(`    ... et ${report.updated.length - 25} autre(s)`);
    }
  }

  if (report.deactivated.length > 0) {
    console.log(`\n  Desactivees : ${report.deactivated.slice(0, 15).join(", ")}`);
  }

  if (options.force) {
    console.log("\n  --force : le garde des 5 % a ete contourne volontairement.");
  }
  console.log("");

  // Horodatage UTC a la SECONDE, pas a la minute : deux runs rapproches
  // ecrasaient leur rapport, ce qui s'est produit pendant la mise au point.
  // Un artefact qui fait foi ne doit pas pouvoir disparaitre en silence.
  const stamp = new Date()
    .toISOString()
    .replace(/[:-]/g, "")
    .replace(/\.\d+Z$/, "Z");
  const reportPath = resolve(
    ROOT,
    `data/reports/import-${stamp}${options.apply ? "" : "-dry-run"}.md`,
  );
  writeFileSync(reportPath, renderMarkdown(report, options), "utf8");
  console.log(`Rapport : ${reportPath}`);
}

/** Le meme journal que la console, en markdown : le rapport date fait foi. */
function renderTagLedger(ledger: TagLedger): string[] {
  const { totals } = ledger;
  const lines: string[] = [
    "## Tags",
    "",
    `${totals.incoming} valeurs brutes distinctes produisent **${totals.resulting} tags**.`,
    "",
    "| facette | entrantes | ecartees | absorbees | tags |",
    "|---|---:|---:|---:|---:|",
    ...ledger.byKind.map(
      (k) =>
        `| ${k.kind} | ${k.incoming} | ${k.discardedAbsence + k.discardedEmptySlug} | ` +
        `${k.absorbed} | ${k.resulting} |`,
    ),
    `| **total** | **${totals.incoming}** | ` +
      `**${totals.discardedAbsence + totals.discardedEmptySlug}** | ` +
      `**${totals.absorbed}** | **${totals.resulting}** |`,
    "",
  ];

  const discarded = ledger.entries.filter((entry) => entry.slug === null);
  if (discarded.length > 0) {
    lines.push(
      "### Ecartees",
      "",
      "| facette | valeur | occurrences | raison |",
      "|---|---|---:|---|",
      ...discarded.map(
        (entry) =>
          `| ${entry.kind} | \`${entry.raw}\` | ${entry.occurrences} | ` +
          `${entry.fate === "ecartee-absence" ? "absence" : "slug vide"} |`,
      ),
      "",
    );
  }

  if (ledger.fusions.length > 0) {
    lines.push(
      "### Fusions",
      "",
      "| facette | tag | ecritures source |",
      "|---|---|---|",
      ...ledger.fusions.map(
        (fusion) =>
          `| ${fusion.kind} | \`${fusion.name}\` | ` +
          `${fusion.sources.map((s) => `\`${s.raw}\` (${s.occurrences})`).join(" + ")} |`,
      ),
      "",
    );
  }

  if (ledger.renames.length > 0) {
    lines.push(
      "### Renommages sans fusion",
      "",
      "| facette | de | vers | occurrences |",
      "|---|---|---|---:|",
      ...ledger.renames.map(
        (r) => `| ${r.kind} | \`${r.from}\` | \`${r.to}\` | ${r.occurrences} |`,
      ),
      "",
    );
  }

  lines.push(
    "### Reconciliation",
    "",
    "```",
    `${totals.incoming} entrantes` +
      ` - ${totals.discardedAbsence} absence(s)` +
      ` - ${totals.discardedEmptySlug} sans slug` +
      ` - ${totals.absorbed} absorbee(s)` +
      ` = ${totals.resulting} tags`,
    "```",
    "",
    ledger.reconciled
      ? "L'ecart est entierement explique. L'import bloque si ce n'est pas le cas."
      : "**INCOHERENT.** Des valeurs disparaissent sans etre comptees.",
    "",
  );

  return lines;
}

function renderMarkdown(report: Report, options: Args): string {
  const updatedCodes = new Set(report.updated.map((change) => change.code));
  const lines = [
    `# Rapport d'import — dataset v${report.datasetVersion}`,
    "",
    `Genere le ${new Date().toISOString()} (**UTC**).`,
    `Mode : **${options.apply ? "APPLIQUE" : "DRY-RUN, aucune ecriture"}**` +
      `${options.applyMappings ? ", mapping applique" : ", mapping NON applique"}` +
      `${options.force ? ", **--force** (garde des 5 % contourne)" : ""}.`,
    "",
    `Empreinte du dataset : \`${report.checksum}\``,
    `Plage supportee par l'importer : \`${SUPPORTED_DATASET_RANGE}\``,
    "",
    "## Resume",
    "",
    "| | Nombre |",
    "|---|---:|",
    `| rooms lues | ${report.roomsSeen} |`,
    `| ajoutees | ${report.added.length} |`,
    `| modifiees | ${updatedCodes.size} |`,
    `| inchangees | ${report.unchanged} |`,
    `| reactivees | ${report.reactivated.length} |`,
    `| **desactivees** (jamais supprimees) | ${report.deactivated.length} |`,
    `| tags resolus | ${report.tagsTotal} |`,
    `| champs trimmes | ${report.trimmed.length} |`,
    "",
  ];

  if (report.tagLedger !== null) lines.push(...renderTagLedger(report.tagLedger));

  if (report.collisions.length > 0) {
    lines.push(
      "## Collisions de slug",
      "",
      "Resolues par la section `canonical:` du mapping. Sans declaration explicite,",
      "l'import aurait refuse de tourner.",
      "",
      ...report.collisions.map(
        (c) => `- \`${c.kind}\` **${c.slug}** ← ${c.names.map((n) => `\`${n}\``).join(", ")}`,
      ),
      "",
    );
  }

  if (report.trimmed.length > 0) {
    lines.push(
      "## Champs normalises par `trim()`",
      "",
      "Normalisation d'espaces, pas modification de contenu (ADR-0001 Q5).",
      "Listes ici pour que rien ne soit silencieux.",
      "",
      "```",
      ...report.trimmed.map((entry) => `${entry.code} . ${entry.field}`),
      "```",
      "",
    );
  }

  if (report.updated.length > 0) {
    lines.push(
      "## Modifications, champ par champ",
      "",
      "```",
      ...report.updated.map(
        (c) => `${c.code} . ${c.field} : ${JSON.stringify(c.before)} -> ${JSON.stringify(c.after)}`,
      ),
      "```",
      "",
    );
  }

  if (report.added.length > 0) {
    lines.push("## Rooms ajoutees", "", "```", ...report.added, "```", "");
  }
  if (report.deactivated.length > 0) {
    lines.push(
      "## Rooms desactivees",
      "",
      "`is_active = false`. **Aucune suppression** : la progression des utilisateurs",
      "qui les ont terminees est conservee.",
      "",
      "```",
      ...report.deactivated,
      "```",
      "",
    );
  }
  return lines.join("\n");
}
