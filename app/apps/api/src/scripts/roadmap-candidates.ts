import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { asc, desc, eq, sql } from "drizzle-orm";
import { closeDatabase, db } from "../db/client.js";
import { difficulties, rooms, roomTags, roomTypes, tags } from "../db/schema.js";

/**
 * `pnpm roadmap:candidates`
 *
 * Produit `data/reports/roadmap-candidates.md` : un regroupement thematique des
 * 714 rooms, trie par difficulte croissante puis par popularite.
 *
 * CE N'EST PAS UNE ROADMAP. C'est de la matiere premiere.
 *
 * Tout ici est `derived` au sens d'ADR-0001 : deduit MECANIQUEMENT des tags du
 * dataset, sans aucun jugement pedagogique. Un regroupement par tag ne dit pas
 * dans quel ordre apprendre — il dit seulement ce qui parle du meme sujet. Passer
 * de cette liste a un parcours est un travail editorial, et ce passage-la ne
 * s'automatise pas.
 */

const ROOT = resolve(import.meta.dirname, "../../../..");
const OUTPUT = resolve(ROOT, "data/reports/roadmap-candidates.md");

/** Nombre de rooms listees par competence. Les technologies sont listees en entier. */
const SKILL_SAMPLE = 15;
/** Nombre de competences detaillees, par ordre de nombre de rooms. */
const SKILL_GROUPS = 25;

type Row = {
  code: string;
  title: string;
  difficultyKey: string;
  difficultyLevel: number;
  typeKey: string;
  durationMinutes: number | null;
  usersCount: number | null;
};

const DIFFICULTY_SHORT: Readonly<Record<string, string>> = {
  info: "info",
  easy: "facile",
  medium: "moyen",
  hard: "difficile",
  insane: "extreme",
};

function line(row: Row): string {
  const users = row.usersCount === null ? "?" : row.usersCount.toLocaleString("fr-FR");
  const duration = row.durationMinutes === null ? "?" : `${row.durationMinutes} min`;
  const difficulty = DIFFICULTY_SHORT[row.difficultyKey] ?? row.difficultyKey;
  return `| ${row.title} | \`${row.code}\` | ${difficulty} | ${duration} | ${users} |`;
}

const TABLE_HEADER = "| Room | Code | Difficulte | Duree | Participants |\n|---|---|---|---|---|";

/**
 * Rooms portant un tag donne, triees par difficulte CROISSANTE puis popularite
 * DECROISSANTE. C'est l'ordre dans lequel on cherche un point d'entree : le plus
 * accessible d'abord, et parmi les egaux, le plus frequente.
 */
async function roomsForTag(kind: "technology" | "skill", slug: string): Promise<Row[]> {
  return db
    .select({
      code: rooms.code,
      title: rooms.title,
      difficultyKey: difficulties.key,
      difficultyLevel: difficulties.level,
      typeKey: roomTypes.key,
      durationMinutes: rooms.durationMinutes,
      usersCount: rooms.usersCount,
    })
    .from(rooms)
    .innerJoin(difficulties, eq(difficulties.id, rooms.difficultyId))
    .innerJoin(roomTypes, eq(roomTypes.id, rooms.roomTypeId))
    .innerJoin(roomTags, eq(roomTags.roomId, rooms.id))
    .innerJoin(tags, eq(tags.id, roomTags.tagId))
    .where(sql`${rooms.isActive} and ${tags.kind} = ${kind} and ${tags.slug} = ${slug}`)
    .orderBy(asc(difficulties.level), desc(rooms.usersCount), asc(rooms.code));
}

async function tagGroups(kind: "technology" | "skill") {
  return db
    .select({ slug: tags.slug, name: tags.name, total: sql<number>`count(*)::int` })
    .from(tags)
    .innerJoin(roomTags, eq(roomTags.tagId, tags.id))
    .innerJoin(rooms, eq(rooms.id, roomTags.roomId))
    .where(sql`${tags.kind} = ${kind} and ${rooms.isActive}`)
    .groupBy(tags.id, tags.slug, tags.name)
    .orderBy(desc(sql`count(*)`), asc(tags.slug));
}

