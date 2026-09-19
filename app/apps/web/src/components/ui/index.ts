/**
 * Composants d'interface reutilisables.
 *
 * Ils n'inventent pas de style : ils s'appuient sur les classes semantiques de
 * `styles.css`. Leur raison d'etre est de retirer la DUPLICATION — dix
 * `className="bouton"` ecrits a la main derivent, un `<Button>` non — et de
 * rendre impossibles les oublis d'accessibilite : un `<Input>` sans etiquette
 * ne compile pas.
 */
export { Badge, type TonPastille } from "./Badge.js";
export { Button, type VarianteBouton } from "./Button.js";
export { Callout, type TonEncart } from "./Callout.js";
export { Card } from "./Card.js";
export { EmptyState } from "./EmptyState.js";
export { Input } from "./Input.js";
export { ProgressBar } from "./ProgressBar.js";
export { Select } from "./Select.js";
export { type FormeSquelette, Skeleton } from "./Skeleton.js";
