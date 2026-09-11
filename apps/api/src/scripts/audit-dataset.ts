import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import {
  CONTRACT_NOTES,
  checkDatasetVersion,
  DatasetSchema,
  SUPPORTED_DATASET_RANGE,
} from "@thm/shared";
import {
  type Anomaly,
  type Check,
  computeStats,
  detectAnomalies,
  recomputeMetaChecksum,
  runControlChecks,
  type Stats,
  sha256Hex,
  sortedEntries,
} from "./dataset-analysis.js";

/**
 * `pnpm data:audit`
 *
 * Charge le dataset, verifie son integrite, le valide contre le contrat Zod,
 * recompte les statistiques de controle et liste toutes les anomalies.
 *
 * NE CORRIGE RIEN. C'est un observateur. Aucune ecriture ailleurs que dans le
 * rapport.
 */

const ROOT = resolve(import.meta.dirname, "../../../..");
const DEFAULT_DATASET = "data/datasets/rooms.v1.json";

type Args = { file: string; out: string | null };

function parseArgs(argv: readonly string[]): Args {
  let file = DEFAULT_DATASET;
  let out: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file") {
      const value = argv[i + 1];
      if (!value) throw new Error("--file attend un chemin");
      file = value;
      i += 1;
    } else if (arg === "--out") {
      const value = argv[i + 1];
      if (!value) throw new Error("--out attend un chemin");
      out = value;
      i += 1;
    }
  }
  return { file, out };
}

const bar = (label: string, value: number, max: number, width = 28): string => {
  const filled = max > 0 ? Math.round((value / max) * width) : 0;
  return `${label.padEnd(24)} ${"#".repeat(filled).padEnd(width)} ${String(value).padStart(5)}`;
};

function formatStats(stats: Stats): string {
  const lines: string[] = [];
  const block = (title: string, entries: Array<[string, number]>, max: number): void => {
    lines.push(`**${title}**`, "", "```");
    for (const [key, value] of entries) lines.push(bar(key, value, max));
    lines.push("```", "");
  };

  const difficulties = sortedEntries(stats.byDifficulty);
  block("Difficulte", difficulties, Math.max(...difficulties.map(([, n]) => n)));

  const types = sortedEntries(stats.byType);
  block("Type", types, Math.max(...types.map(([, n]) => n)));

  const teams = [
    ...sortedEntries(stats.byTeam),
    ["(sans equipe)", stats.roomsWithoutTeam] as [string, number],
  ];
  block("Point de vue", teams, Math.max(...teams.map(([, n]) => n)));

  const technologies = sortedEntries(stats.technologies);
  block(
    `Technologies (${stats.distinctTechnologies} distinctes)`,
    technologies,
    Math.max(...technologies.map(([, n]) => n)),
  );

  const tools = sortedEntries(stats.tools).slice(0, 15);
  block(
    `Outils les plus frequents (${stats.distinctTools} distincts au total)`,
    tools,
    Math.max(...tools.map(([, n]) => n)),
  );

  const skills = sortedEntries(stats.skills).slice(0, 15);
  block(
    `Competences les plus frequentes (${stats.distinctSkills} distinctes au total)`,
    skills,
    Math.max(...skills.map(([, n]) => n)),
  );

  const hours = (stats.totalDurationMinutes / 60).toFixed(1);
  lines.push(
    `**Duree cumulee** : ${stats.totalDurationMinutes.toLocaleString("fr-FR")} minutes, soit ${hours} h.`,
    `Rooms sans duree renseignee : ${stats.roomsWithoutDuration}.`,
    "",
  );
  return lines.join("\n");
}

function formatChecks(checks: readonly Check[]): string {
  const failed = checks.filter((c) => !c.ok);
  const lines = [
    `${checks.length - failed.length} / ${checks.length} controles conformes.`,
    "",
    "| Controle | Attendu | Obtenu | |",
    "|---|---:|---:|:--:|",
  ];
  for (const c of checks) {
    lines.push(`| ${c.label} | ${c.expected} | ${c.actual} | ${c.ok ? "ok" : "**ECART**"} |`);
  }
  return lines.join("\n");
}

