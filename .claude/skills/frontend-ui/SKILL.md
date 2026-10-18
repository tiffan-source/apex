---
name: frontend-ui
description: Obligatoire avant toute intervention front-end dans une application (apps/**) — créer ou modifier une page, un composant Angular, un template HTML, une mise en page, une modale, un formulaire, un affichage responsive ou le mode sombre, corriger un bug visuel. Explique comment construire l'interface avec PrimeNG, le preset du design system (libs/design-tokens) et les classes .ds-*, sans jamais écrire de CSS custom. Use for any UI, frontend, styling, layout, component or template work.
---

# Construire une interface avec le design system

Toutes les applications de productivité partagent un design system unique : `libs/design-tokens`.
**Aucune application n'écrit de CSS.** L'apparence vient des composants PrimeNG habillés par le preset partagé, et la mise en page vient des classes `.ds-*`.

Si une demande semble exiger du CSS custom, c'est le signe qu'il manque quelque chose au design system. Dans ce cas, on le fait évoluer (skill `design-system-evolution`) au lieu de le contourner.

## 1. Comprendre avant de coder

Avant d'écrire la moindre ligne de template, lire :

1. `libs/design-tokens/README.md` : principes et règles.
2. `libs/design-tokens/src/layout.css` : les classes de mise en page disponibles. Ce sont les **seules** classes autorisées, avec les icônes `pi` et `pi-*`.
3. `libs/design-tokens/src/primeng-preset.ts` : les composants déjà habillés et les variantes exportées (`avatarTone`…).
4. Les sections « 2. SÉMANTIQUES » et « 3. COMPOSANTS » de `libs/design-tokens/src/tokens.css`, si un `[dt]` ou une largeur d'overlay est nécessaire.
5. [references/catalogue-primeng.md](references/catalogue-primeng.md) : quel composant PrimeNG pour quel besoin.
6. L'écran existant le plus proche de la demande (voir § 4), pour reprendre sa structure.

## 2. L'échelle de décision

Pour chaque besoin visuel, descendre cette échelle et s'arrêter au premier niveau qui répond :

| #   | Question                                                                       | Réponse                                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Un composant PrimeNG fait-il ça ?                                              | L'utiliser tel quel (catalogue).                                                                                                                                                                                                                                                   |
| 2   | Le composant existe, mais son apparence ne convient pas, **partout** ?         | Modifier le preset : skill `design-system-evolution`.                                                                                                                                                                                                                              |
| 3   | Une **seule** instance doit différer ?                                         | `[dt]` avec uniquement des `var(--ds-*)`. Préférer une variante exportée par le preset (`[dt]="avatarTone.success"`). Déclarer l'objet en propriété `readonly` du composant, jamais en ligne dans le template. Si la même variante sert à 2 endroits, l'exporter depuis le preset. |
| 4   | C'est de la mise en page (empilement, alignement, espacement, grille, texte) ? | Classes `.ds-*` de `layout.css`.                                                                                                                                                                                                                                                   |
| 5   | Rien ne convient ?                                                             | **Ne pas écrire de CSS.** S'arrêter, expliquer le manque à l'utilisateur et proposer un ajout au design system (skill `design-system-evolution`).                                                                                                                                  |

## 3. Interdits

Le contrôle automatique (`npx nx lint design-tokens`) refuse tout ce qui suit :

- Tout fichier `.css`, `.scss`, `.sass` ou `.less` dans les applications, sauf `src/styles.css`, qui ne contient que des `@import`.
- `styleUrl`, `styleUrls` ou `styles` dans un `@Component`.
- L'attribut `style="…"`, `[ngStyle]`, `[attr.style]`, `::ng-deep`, `!important`, et toute modification de `element.style` par le code.
- `[style]` ou `[style.x]`, sauf pour la largeur de `p-dialog`, `p-drawer` et `p-popover`, et uniquement avec des tokens : `[style]="{ width: 'var(--ds-dialog-width)' }"`.
- Les valeurs brutes dans un template ou dans le TypeScript : couleurs (`#hex`, `rgb()`, `hsl()`, `'red'`…) et longueurs (`px`, `rem`, `em`). Toujours `var(--ds-…)` ; seuls `%`, `vw` et `vh` sont tolérés.
- Les classes inventées : seules les classes `ds-*` définies dans `layout.css` et les icônes `pi`/`pi-*` sont permises. Pas de `[ngClass]`, `[class]` ou `class="{{ … }}"` : utiliser `[class.ds-xxx]="condition"`. Pas de PrimeFlex ni de Tailwind (non installés).
- Les tokens ou classes inexistants : tout `var(--ds-x)` et toute classe `ds-x` doivent exister. En cas de doute, chercher dans les fichiers ; ne jamais deviner un nom.
- Un thème ou un preset dans une application : pas d'import de `@primeuix/themes` (Lara, Aura…) ni de `definePreset`. `providePrimeNG` utilise `DesignSystemPreset`.
- Un point de rupture qui n'est pas un `--ds-breakpoint-*` (640, 768, 1024 ou 1280 px) dans `[breakpoints]`.

## 4. Modèles existants à réutiliser

Chemins relatifs à `apps/apex-client/src/`.

| Besoin                               | Où regarder                                            | Structure                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| En-tête de page                      | `app/board/board.html`                                 | `header.ds-row.ds-between.ds-wrap` > (`div.ds-stack.ds-gap-1` > `h1` + `p`) + bouton principal                              |
| Page                                 | toutes                                                 | contenu dans `div.ds-stack.ds-gap-8` (le conteneur `.ds-page` est posé par le shell)                                        |
| Grille de statistiques               | `app/board/stats-card/`                                | `section.ds-grid.ds-grid-fit.ds-grid-stat` > `p-card` > `p-avatar [dt]="avatarTone.x"` + `.ds-figure`                       |
| Grille de cartes cliquables          | `app/board/board.html`                                 | `div.ds-grid.ds-grid-card.ds-grid-stretch` > `a.ds-link-block[routerLink]` > `p-card`                                       |
| Carte avec titre, compteur et action | `app/board/objective-overview/objective-overview.html` | `p-card` > `#title` : `ds-row ds-between` (`h3` + `p-badge` / bouton `variant="text"`)                                      |
| Liste cliquable                      | `objective-overview.html`, `matrix/quadrant/`          | `ul.ds-stack.ds-gap-0-5` > `li.ds-row.ds-list-row` > `p-checkbox` + `button.ds-button-reset.ds-grow` + `p-tag`              |
| État vide                            | `app/focus/focus.html`, `app/board/board.html`         | `ds-stack ds-gap-2 ds-items-center ds-text-center` + `p-avatar` + texte + bouton                                            |
| Formulaire                           | `app/board/create-objective/`                          | `form.ds-stack` > champs `div.ds-stack.ds-gap-2` (`label[for]` + contrôle `fluid`) > `div.ds-row.ds-end.ds-gap-2` (boutons) |
| Modale                               | `objective-overview/edit-task/`                        | `p-dialog header="…"`, `[style]` et `[breakpoints]` en tokens, boutons dans `#footer`                                       |
| Panneau latéral                      | `objective-overview/edit-objective/`                   | `p-drawer` avec `#content` et `#footer`                                                                                     |
| Message d'erreur                     | `app/auth/`                                            | `p-message severity="error" icon="pi pi-exclamation-circle" role="alert"`                                                   |
| Bloc teinté                          | `focus.ts`, `objective-overview.ts`                    | `readonly xxxTokens = { root: { background: 'var(--ds-color-accent-soft)', shadow: 'none' } }` puis `[dt]="xxxTokens"`      |
| Navigation                           | `app/shell/shell.html`                                 | `p-toolbar` dans `nav.ds-float-bottom.ds-icons-only-mobile`, liens `a[pButton]` + `routerLinkActive`                        |

## 5. Pièges connus

- **Slots de template qui masquent des propriétés.** `<ng-template #title>`, `#subtitle`, `#header`, `#footer`, `#content` créent une variable de template qui masque une propriété du composant du même nom : `title()` devient un `TemplateRef` et la compilation échoue (`TS2349`). Ne jamais nommer une entrée ou un signal `title`, `subtitle`, `header`, `footer` ou `content` dans un composant qui utilise ces slots (préférer `label`, `description`…).
- **`pButton` n'a pas d'entrée `variant`.** Sur un `<a pButton>`, utiliser `[text]="true"` ou `[outlined]="true"` ; `variant="text"` ne fonctionne que sur le composant `<p-button>`.
- **Étiquettes étirées.** Un `p-tag` ou un `p-badge` placé dans un `ds-stack` s'étire sur toute la largeur : ajouter `class="ds-self-start"`.
- **Listes coupées dans les overlays.** Dans une modale ou un panneau latéral, `p-select`, `p-multiselect` et `p-datepicker` ont besoin de `appendTo="body"`, sinon leur liste est coupée.
- **`severity="secondary"` sur le fond de page.** Son fond est identique au fond de page, donc invisible : sur le fond de page, préférer une `p-card`.
- **Dates.** Utiliser `p-datepicker`, déjà traduit en français. Le contrôle de formulaire porte une `Date`, pas une chaîne.
- **Ordre des déclarations dans `layout.css`.** À spécificité égale, la classe déclarée le plus bas l'emporte. Si une combinaison de classes ne donne pas le rendu attendu, c'est souvent la cause : le signaler au lieu de contourner.
- **Libellés masqués sur mobile.** `ds-icons-only-mobile` masque les libellés des boutons sur petit écran : fournir `ariaLabel` (composant) ou `aria-label` (directive) à chaque bouton.

## 6. Textes et accessibilité

- Interface en **français**, avec les accents (« Tâches terminées », pas « Taches terminees »).
- Boutons : un verbe d'action (« Enregistrer », « Créer l'objectif », « Annuler »). Le bouton d'annulation (`severity="secondary" variant="text"`) se place **avant** l'action principale.
- Dates et nombres : pipes Angular (la locale est `fr`), par exemple `date:'d MMM y'` ou `number:'1.0-0'`.
- Tout élément cliquable est un `<button>` ou un `<a>`. Une ligne cliquable (`li` avec `(click)`) contient un vrai `<button>` pour l'accès au clavier.
- Toute icône seule a un nom accessible (`ariaLabel`, `aria-label`) ; les icônes décoratives ont `aria-hidden="true"`.
- Un message d'erreur est annoncé (`role="alert"`) ; un chargement en cours a `role="status"`.

## 7. Vérifier avant de rendre la main

1. `npx nx lint design-tokens` : 0 violation. Corriger chaque violation dans l'esprit de la règle, jamais en contournant le contrôle. Dans Claude Code, un hook lance déjà ce contrôle après chaque modification d'un fichier front-end et renvoie les violations : les corriger aussitôt, avant de continuer.
2. `npx nx typecheck apex-client`, puis `npx nx build apex-client`.
3. Contrôle visuel de chaque écran touché, en mode clair, en mode sombre (réglage du système) et à 375 px de large : lancer l'app avec `npx nx serve apex-client --excludeTaskDependencies`.
4. Dans le compte rendu, dire quels composants PrimeNG et quelles classes ont été utilisés. Si un besoin n'a pas pu être couvert, le dire explicitement et proposer l'évolution du design system correspondante.
