import type {
  CategoryListResponse,
  RoomBatchResponse,
  RoomBrief,
  TagListResponse,
  TrackDetailResponse,
  TrackListResponse,
} from "@thm/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { urls } from "./urls.js";

/**
 * Acces a l'API.
 *
 * Les types viennent de `@thm/shared`, c'est-a-dire des memes schemas Zod qui
 * serialisent les reponses cote serveur. Si une reponse change de forme, le front
 * cesse de compiler. C'est tout l'interet d'avoir bouge le contrat dans un package
 * partage plutot que de recopier des interfaces ici.
 *
 * Pas de bibliotheque de cache : le catalogue tient en 714 lignes, les donnees de
 * reference portent leur propre `Cache-Control`, et une dependance de plus se
 * justifierait par un besoin, pas par une habitude.
 */

/** Erreur d'API, avec le `detail` RFC 9457 quand le serveur en fournit un. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type Problem = { title?: string; detail?: string; errors?: Array<{ message: string }> };

/** Codes rendus par un intermediaire quand le serveur applicatif ne repond pas. */
const PASSERELLE = new Set([502, 503, 504]);

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const init: RequestInit = { headers: { accept: "application/json" } };
  // `exactOptionalPropertyTypes` : `signal: undefined` n'est pas la meme chose
  // qu'une cle absente. On ne pose la cle que si on a vraiment un signal.
  if (signal !== undefined) init.signal = signal;

  let response: Response;
  try {
    response = await fetch(path, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    // `fetch` rejette avec « Failed to fetch », qui ne dit rien a personne.
    throw new ApiError(0, "API injoignable. Verifiez votre connexion, puis reessayez.");
  }

  if (!response.ok) {
    // Le serveur repond en RFC 9457 : on affiche son `detail`, pas un « erreur 400 »
    // qui n'aiderait personne.
    let message = `HTTP ${response.status}`;
    try {
      const problem = (await response.json()) as Problem;
      const parts = [
        problem.detail ?? problem.title,
        ...(problem.errors ?? []).map((e) => e.message),
      ];
      const joined = parts.filter(Boolean).join(" — ");
      if (joined !== "") message = joined;
    } catch {
      // Corps illisible : on garde le code HTTP. Ne jamais masquer l'erreur initiale.
    }
    if (PASSERELLE.has(response.status)) {
      message = `L'API ne repond pas (HTTP ${response.status}). Elle est peut-etre arretee.`;
    }
    throw new ApiError(response.status, message);
  }

  return (await response.json()) as T;
}

// --- Donnees de reference --------------------------------------------------

/**
 * Les noms des tags et la liste des categories ne changent qu'a l'import. Une
 * promesse memorisee au niveau du module suffit : on ne refait pas la requete a
 * chaque navigation, et le `Cache-Control` de l'API couvre les rechargements.
 */
let tagsPromise: Promise<TagListResponse> | null = null;
let categoriesPromise: Promise<CategoryListResponse> | null = null;

export function loadTags(): Promise<TagListResponse> {
  tagsPromise ??= request<TagListResponse>(urls.tags()).catch((error: unknown) => {
    tagsPromise = null; // un echec ne doit pas se figer pour la session entiere
    throw error;
  });
  return tagsPromise;
}

export function loadCategories(): Promise<CategoryListResponse> {
  categoriesPromise ??= request<CategoryListResponse>(urls.categories()).catch((error: unknown) => {
    categoriesPromise = null;
    throw error;
  });
  return categoriesPromise;
}

export type ProgressionResources = Readonly<{
  rooms: readonly RoomBrief[];
  /** Codes presents dans le navigateur mais absents du catalogue. */
  missing: readonly string[];
  tracks: readonly TrackDetailResponse[];
}>;

/**
 * Plafond de codes par tranche, cote CLIENT.
 *
 * Deliberement sous `MAX_BATCH_CODES`, qui est le plafond du SERVEUR. Les deux
 * ne mesurent pas la meme chose : le serveur borne le travail qu'il accepte, le
 * client borne la taille de l'URL qu'il emet. Les confondre reviendrait a viser
 * la limite de l'autre.
 */
export const BATCH_CHUNK_CODES = 100;

