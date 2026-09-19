import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseSearch,
  stringifySearch,
  toApiQuery,
  toFacetQuery,
  validateRoomSearch,
} from "../src/search.js";
import { urls } from "../src/urls.js";

/**
 * Les DEUX seules choses du front qui ne se voient pas a l'oeil.
 *
 * Tout le reste du catalogue est du code visible : une regression de mise en page
 * ou d'etat se remarque en trente secondes dans le navigateur. Ces deux-la, non.
 *
 *   - une regression de serialisation d'URL rendrait les vues partagees
 *     inexploitables sans qu'aucun ecran ne change d'apparence ;
 *   - un `.toLowerCase()` glisse dans la construction d'un lien produirait un lien
 *     MORT vers TryHackMe, decouvert par un utilisateur.
 *
 * `node:test`, integre a Node 24, et non Vitest : ces deux fichiers sont des
 * fonctions pures, sans DOM ni transformation. Ajouter un lanceur de tests au
 * paquet front pour ca aurait ete une dependance de plus a maintenir pour zero
 * capacite supplementaire.
 *
 *   pnpm --filter @thm/web test
 */

/** Un vrai code du dataset, pas un code invente. 14 des 714 sont dans ce cas. */
const CODE_A_MAJUSCULES = "AIforcyber-aoc2025-y9wWQ1zRgB";

describe("urls.room — la casse du code est intouchable", () => {
  it("preserve la casse exacte du code", () => {
    assert.equal(urls.room(CODE_A_MAJUSCULES), `/api/rooms/${CODE_A_MAJUSCULES}`);
  });

  it("ne replie JAMAIS en minuscules", () => {
    // L'URL TryHackMe sortante se deduit du code. Un repli ici donne un 404 chez
    // eux, decouvert par l'utilisateur (ADR-0001 Q1).
    assert.notEqual(urls.room(CODE_A_MAJUSCULES), `/api/rooms/${CODE_A_MAJUSCULES.toLowerCase()}`);
    assert.match(urls.room(CODE_A_MAJUSCULES), /AIforcyber/);
    assert.match(urls.room(CODE_A_MAJUSCULES), /y9wWQ1zRgB/);
  });

  it("encode ce qui doit l'etre sans toucher aux caracteres legitimes", () => {
    // `-`, `.`, `_` et `~` sont non reserves : `encodeURIComponent` les laisse.
    assert.equal(urls.room("a-b.c_d~e"), "/api/rooms/a-b.c_d~e");
    assert.equal(urls.room("a/b"), "/api/rooms/a%2Fb");
  });
});

describe("serialisation des filtres dans l'URL", () => {
  it("ecrit les valeurs multiples en cles REPETEES, pas en JSON", () => {
    // C'est la convention que l'API comprend. Un tableau encode en JSON
    // (`?tech=%5B%22linux%22%5D`) serait illisible ET incompris du serveur.
    assert.equal(stringifySearch({ tech: ["linux", "windows"] }), "?tech=linux&tech=windows");
  });

  it("retire les valeurs par defaut", () => {
    // Sans ca, chaque lien du site porterait `?sort=popular&page=1&limit=24`.
    assert.equal(stringifySearch({ sort: "popular", page: 1, limit: 24 }), "");
    assert.equal(stringifySearch({ sort: "az", page: 1, limit: 24 }), "?sort=az");
    assert.equal(stringifySearch({ sort: "popular", page: 3, limit: 24 }), "?page=3");
  });

  it("retire les valeurs vides et absentes", () => {
    assert.equal(stringifySearch({ q: "", tech: [], durationMin: undefined }), "");
  });

  it("l'aller-retour d'une vue partagee est fidele", () => {
    // LA propriete qui compte : coller une URL dans une autre fenetre doit rendre
    // exactement la meme vue. Le chemin complet passe par la validation, comme le
    // fait le routeur — et c'est la que tout se joue.
    const search = {
      q: "nmap",
      difficulty: ["easy", "medium"] as const,
      tech: ["linux"],
      durationMin: 30,
      page: 4,
    };
    assert.deepEqual(validateRoomSearch(parseSearch(stringifySearch(search))), {
      q: "nmap",
      difficulty: ["easy", "medium"],
      tech: ["linux"],
      durationMin: 30,
      page: 4,
    });
  });

  it("l'analyse BRUTE ne normalise pas : une valeur unique reste une chaine", () => {
    // `?tech=linux` donne `"linux"`, pas `["linux"]`. C'est voulu : la
    // normalisation appartient au schema Zod, partage avec l'API, pas a
    // l'analyseur d'URL. Ecrit ici parce que la premiere version de ce test s'y
    // est trompee.
    assert.deepEqual(parseSearch("?tech=linux"), { tech: "linux" });
    assert.deepEqual(validateRoomSearch({ tech: "linux" }).tech, ["linux"]);
  });

  it("une URL invalide retombe sur le catalogue complet, sans ecran d'erreur", () => {
    // Un lien tronque par un client de messagerie ne doit pas punir celui qui
    // clique dessus.
    assert.deepEqual(validateRoomSearch({ page: -5, sort: "n'importe quoi" }), {});
  });

  it("accepte `?tech[]=` comme `?tech=` a la lecture", () => {
    assert.deepEqual(parseSearch("?tech[]=linux&tech[]=windows"), {
      tech: ["linux", "windows"],
    });
  });

  it("`toApiQuery` garde les valeurs par defaut explicites", () => {
    // L'API n'a pas de barre d'adresse a garder lisible : ce qui compte ici est
    // que la requete decrive exactement l'etat affiche.
    assert.equal(
      toApiQuery({ sort: "popular", page: 1, limit: 24 }),
      "?limit=24&page=1&sort=popular",
    );
  });

  it("`toFacetQuery` retire tri et pagination, jamais les filtres", () => {
    const query = toFacetQuery({
      sort: "az",
      page: 3,
      limit: 50,
      tech: ["linux"],
      q: "nmap",
    });
    assert.equal(query, "?q=nmap&tech=linux");
  });

  it("un code a majuscules survit a un aller-retour dans la recherche", () => {
    // Cas tordu mais reel : un utilisateur colle un code dans le champ de
    // recherche. Rien ne doit le replier en chemin.
    const serialized = stringifySearch({ q: CODE_A_MAJUSCULES });
    assert.equal(parseSearch(serialized).q, CODE_A_MAJUSCULES);
  });
});