function formatAnomalies(anomalies: readonly Anomaly[]): string {
  const lines: string[] = [];
  const present = anomalies.filter((a) => a.count > 0);
  const absent = anomalies.filter((a) => a.count === 0);

  lines.push(
    "| # | Anomalie | Occurrences | Severite |",
    "|---|---|---:|---|",
    ...present.map((a, i) => `| ${i + 1} | ${a.title} | ${a.count} | ${a.severity} |`),
    "",
  );

  for (const a of present) {
    lines.push(
      `### ${a.title}`,
      "",
      `**Occurrences** : ${a.count} — **severite** : ${a.severity}`,
      "",
      `**Traitement attendu** : ${a.treatment}`,
      "",
      "```",
      ...a.samples,
      ...(a.truncated > 0 ? [`... et ${a.truncated} autre(s), non listee(s) ici`] : []),
      "```",
      "",
    );
  }

  if (absent.length > 0) {
    lines.push(
      "### Controles sans occurrence",
      "",
      "Verifies, aucun cas trouve. Listes pour prouver que le controle a bien tourne.",
      "",
      ...absent.map((a) => `- ${a.title} : 0`),
      "",
    );
  }
  return lines.join("\n");
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  const datasetPath = resolve(ROOT, args.file);
  const fileName = basename(datasetPath);

  const problems: string[] = [];
  const bytes = readFileSync(datasetPath);
  const rawSha = sha256Hex(bytes);

  // --- 1. Integrite sur octets bruts (BLOQUANT, decision D2) ---------------
  const sidecarPath = `${datasetPath}.sha256`;
  let sidecarExpected: string | null = null;
  let sidecarOk: boolean | null = null;
  try {
    const line = readFileSync(sidecarPath, "utf8").trim();
    sidecarExpected = line.split(/\s+/)[0] ?? null;
    sidecarOk = sidecarExpected === rawSha;
    if (!sidecarOk) {
      problems.push(
        `Integrite : le SHA-256 des octets bruts ne correspond pas au sidecar. ` +
          `attendu ${sidecarExpected}, obtenu ${rawSha}.`,
      );
    }
  } catch {
    problems.push(`Integrite : sidecar introuvable (${basename(sidecarPath)}). Import a refuser.`);
  }

  const raw: unknown = JSON.parse(bytes.toString("utf8"));

  // --- 2. Version du dataset (BLOQUANT, AVANT Zod) -------------------------
  // Deliberement en amont de la validation : si le scraper a ajoute un champ,
  // l'incompatibilite de version doit l'emporter sur le symptome, qui serait un
  // `unrecognized key` illisible pour qui n'a pas le contexte.
  const declaredVersion =
    raw !== null && typeof raw === "object" && "meta" in raw
      ? ((raw as { meta?: { datasetVersion?: unknown } }).meta?.datasetVersion ?? null)
      : null;
  const version = checkDatasetVersion(declaredVersion);
  if (!version.ok) {
    problems.push(`Version : ${version.reason}`);
  }

  // --- 3. Contrat Zod (BLOQUANT) -------------------------------------------
  const parsed = DatasetSchema.safeParse(raw);
  const zodErrors: string[] = [];
  if (!parsed.success) {
    for (const issue of parsed.error.issues.slice(0, 50)) {
      zodErrors.push(`${issue.path.join(".") || "$"} : ${issue.message}`);
    }
    problems.push(`Contrat : ${parsed.error.issues.length} violation(s) du schema Zod.`);
  }

  const now = new Date();
  // Horodatage UTC a la minute. La date seule s'ecraserait si l'audit tournait
  // deux fois le meme jour - ce qui arrivera des que Malick livrera deux fois.
  // Un artefact qui fait foi ne doit pas pouvoir disparaitre en silence.
  const stamp = `${now.toISOString().slice(0, 13)}${now.toISOString().slice(14, 16)}Z`;
  const outPath = resolve(ROOT, args.out ?? `data/reports/audit-${stamp}.md`);

  const head: string[] = [
    `# Rapport d'audit — ${fileName}`,
    "",
    `Genere le ${now.toISOString()} (**UTC**) par \`pnpm data:audit\`.`,
    "",
    "> Tous les horodatages de ce rapport, **nom de fichier compris, sont en UTC** : ils doivent",
    "> rester comparables entre postes et en CI. Un audit lance a 00h30 a Paris porte donc la",
    "> date de la veille. Ce n'est pas une erreur.",
    "",
    "> Ce rapport **ne corrige rien**. Il observe, compte et signale.",
    "> Les corrections passent par `data/mappings/`, valides a la main et versionnes.",
    "",
    "## 1. Integrite",
    "",
    "| Controle | Resultat |",
    "|---|---|",
    `| Taille | ${bytes.length.toLocaleString("fr-FR")} octets |`,
    `| SHA-256 des octets bruts | \`${rawSha}\` |`,
    `| \`meta.datasetVersion\` | \`${version.version}\` — importer compatible \`${SUPPORTED_DATASET_RANGE}\` — ${version.ok ? "compatible" : "**INCOMPATIBLE, bloquant**"} |`,
    `| Sidecar \`${basename(sidecarPath)}\` | ${
      sidecarOk === null
        ? "**ABSENT — bloquant**"
        : sidecarOk
          ? "correspond"
          : "**DIVERGE — bloquant**"
    } |`,
  ];

  if (parsed.success) {
    const declared = parsed.data.meta.checksum;
    const recomputed = recomputeMetaChecksum(parsed.data.rooms);
    head.push(
      `| \`meta.checksum\` (informatif, cf. D2) | ${declared === recomputed ? "coherent" : "**diverge**"} |`,
      "",
      "`meta.checksum` est **declasse en informatif** : sa definition (« JSON.stringify(rooms) trie par",
      "cle, separateurs compacts ») est ambigue sur le tri recursif, l'encodage et la normalisation",
      "Unicode. Elle cassera le jour ou un titre contiendra un caractere non-ASCII. L'integrite qui",
      "bloque l'import est celle du sidecar, qui porte sur les octets bruts et ne souffre d'aucune",
      "interpretation.",
      "",
    );
  } else {
    head.push("");
  }

  head.push(
    "## 2. Contrat de donnees",
    "",
    parsed.success
      ? `Validation Zod : **conforme**, 0 violation sur ${parsed.data.rooms.length} rooms.`
      : `Validation Zod : **${zodErrors.length} violation(s)**.`,
    "",
    ...(zodErrors.length > 0 ? ["```", ...zodErrors, "```", ""] : []),
    "Ecarts assumes entre le contrat Zod et `rooms.schema.json` (le JSON Schema fait foi) :",
    "",
    ...CONTRACT_NOTES.map((note) => `- ${note}`),
    "",
  );

  if (!parsed.success) {
    writeFileSync(outPath, head.join("\n"), "utf8");
    console.error(`\nAUDIT EN ECHEC\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    console.error(`\nRapport partiel : ${outPath}\n`);
    return 1;
  }

  const stats = computeStats(parsed.data.rooms);
  const checks = runControlChecks(stats);
  const anomalies = detectAnomalies(parsed.data);
  const failedChecks = checks.filter((c) => !c.ok);
  if (failedChecks.length > 0) {
    problems.push(
      `Controles : ${failedChecks.length} statistique(s) divergent des valeurs attendues.`,
    );
  }
  const blocking = anomalies.filter((a) => a.severity === "bloquant" && a.count > 0);
  if (blocking.length > 0) {
    problems.push(`Anomalies bloquantes : ${blocking.map((a) => a.title).join(", ")}.`);
  }

  const body = [
    "## 3. Statistiques de controle",
    "",
    formatChecks(checks),
    "",
    "### Repartitions",
    "",
    formatStats(stats),
    "## 4. Anomalies",
    "",
    formatAnomalies(anomalies),
    "## 5. Verdict",
    "",
    problems.length === 0
      ? "**Dataset conforme.** Integrite verifiee, contrat respecte, statistiques reproduites. " +
        "Les anomalies listees en section 4 sont des defauts de qualite connus, a traiter par mapping " +
        "versionne, pas des violations de contrat."
      : `**Dataset a rejeter.**\n\n${problems.map((p) => `- ${p}`).join("\n")}`,
    "",
  ].join("\n");

  writeFileSync(outPath, `${head.join("\n")}\n${body}`, "utf8");

  // --- Sortie console -------------------------------------------------------
  console.log(`\nAudit de ${fileName}`);
  console.log(`  octets           : ${bytes.length}`);
  console.log(`  sha256 brut      : ${rawSha}`);
  console.log(
    `  sidecar          : ${sidecarOk === null ? "ABSENT" : sidecarOk ? "correspond" : "DIVERGE"}`,
  );
  console.log(`  contrat Zod      : conforme (${parsed.data.rooms.length} rooms)`);
  console.log(
    `  controles        : ${checks.length - failedChecks.length}/${checks.length} conformes`,
  );
  for (const check of failedChecks) {
    console.log(`     ECART  ${check.label} : attendu ${check.expected}, obtenu ${check.actual}`);
  }
  console.log(
    `  anomalies        : ${anomalies.filter((a) => a.count > 0).length} categories avec occurrences`,
  );
  console.log(`  rapport          : ${outPath}`);

  if (problems.length > 0) {
    console.error(`\nECHEC\n${problems.map((p) => `  - ${p}`).join("\n")}\n`);
    return 1;
  }
  console.log("\nOK — aucune correction appliquee, par construction.\n");
  return 0;
}

process.exitCode = main();