async function main(): Promise<void> {
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");

  const [{ total = 0 } = {}] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(rooms)
    .where(eq(rooms.isActive, true));

  const technologies = await tagGroups("technology");
  const skills = await tagGroups("skill");

  const [{ orphans = 0 } = {}] = await db
    .select({ orphans: sql<number>`count(*)::int` })
    .from(rooms)
    .where(
      sql`${rooms.isActive} and not exists (
        select 1 from ${roomTags}
        join ${tags} on ${tags.id} = ${roomTags.tagId}
        where ${roomTags.roomId} = ${rooms.id} and ${tags.kind} = 'technology'
      )`,
    );

  const out: string[] = [];

  out.push("# Candidats de parcours — matiere premiere");
  out.push("");
  out.push(`> **Genere le ${now} par \`pnpm roadmap:candidates\`. Ne pas editer a la main.**`);
  out.push(">");
  out.push("> **Origine : `derived`.** Tout ce document est deduit MECANIQUEMENT des tags du");
  out.push("> dataset. Aucun jugement pedagogique n'y est porte.");
  out.push(">");
  out.push("> **Ce n'est pas une roadmap, et ca ne peut pas en devenir une par transformation.**");
  out.push("> Un regroupement par tag dit ce qui parle du meme sujet ; il ne dit ni par ou");
  out.push("> commencer, ni ce qui se comprend mieux apres quoi. Les donnees TryHackMe ne");
  out.push("> contiennent aucun prerequis et aucun ordre pedagogique. Le passage de cette liste");
  out.push("> a un parcours est un travail editorial, ecrit et relu a la main dans");
  out.push("> `data/roadmap/tracks/*.yaml`.");
  out.push("");
  out.push("## Comment lire ce document");
  out.push("");
  out.push("Dans chaque groupe, les rooms sont triees par **difficulte croissante**, puis par");
  out.push("**nombre de participants decroissant**. C'est l'ordre dans lequel on cherche un point");
  out.push("d'entree : le plus accessible d'abord, et parmi les equivalents, le plus frequente.");
  out.push("");
  out.push("La popularite n'est pas une mesure de qualite. Elle mesure l'anciennete, la mise en");
  out.push("avant par TryHackMe et le bouche-a-oreille autant que l'interet du contenu.");
  out.push("");
  out.push(`- **${total}** rooms actives`);
  out.push(`- **${technologies.length}** technologies, **${skills.length}** competences`);
  out.push(`- **${orphans}** rooms ne portent aucune technologie : elles n'apparaissent que dans`);
  out.push("  la section competences, ou pas du tout. Ce n'est pas un defaut du dataset, c'est");
  out.push("  une absence de tag chez TryHackMe.");
  out.push("");
  out.push("  Le rapport d'audit annonce **164** rooms sans technologie et les deux chiffres sont");
  out.push("  justes : 164 ont un champ `technologies` vide, et 6 de plus n'ont que `N/A`, qui");
  out.push("  est traite comme une ABSENCE et ne devient jamais un tag. 164 + 6 = 170.");
  out.push("");

  out.push("## Par technologie");
  out.push("");
  out.push("Listing complet.");
  out.push("");

  for (const group of technologies) {
    const groupRooms = await roomsForTag("technology", group.slug);
    out.push(`### ${group.name} — ${group.total} rooms`);
    out.push("");
    out.push(TABLE_HEADER);
    for (const row of groupRooms) out.push(line(row));
    out.push("");
  }

  out.push("## Par competence");
  out.push("");
  out.push(
    `Les ${Math.min(SKILL_GROUPS, skills.length)} competences les plus representees, ` +
      `${SKILL_SAMPLE} rooms au plus par competence.`,
  );
  out.push("");
  out.push("Le tableau complet des competences est dans `data/exports/rooms.csv`.");
  out.push("");

  for (const group of skills.slice(0, SKILL_GROUPS)) {
    const groupRooms = await roomsForTag("skill", group.slug);
    const shown = groupRooms.slice(0, SKILL_SAMPLE);
    out.push(`### ${group.name} — ${group.total} rooms`);
    out.push("");
    out.push(TABLE_HEADER);
    for (const row of shown) out.push(line(row));
    if (groupRooms.length > shown.length) {
      out.push("");
      out.push(`_...et ${groupRooms.length - shown.length} autres._`);
    }
    out.push("");
  }

  const remaining = skills.slice(SKILL_GROUPS);
  if (remaining.length > 0) {
    out.push(`### Les ${remaining.length} autres competences`);
    out.push("");
    out.push(remaining.map((group) => `${group.name} (${group.total})`).join(" · "));
    out.push("");
  }

  writeFileSync(OUTPUT, `${out.join("\n")}\n`, "utf8");
  console.log(`Ecrit : ${OUTPUT}`);
  console.log(`  ${technologies.length} groupes de technologie, listing complet`);
  console.log(`  ${Math.min(SKILL_GROUPS, skills.length)} groupes de competence detailles`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => {
    void closeDatabase();
  });
