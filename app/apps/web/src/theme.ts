/**
 * Choix de theme.
 *
 * TROIS ETATS, PAS DEUX. « Systeme » n'est pas la meme chose que « clair » : un
 * utilisateur qui n'a rien choisi doit suivre sa machine, y compris quand
 * celle-ci bascule au coucher du soleil. Reduire a une bascule binaire
 * figerait ce cas sur la valeur du moment.
 *
 * Le meme mecanisme de secours que la progression : le stockage peut refuser
 * l'acces ou etre plein. Le choix se perd alors au rechargement, la preference
 * systeme reprend la main, et rien ne casse.
 */

export const THEME_STORAGE_KEY = "thm-roadmap.theme";

export type Theme = "systeme" | "clair" | "sombre";

/** Ce que porte l'attribut `data-theme`, dans la langue de CSS. */
const ATTRIBUT: Readonly<Record<Theme, string | null>> = {
  systeme: null,
  clair: "light",
  sombre: "dark",
};

const DEPUIS_ATTRIBUT: Readonly<Record<string, Theme>> = {
  light: "clair",
  dark: "sombre",
};

export type ThemeStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/**
 * Lit le choix ENREGISTRE, pas le theme applique.
 *
 * Une valeur inconnue — ecrite par une version anterieure, ou a la main — est
 * traitee comme « systeme » plutot que corrigee : on ne devine pas ce que
 * quelqu'un a voulu dire.
 */
export function lireChoix(getStorage: () => ThemeStorage): Theme {
  let brut: string | null;
  try {
    brut = getStorage().getItem(THEME_STORAGE_KEY);
  } catch {
    return "systeme";
  }
  if (brut === null) return "systeme";
  return DEPUIS_ATTRIBUT[brut] ?? "systeme";
}

/**
 * Applique le choix au document, et l'enregistre.
 *
 * L'attribut est pose AVANT l'ecriture : si le stockage refuse, le theme
 * s'applique quand meme pour la session en cours. L'inverse — enregistrer puis
 * appliquer — laisserait l'utilisateur devant un bouton qui ne fait rien.
 */
export function appliquerChoix(
  choix: Theme,
  racine: { setAttribute(nom: string, valeur: string): void; removeAttribute(nom: string): void },
  getStorage: () => ThemeStorage,
): void {
  const attribut = ATTRIBUT[choix];
  if (attribut === null) racine.removeAttribute("data-theme");
  else racine.setAttribute("data-theme", attribut);

  try {
    const storage = getStorage();
    if (attribut === null) storage.removeItem(THEME_STORAGE_KEY);
    else storage.setItem(THEME_STORAGE_KEY, attribut);
  } catch {
    // Le theme tient pour cette session, et se perdra au rechargement. C'est
    // une degradation acceptable ; refuser d'appliquer ne le serait pas.
  }
}

/** L'ordre du cycle, pour une bascule a un seul bouton. */
export const CYCLE: readonly Theme[] = ["systeme", "clair", "sombre"];

export function suivant(courant: Theme): Theme {
  const index = CYCLE.indexOf(courant);
  return CYCLE[(index + 1) % CYCLE.length] ?? "systeme";
}

export const LIBELLE: Readonly<Record<Theme, string>> = {
  systeme: "Thème du système",
  clair: "Thème clair",
  sombre: "Thème sombre",
};