/**
 * Plafond d'octets de l'URL RESOLUE, prefixe compris.
 *
 * POURQUOI DEUX BORNES. `nginx` n'accorde pas 8 ko a l'URL : `large_client_header_buffers`
 * couvre la ligne de requete ET les en-tetes. Avec un cookie et un `User-Agent`,
 * une URL de 6 ko entre dans la zone ou ca casse en production et nulle part
 * ailleurs. Mesure sur le dataset 1.0.0 : une tranche des 200 codes les plus longs
 * fait 5906 octets, des 100 plus longs 3325 octets. Le compte seul ne borne donc
 * PAS l'URL — seuls 56 des codes les plus longs tiennent dans 2048 octets.
 *
 * La premiere borne atteinte ferme la tranche. Sur les codes reels (19 octets
 * medians) c'est le compte qui mord ; sur des codes longs c'est le budget. Dans
 * les deux cas l'URL respecte le plafond, quelle que soit l'entree : c'est un
 * invariant, pas une esperance, et un test l'exige.
 *
 * POURQUOI 1900 ET PAS 2048. Un empaqueteur glouton remplit jusqu'a sa borne :
 * mesure au navigateur sur les 714 rooms, l'URL la plus longue faisait 2046
 * octets pour un plafond de 2048. Deux octets de marge, ce qui ne tient que
 * tant que le front mesure EXACTEMENT ce que le serveur recevra. Un prefixe de
 * chemin pose au deploiement, un proxy qui reecrit, et la ligne de requete recue
 * depasse la chaine mesuree ici. A 1900, la meme progression tient toujours en 8
 * tranches — l'URL la plus longue fait 1895 octets — et il reste 148 octets de
 * marge. La prudence ne coute donc aucune requete.
 */
export const BATCH_CHUNK_BYTES = 1900;

/**
 * Longueur de la partie fixe de l'adresse, DERIVEE du constructeur d'URL.
 *
 * Jamais ecrite en dur : si une base d'API est posee un jour (`VITE_API_BASE_URL`,
 * un prefixe de deploiement), elle apparait dans ce que `roomBatch` produit, donc
 * elle entre dans le budget sans que personne ait a y penser. Une constante
 * recopiee, elle, resterait a 17 et le budget deviendrait faux en silence.
 */
export const BATCH_URL_BASE = urls.roomBatch([]).length;

/**
 * Cout exact d'un code dans l'URL, separateur compris.
 *
 * Mesure avec l'encodeur que `urls.roomBatch` utilise reellement, pas avec
 * `encodeURIComponent` : `URLSearchParams` echappe davantage de caracteres, donc
 * une estimation a l'oeil SOUS-estimerait le cout sur un code exotique.
 */
function codeCost(code: string): number {
  return new URLSearchParams([["code", code]]).toString().length + 1;
}

/**
 * Decoupe les codes en tranches que l'API accepte ET qu'un proxy laissera passer.
 *
 * Le defaut corrige ici : le front envoyait les 714 codes d'un coup a un point
 * d'entree qui en accepte 200. Mesure avant correction : 400 codes rendaient
 * HTTP 400, donc la page mourait a 201 rooms terminees sur 714.
 */
