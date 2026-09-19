/// <reference types="vite/client" />

/**
 * Variables de construction du front.
 *
 * POURQUOI LES DECLARER. `vite/client` type `import.meta.env` avec une signature
 * d'index `[key: string]: any` : sans la declaration ci-dessous, une faute de
 * frappe comme `VITE_API_BASE_UR` compilerait, vaudrait `undefined`, et le site
 * repartirait en chemins relatifs — exactement le defaut que `urls.ts` decrit,
 * mais sans rien pour le signaler.
 *
 * Le type est `string | undefined` et non `string` : la variable est ABSENTE en
 * developpement, ou le proxy de `vite.config.ts` rend la base inutile. Ce
 * `undefined` est un cas normal, pas un oubli, et le `?? ""` de `urls.ts` le
 * traite explicitement.
 *
 * Rappel : tout ce qui est pose ici part dans le bundle et devient LISIBLE par
 * n'importe quel visiteur. Aucun secret ne passe par ce chemin.
 */
interface ImportMetaEnv {
  /** Origine absolue de l'API, sans barre oblique finale. Cf. `urls.ts`. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
