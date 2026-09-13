/**
 * LA CONVENTION D'URL DU PROJET, definie une seule fois pour les deux cotes.
 *
 * Ce module vit dans `packages/shared` et non dans l'API parce que le front
 * l'utilise aussi : l'URL affichee dans la barre d'adresse et l'URL envoyee a
 * l'API ont exactement la meme syntaxe. Une vue filtree est donc partageable
 * telle quelle, et il n'y a aucune traduction a maintenir entre les deux.
 *
 * Analyseur de chaine de requete.
 *
 * Le brief ecrit les filtres multi-valeurs `?difficulty[]=easy&difficulty[]=medium`.
 * MESURE sur Fastify 5.12.3, analyseur par defaut :
 *
 *   ?difficulty[]=easy&difficulty[]=medium  ->  { "difficulty[]": ["easy","medium"] }
 *   ?difficulty=easy&difficulty=medium      ->  { "difficulty":   ["easy","medium"] }
 *   ?difficulty=easy                        ->  { "difficulty":   "easy" }
 *
 * La cle porte donc litteralement les crochets, et une valeur unique n'est pas un
 * tableau. Deux consequences si on ne fait rien : le schema Zod devrait declarer
 * les deux orthographes de chaque cle, et chaque champ devrait accepter
 * `string | string[]`.
 *
 * Cet analyseur retire le suffixe `[]` des cles a l'entree. Le schema n'en voit
 * donc qu'une seule forme, et les deux ecritures d'URL sont equivalentes — celle
 * du brief et celle que produit naturellement `URLSearchParams` cote front.
 * La normalisation `string | string[]` reste du ressort de Zod (cf. `asArray`).
 */
export function parseQueryString(raw: string): Record<string, unknown> {
  // Une `Map` plutot qu'un objet litteral, puis `Object.fromEntries`.
  // Sur un objet litteral, `out[key] = value` avec `key === "__proto__"` declenche
  // le setter de prototype : une chaine de requete suffit alors a polluer le
  // prototype. `Object.fromEntries` cree des proprietes de donnees et n'appelle
  // aucun setter. C'est un point de la phase 9 traite ici parce qu'il est gratuit
  // a ce moment precis et couteux a rattraper ensuite.
  const out = new Map<string, string | string[]>();

  for (const [rawKey, value] of new URLSearchParams(raw)) {
    const key = rawKey.endsWith("[]") ? rawKey.slice(0, -2) : rawKey;
    if (key === "") continue;

    // `?durationMin=&q=` : un parametre vide ne porte aucune information. On le
    // traite comme ABSENT plutot que comme une valeur a valider. Sans cette regle,
    // une interface qui serialise un curseur non renseigne recevrait un 400 pour
    // une URL parfaitement legitime.
    if (value === "") continue;

    const existing = out.get(key);
    if (existing === undefined) {
      out.set(key, value);
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      out.set(key, [existing, value]);
    }
  }

  return Object.fromEntries(out);
}

/** Valeurs acceptees dans une chaine de requete. */
export type QueryValue = string | number | boolean | null | undefined | readonly string[];

/**
 * Reciproque de `parseQueryString`.
 *
 * Une valeur multiple produit une cle REPETEE (`?tech=a&tech=b`), jamais un
 * tableau encode en JSON : c'est ce que l'API attend et ce qu'un humain peut
 * lire dans sa barre d'adresse.
 *
 * `omitWhenDefault` retire les valeurs qui ne changent rien. Sans lui, chaque
 * lien porterait `?sort=popular&page=1&limit=24` alors que ces trois valeurs
 * sont deja celles par defaut. Le tour est stable : ce qui est retire est par
 * definition ce que l'analyse redonnera.
 */
export function stringifyQueryString(
  search: Record<string, QueryValue>,
  omitWhenDefault: Readonly<Record<string, unknown>> = {},
): string {
  const params = new URLSearchParams();

  for (const key of Object.keys(search).sort()) {
    const value = search[key];
    if (value === undefined || value === null || value === "") continue;
    if (Object.hasOwn(omitWhenDefault, key) && omitWhenDefault[key] === value) continue;

    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry !== "") params.append(key, entry);
      }
      continue;
    }
    params.append(key, String(value));
  }

  const serialized = params.toString();
  return serialized === "" ? "" : `?${serialized}`;
}
