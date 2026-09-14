import type {
  CategoryListResponse,
  RoomDetail,
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
  rooms: readonly RoomDetail[];
  tracks: readonly TrackDetailResponse[];
}>;

/**
 * Les codes sont la seule donnee catalogue conservee dans le navigateur. Les
 * titres, durees et statuts actifs restent donc lus depuis leur source de
 * verite, y compris pour une room retiree du catalogue.
 */
export async function loadProgressionResources(
  completedRoomCodes: readonly string[],
  signal: AbortSignal,
): Promise<ProgressionResources> {
  const [rooms, trackList] = await Promise.all([
    Promise.all(completedRoomCodes.map((code) => request<RoomDetail>(urls.room(code), signal))),
    request<TrackListResponse>(urls.tracks(), signal),
  ]);
  const tracks = await Promise.all(
    trackList.data.map((track) => request<TrackDetailResponse>(urls.track(track.slug), signal)),
  );

  return { rooms, tracks };
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
