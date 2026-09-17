/**
 * Adresses de l'API, construites a un seul endroit.
 *
 * `encodeURIComponent` et JAMAIS `.toLowerCase()` : 14 des 714 codes portent des
 * majuscules et l'API compare la casse (ADR-0001 Q1). Un repli ici donnerait un
 * 404 sur une room qui existe.
 */

/**
 * Origine de l'API, posee a la CONSTRUCTION par `VITE_API_BASE_URL`.
 *
 * VIDE EN DEVELOPPEMENT, et c'est voulu : `vite.config.ts` proxifie `/api` vers
 * l'API locale, donc un chemin relatif y suffit et rien n'est a regler.
 *
 * EN PRODUCTION IL N'Y A AUCUN PROXY. Le site est servi par un hebergeur
 * statique, l'API vit sur un autre domaine. Sans cette base, le navigateur
 * appelle l'origine du SITE, et le defaut ne ressemble pas a sa cause :
 *
 *   1. `/api/stats` ne correspond a aucun fichier chez l'hebergeur ;
 *   2. la regle de repli `/*  /index.html  200` l'attrape et rend `index.html`
 *      en 200 `text/html` ;
 *   3. `response.ok` vaut donc VRAI : la branche RFC 9457 et la branche
 *      502/503/504 de `api.ts` sont toutes deux sautees ;
 *   4. `response.json()` echoue sur « Unexpected token '<' », et c'est ce
 *      message-la que le visiteur voit.
 *
 * Aucune erreur CORS n'apparait en console, puisque aucun appel n'a quitte
 * l'origine. Chercher du cote de `CORS_ORIGINS` ou de `connect-src` ne peut
 * donc rien donner : les deux sont corrects, et le front ne les sollicite
 * jamais.
 *
 * La barre oblique finale est retiree : chaque chemin ci-dessous commence deja
 * par `/`, et `https://api.exemple.fr//api/stats` n'est pas la meme adresse.
 *
 * `import.meta.env?.` ET PAS `import.meta.env.` : les tests de ce paquet
 * tournent sous `node:test`, directement sur le source, SANS passer par Vite.
 * La chose n'existe pas dans ce contexte, et l'acces direct levait
 * « Cannot read properties of undefined ». Vite, lui, remplace l'expression
 * entiere a la construction : le `?.` ne lui coute rien, et il est verifie en
 * fin de `preparer-le-site.ps1` que l'adresse est bien arrivee dans le bundle.
 */
const base = (import.meta.env?.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export const urls = {
  rooms: (query: string) => `${base}/api/rooms${query}`,
  facets: (query: string) => `${base}/api/facets${query}`,
  room: (code: string) => `${base}/api/rooms/${encodeURIComponent(code)}`,
  /**
   * Parametre REPETE, jamais `code[]` : c'est ce que produit `URLSearchParams`
   * sans reglage, et l'API l'accepte tel quel. Aucun `.toLowerCase()`, ici non
   * plus.
   */
  roomBatch: (codes: readonly string[]) => {
    const params = new URLSearchParams();
    for (const code of codes) params.append("code", code);
    return `${base}/api/rooms/batch?${params.toString()}`;
  },
  tags: () => `${base}/api/tags`,
  categories: () => `${base}/api/categories`,
  stats: () => `${base}/api/stats`,
  tracks: () => `${base}/api/tracks`,
  track: (slug: string) => `${base}/api/tracks/${encodeURIComponent(slug)}`,
} as const;
