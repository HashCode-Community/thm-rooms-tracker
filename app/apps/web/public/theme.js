/*
 * Applique le theme choisi AVANT la premiere peinture.
 *
 * POURQUOI UN FICHIER SEPARE, ET PAS UN SCRIPT EN LIGNE. Un `<script>` en ligne
 * exigerait `'unsafe-inline'` dans la politique de contenu du front, ou un
 * condensat a tenir a jour a chaque modification. Un fichier servi par la meme
 * origine passe avec `script-src 'self'`, qui reste strict.
 *
 * POURQUOI PAS DANS LE PAQUET PRINCIPAL. Celui-ci est un module : il s'execute
 * apres l'analyse du document, donc APRES que la feuille de style a peint le
 * fond. Un utilisateur ayant choisi le sombre sur une machine reglee en clair
 * verrait un eclair blanc a chaque ouverture de page — precisement le defaut
 * corrige sur `color-scheme`.
 *
 * Ce fichier est charge sans `type="module"`, en tete de document : il s'execute
 * pendant l'analyse, avant tout rendu.
 */
(() => {
  try {
    const choix = window.localStorage.getItem("thm-roadmap.theme");
    if (choix === "light" || choix === "dark") {
      document.documentElement.setAttribute("data-theme", choix);
    }
  } catch (_) {
    // Stockage inaccessible : navigation privee, cookies bloques. Sans choix
    // explicite lisible, la preference du systeme s'applique — ce qui est
    // exactement le bon repli.
  }
})();
