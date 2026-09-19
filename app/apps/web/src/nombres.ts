/**
 * Un seul formateur de nombres pour tout le produit.
 *
 * `toLocaleString("fr-FR")` etait appele a quatre endroits, chacun avec ses
 * options implicites : un chiffre de l'accueil, un compteur anime, un pied de
 * carte, une fiche. Quatre appels sont quatre occasions de diverger, et c'est
 * ce qui s'est produit — la fiche affichait un nombre a sept chiffres sans
 * separateur de milliers.
 *
 * L'instance est construite UNE FOIS : `Intl.NumberFormat` coute cher a
 * l'instanciation et rien ici ne change de langue.
 */
const FRANCAIS = new Intl.NumberFormat("fr-FR");

export function nombre(valeur: number): string {
  return FRANCAIS.format(valeur);
}
