import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

/**
 * Attribution du poids du bundle, dependance par dependance.
 *
 * `pnpm --filter @thm/web build:analyse`
 *
 * METHODE. On construit avec sourcemap, puis on decode les `mappings` du fichier
 * `.map` : chaque segment y associe une position du fichier GENERE a un fichier
 * SOURCE. En additionnant les octets generes entre deux segments consecutifs, on
 * obtient le nombre d'octets reellement emis pour chaque source. C'est une mesure,
 * pas une estimation par taille de paquet — ce qui compte est ce qui a survecu au
 * secouage d'arbre et a la minification.
 *
 * Aucune dependance : un visualiseur de bundle serait un paquet de plus a
 * maintenir pour un diagnostic qu'on lance trois fois par an.
 *
 * LIMITE ASSUMEE : le gzip est mesure sur le fichier ENTIER, pas par dependance.
 * Compresser chaque tranche isolement donnerait un chiffre faux — la compression
 * exploite les redondances entre tranches. Le ratio global est donc applique tel
 * quel, et c'est dit dans la sortie.
 */

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Decodage VLQ base64, format des `mappings` de source map. */
function decodeVlq(segment: string): number[] {
  const values: number[] = [];
  let shift = 0;
  let value = 0;

  for (const char of segment) {
    const digit = BASE64.indexOf(char);
    if (digit === -1) throw new Error(`caractere VLQ invalide : ${char}`);

    const continuation = (digit & 32) !== 0;
    value += (digit & 31) << shift;

    if (continuation) {
      shift += 5;
    } else {
      const negative = (value & 1) === 1;
      value >>= 1;
      values.push(negative ? (value === 0 ? -0x80000000 : -value) : value);
      value = 0;
      shift = 0;
    }
  }
  return values;
}

type SourceMap = { sources: string[]; mappings: string };

/** Octets generes attribues a chaque source. */
function bytesBySource(map: SourceMap, generatedLines: string[]): Map<string, number> {
  const total = new Map<string, number>();
  const lines = map.mappings.split(";");

  let sourceIndex = 0;
  for (const [lineNumber, line] of lines.entries()) {
    if (line === "") continue;
    let generatedColumn = 0;

    const segments = line.split(",");
    for (const [index, segment] of segments.entries()) {
      if (segment === "") continue;
      const fields = decodeVlq(segment);
      generatedColumn += fields[0] ?? 0;
      if (fields.length >= 4) sourceIndex += fields[1] ?? 0;

      // Le segment couvre jusqu'au segment suivant, ou jusqu'a la fin de ligne.
      const nextSegment = segments[index + 1];
      const nextColumn =
        nextSegment === undefined || nextSegment === ""
          ? (generatedLines[lineNumber]?.length ?? generatedColumn)
          : generatedColumn + (decodeVlq(nextSegment)[0] ?? 0);

      const source = map.sources[sourceIndex] ?? "(inconnu)";
      const width = Math.max(0, nextColumn - generatedColumn);
      total.set(source, (total.get(source) ?? 0) + width);
    }
  }

  return total;
}

/** Remonte d'un chemin de source au nom du paquet, ou au module applicatif. */
function attribute(source: string): string {
  const normalized = source.replace(/\\/g, "/");
  const match = /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/.exec(
    normalized,
  );
  if (match?.[1] !== undefined) return match[1];
  if (normalized.includes("packages/shared")) return "(notre code) @thm/shared";
  if (normalized.includes("/src/")) return "(notre code) apps/web";
  return "(divers)";
}

function main(): void {
  const dir = "dist/assets";
  const files = readdirSync(dir);
  const jsFile = files.find((name) => name.endsWith(".js"));
  const mapFile = files.find((name) => name.endsWith(".js.map"));

  if (jsFile === undefined || mapFile === undefined) {
    console.error(
      "Aucun bundle avec sourcemap dans dist/assets.\n" +
        "Lancer `pnpm --filter @thm/web build:analyse`, qui construit avec sourcemap.",
    );
    process.exitCode = 1;
    return;
  }

  const generated = readFileSync(`${dir}/${jsFile}`, "utf8");
  const map = JSON.parse(readFileSync(`${dir}/${mapFile}`, "utf8")) as SourceMap;

  const rawBytes = Buffer.byteLength(generated);
  const gzipBytes = gzipSync(generated).length;
  const ratio = gzipBytes / rawBytes;

  const perSource = bytesBySource(map, generated.split("\n"));
  const perPackage = new Map<string, number>();
  for (const [source, bytes] of perSource) {
    const name = attribute(source);
    perPackage.set(name, (perPackage.get(name) ?? 0) + bytes);
  }

  const attributed = [...perPackage.values()].reduce((sum, value) => sum + value, 0);
  const ranked = [...perPackage.entries()].sort((a, b) => b[1] - a[1]);

  const ko = (bytes: number): string => `${(bytes / 1024).toFixed(1)} ko`;

  console.log(`Bundle : ${jsFile}`);
  console.log(`  brut       ${ko(rawBytes)}`);
  console.log(`  gzip       ${ko(gzipBytes)}  (ratio ${(ratio * 100).toFixed(1)} %)`);
  console.log(`  attribue   ${ko(attributed)} par le sourcemap\n`);
  console.log("| Dependance | Brut | gzip estime | Part |");
  console.log("|---|---:|---:|---:|");

  for (const [name, bytes] of ranked) {
    if (bytes < 1024) continue;
    const share = ((bytes / attributed) * 100).toFixed(1);
    console.log(`| ${name} | ${ko(bytes)} | ${ko(bytes * ratio)} | ${share} % |`);
  }

  const small = ranked.filter(([, bytes]) => bytes < 1024);
  if (small.length > 0) {
    console.log(`\n${small.length} entrees sous 1 ko non listees.`);
  }
  console.log(
    "\nLe gzip par dependance est une ESTIMATION : le ratio global est applique a chaque\n" +
      "tranche. Compresser les tranches isolement donnerait un chiffre faux, la compression\n" +
      "exploitant les redondances entre elles. Seul le total gzip est mesure.",
  );
}

main();