export function chunkCodes(
  codes: readonly string[],
  /** Longueur du prefixe. Parametrable pour que le test couvre une base longue. */
  urlBaseBytes: number = BATCH_URL_BASE,
): readonly (readonly string[])[] {
  const chunks: (readonly string[])[] = [];
  let current: string[] = [];
  let bytes = urlBaseBytes;

  for (const code of codes) {
    const cost = codeCost(code);
    // `current.length > 0` : un code a lui seul plus long que le budget forme sa
    // propre tranche plutot que de boucler sans fin ou de produire une tranche
    // vide. Le plus long du catalogue coute 50 octets, mais une regle qui depend
    // des donnees du jour n'est pas une regle.
    if (
      current.length > 0 &&
      (current.length >= BATCH_CHUNK_CODES || bytes + cost > BATCH_CHUNK_BYTES)
    ) {
      chunks.push(current);
      current = [];
      bytes = urlBaseBytes;
    }
    current.push(code);
    bytes += cost;
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}
/**
 * Recompose les tranches dans L'ORDRE DES CODES DEMANDES.
 *
 * Le point d'entree rend chaque tranche triee par `lower(title), code`. Concatener
 * deux tranches ainsi triees ne redonne PAS une liste triee par titre : le
 * resultat dependrait du decoupage, donc du nombre de rooms terminees. Reproduire
 * le tri cote navigateur demanderait de reproduire la collation de PostgreSQL,
 * ce qui est faux des le premier titre non-ASCII — il y en a un dans le dataset.
 *
 * L'ordre rendu est donc celui de l'appelant, qui ne depend d'aucune tranche.
 * L'invariant tenu ici est plus fort que l'ordre : `rooms` et `missing` forment
 * ensemble, exactement une fois chacun, les codes demandes. Aucun code ne peut
 * disparaitre entre deux tranches.
 */
function recompose(
  requestedCodes: readonly string[],
  batches: readonly RoomBatchResponse[],
): { rooms: readonly RoomBrief[]; missing: readonly string[] } {
  const byCode = new Map<string, RoomBrief>();
  for (const batch of batches) {
    for (const room of batch.rooms) byCode.set(room.code, room);
  }

  const rooms: RoomBrief[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const code of requestedCodes) {
    if (seen.has(code)) continue;
    seen.add(code);
    const room = byCode.get(code);
    if (room === undefined) missing.push(code);
    else rooms.push(room);
  }
  return { rooms, missing };
}

/**
 * Les codes sont la seule donnee catalogue conservee dans le navigateur. Les
 * titres, durees et statuts actifs restent donc lus depuis leur source de
 * verite, y compris pour une room retiree du catalogue.
 *
 * UNE requete par tranche, pas une par room. Voir `BATCH_CHUNK_CODES`.
 *
 * La version 8a faisait `Promise.all` sur un appel par code. Mesure au navigateur
 * avec les 61 rooms des trois parcours : 65 requetes HTTP par affichage, et
 * lineaire ensuite — 300 rooms terminees auraient donne 304 requetes. Deux
 * consequences, la seconde pire que la premiere :
 *
 *   1. le navigateur plafonne a six connexions par origine, donc onze vagues ;
 *   2. `Promise.all` rejette au premier echec. Un seul code inconnu, ou un seul
 *      429 rendu par la limite de debit que la phase 9 va poser, faisait tomber
 *      la page entiere — l'utilisateur perdait l'acces a une progression
 *      parfaitement valide a cause d'une seule entree.
 *
 * `/api/rooms/batch` rend les deux impossibles : les codes inconnus reviennent
 * dans `missing` avec un statut 200, et le catalogue entier tient en 8 tranches.
 */
export async function loadProgressionResources(
  completedRoomCodes: readonly string[],
  signal: AbortSignal,
): Promise<ProgressionResources> {
  const [batches, trackList] = await Promise.all([
    Promise.all(
      chunkCodes(completedRoomCodes).map((chunk) =>
        request<RoomBatchResponse>(urls.roomBatch(chunk), signal),
      ),
    ),
    request<TrackListResponse>(urls.tracks(), signal),
  ]);
  const tracks = await Promise.all(
    trackList.data.map((track) => request<TrackDetailResponse>(urls.track(track.slug), signal)),
  );

  return { ...recompose(completedRoomCodes, batches), tracks };
}

// --- Hook de chargement ----------------------------------------------------

export type Async<T> =
  | { status: "loading"; data: T | null }
  | { status: "ok"; data: T }
  | { status: "error"; error: Error; data: T | null };

/**
 * Charge une ressource et expose TROIS etats, jamais deux.
 *
 * `data` est conserve pendant un rechargement : quand on change un filtre, la
 * liste precedente reste a l'ecran, grisee, au lieu de laisser un trou blanc.
 * Un ecran qui se vide a chaque clic donne l'impression que l'application casse.
 *
 * La dependance est l'URL elle-meme. Elle decrit entierement la requete, elle est
 * utilisee dans le corps de l'effet, et la liste de dependances est donc
 * exhaustive sans avoir a desactiver la regle qui le verifie.
 */
export function useResource<T>(url: string): Async<T> & { reload: () => void } {
  const [state, setState] = useState<Async<T>>({ status: "loading", data: null });
  const inFlight = useRef<AbortController | null>(null);

  /**
   * Lance la requete et rend sa fonction d'annulation.
   *
   * Elle depend de `url`, et `url` est utilisee dans son corps : la liste de
   * dependances de l'effet est donc exhaustive sans qu'on ait a desactiver la
   * regle qui le verifie. Un garde qu'on desactive a chaque fois qu'il gene ne
   * garde plus rien.
   */
  const run = useCallback((): (() => void) => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setState((previous) => ({ status: "loading", data: previous.data }));

    request<T>(url, controller.signal)
      .then((data) => {
        setState({ status: "ok", data });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState((previous) => ({
          status: "error",
          error: error instanceof Error ? error : new Error(String(error)),
          data: previous.data,
        }));
      });

    return () => {
      controller.abort();
    };
  }, [url]);

  useEffect(() => run(), [run]);

  const reload = useCallback((): void => {
    run();
  }, [run]);

  return { ...state, reload };
}

export { urls };
