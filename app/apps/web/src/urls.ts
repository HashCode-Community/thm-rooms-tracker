/**
 * Adresses de l'API, construites a un seul endroit.
 *
 * `encodeURIComponent` et JAMAIS `.toLowerCase()` : 14 des 714 codes portent des
 * majuscules et l'API compare la casse (ADR-0001 Q1). Un repli ici donnerait un
 * 404 sur une room qui existe.
 */
export const urls = {
  rooms: (query: string) => `/api/rooms${query}`,
  facets: (query: string) => `/api/facets${query}`,
  room: (code: string) => `/api/rooms/${encodeURIComponent(code)}`,
  tags: () => "/api/tags",
  categories: () => "/api/categories",
  stats: () => "/api/stats",
  tracks: () => "/api/tracks",
  track: (slug: string) => `/api/tracks/${encodeURIComponent(slug)}`,
} as const;
