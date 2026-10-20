# Journal des modifications — design-tokens

Une entrée par modification, la plus récente en haut. Rubriques : Ajouté, Modifié, Déprécié, Supprimé.
Version (semver, `package.json`) : majeure = suppression ou renommage, mineure = ajout, correctif = ajustement de valeur.
Tant que la version est en 0.x (développement initial), un changement cassant passe en version mineure.

## 2.1.0 — 2026-10-21

Revue contradictoire de la couche et du contrôle, avant la migration des écrans.

### Ajouté

- `.ds-show-mobile` : visible seulement sous 760px (`@media (width > 760px)`, annotée `--ds-breakpoint-sm`), pour l'accès aux réglages de la coque quand `eNavBas` disparaît. Comme `.ds-hide-mobile`, sur un élément simple.
- `.ds-skip-link` : lien d'évitement « Aller au contenu », hors de l'écran tant qu'il n'a pas le focus, puis posé en haut à gauche sur un panneau (`.e-masque` reste masqué au focus, catalogue § 5.4).
- `.ds-prose` : texte rendu depuis le Markdown (réponses d'Akari) : blocs espacés de pas-3, listes en retrait de pas-6, mots longs coupés, bloc de code qui défile (catalogue § 9).
- `.ds-link` : un lien dans le texte prend l'encre du texte qui l'entoure (sans elle, le bleu et le violet du navigateur, absents d'Empreinte : la base d'Empreinte ne règle pas les liens).
- `--ds-arete-min-width` (640px, maquette `Arete`) et `.ds-scroll-x > .e-arete-hote` : dans `.ds-scroll-x`, l'arête garde cette largeur et défile au lieu de rétrécir. Sans cela, à 375px, une arête de 6 étapes (viewBox de 755) était réduite à environ 40 % (noms à environ 6px).

### Modifié

- `.ds-scroll-x` : commentaire corrigé (l'arête ne défilait pas : elle prend 100 % de la largeur).
- Contrôle `tools/design-system/check.mjs`. Désormais signalés : une classe `e-*` du kit écrite à la main hors des cas du catalogue § 5.4 (`kit-class`, par exemple `span.e-sceau`, `button.e-btn`, `p.e-note__qui`) ; une directive d'Empreinte mal nommée ou posée sur un élément qu'elle ne vise pas, qui ne ferait rien (`unknown-directive` : `div[eBouton]`, `input[eCase]` sans `type="checkbox"` écrit en dur, `eBoutton`) ; tous les gabarits en ligne, entre apostrophes, guillemets ou accents graves, plusieurs par fichier ; `host: { style }`, `@HostBinding('style…')`, `@HostBinding('class')`, `@HostBinding('class.x')` (classe vérifiée), `bind-style` ; les styles et classes posés par le code (`Object.assign(el.style, …)`, `renderer.setAttribute(el, 'style', …)`, `classList.add`, `addClass` (classes vérifiées), `className =`) ; `<link rel="stylesheet">` ; un `@import` autre qu'Empreinte dans `styles.css` ; dans la couche, l'apparence d'un composant ou d'un élément retouchée (couleur, fond, bordure, ombre) et `@media (prefers-color-scheme)` ; une couleur ou une longueur en dur dans `index.ts`. Corrigé : une expression régulière qui contient une apostrophe ou un guillemet (`/'/g`) faussait la lecture de tout le reste du fichier TypeScript (plus rien n'y était signalé) ; un bloc de thème d'Empreinte autre que Jour ou Nuit (par exemple sous `prefers-color-scheme: dark`) se mêlait aux valeurs Jour du contrôle du contraste.

## 2.0.0 — 2026-10-21

Rupture : Apex quitte PrimeNG pour Empreinte. La librairie devient « la mise en page d'Apex, posée sur Empreinte » : l'identité (couleurs Jour et Nuit, typographie, pas, cornes, traits, mouvement) vient exclusivement de `@empreinte-studio/tokens`, l'apparence des composants de `@empreinte-studio/angular`. Ce qui reste ici ne fait que placer.

### Supprimé

- `src/primeng-preset.ts` : `DesignSystemPreset`, `designSystemThemeOptions`, `avatarTone`, `AvatarTone`. Le thème passe par `provideEmpreinte()` ; il n'y a plus de réglage d'apparence par instance (`[dt]`).
- Tous les tokens de couleur, de typographie, d'ombre, d'arrondi, d'animation et de composant PrimeNG de `tokens.css` (`--ds-color-*`, `--ds-font-*`, `--ds-text-*`, `--ds-radius-*`, `--ds-shadow-*`, `--ds-card-*`, `--ds-dock-*`, `--ds-dialog-*`, `--ds-drawer-*`, `--ds-chat-*`, `--ds-space-*` sauf `--ds-space-0-5|5|10`, `--ds-size-*`…). Leurs équivalents sont les tokens d'Empreinte : `var(--encre)`, `var(--encre-douce)`, `var(--panneau)`, `var(--trame)`, `var(--pas-4)`…
- La remise à zéro globale et la base (`body`, titres, liens, focus) de `layout.css` : c'est `base.css` d'Empreinte qui pose la page et l'anneau de focus.
- Les classes `.ds-*` liées à PrimeNG ou à l'ancienne identité : `.ds-float-bottom`, `.ds-icons-only-mobile`, `.ds-fill`, `.ds-grid-fit`, `.ds-grid-stretch`, `.ds-grid-stat|card|panel|field`, `.ds-grid-2`, `.ds-max-panel`, `.ds-end`, `.ds-text-muted`, `.ds-text-sm|xs`, `.ds-text-strong`, `.ds-text-italic`, `.ds-strike`, `.ds-first-upper`, `.ds-clamp-2`, `.ds-figure`, `.ds-figure-xl`, `.ds-list-row`, `.ds-link-block`, `.ds-button-reset`, `.ds-chat-bubble`. La typographie passe par les 8 styles d'Empreinte (`detail`, `repere`…), le texte doux par `.ds-muted`, une tâche faite par `li[eTache]` (jamais barrée).
- `--ds-breakpoint-xl` (1280px).

### Ajouté

- `tokens.css` : pas intermédiaire `--ds-space-7` (28px) ; largeurs `--ds-page-max-width`, `--ds-page-title-basis`, `--ds-measure`, `--ds-narrow-width`, `--ds-grid-min-width`, `--ds-screen-height` ; marges des panneaux `--ds-panel-padding-*` ; colonnes `--ds-check-lead`, `--ds-entry-lead` ; conversation `--ds-conversation-gap`, `--ds-reply-author-width`, `--ds-reply-author-indent`.
- `layout.css`, vocabulaire tiré des maquettes du canvas « Apex » : `.ds-page-header`, `.ds-title-row`, `.ds-actions`, `.ds-grid-auto`, `.ds-panels` (la trame), `.ds-cols-2|3|2-1|7-6`, `.ds-span-2`, `.ds-span-all`, `.ds-panel`, `.ds-panel-flush`, `.ds-list-bare`, `.ds-divided`, `.ds-rule-top`, `.ds-rule-block`, `.ds-check`, `.ds-entry`, `.ds-conversation`, `.ds-reply`, `.ds-reply-author`, `.ds-composer`, `.ds-justify-end|center`, `.ds-items-stretch`, `.ds-self-center|end`, `.ds-no-shrink`, `.ds-push-down|right`, `.ds-gap-0|5|10|12`, `.ds-muted`, `.ds-nowrap`, `.ds-truncate`, `.ds-text-end`, `.ds-measure`, `.ds-scroll-x`, `.ds-hide-mobile`.
- `index.ts` : `DS_BREAKPOINTS`, `DS_MEDIA` et le type `DsBreakpoint`, pour `BreakpointObserver`.
- Contrôle `tools/design-system/check.mjs` réécrit pour Empreinte : couche Apex (pas de couleur, sélecteurs partant d'une `.ds-*`, valeurs en tokens, pas de typographie ni de forme, media queries égales aux points de rupture, `index.ts` aligné), contraste des couples promis par le brand book d'Empreinte en Jour et en Nuit, applications (aucun style, classes `.ds-*`, `e-*` et typographiques seulement, tokens connus, plus aucune trace de PrimeNG), ordre des styles.

### Modifié

- `.ds-page` : plus de réserve pour le dock, largeur max 1120px comme `e-coque__contenu`, sections empilées à pas-8. `.ds-screen-center` et `.ds-narrow` : mêmes rôles, valeurs sur les tokens.
- `.ds-stack`, `.ds-row`, `.ds-grid`, `.ds-wrap`, `.ds-between`, `.ds-items-*`, `.ds-self-start`, `.ds-grow`, `.ds-gap-0-5|1|2|3|4|6|8`, `.ds-break`, `.ds-text-center` : mêmes rôles, valeurs sur les pas d'Empreinte ; `.ds-gap-*` règle directement `gap` (plus de variable `--ds-gap` héritée par les conteneurs imbriqués). `.ds-grid` n'a plus qu'une colonne par défaut (colonnes : `.ds-cols-*` ou `.ds-grid-auto`).
- `--ds-breakpoint-sm|md|lg` : 640 / 768 / 1024px → 760 / 900 / 1100px (la coque d'Empreinte passe en mobile à 760px ; les maquettes regroupent les grilles à 900px et 1100px).
- `--ds-space-0-5|5|10` : mêmes valeurs (2, 20, 40px), désormais construites sur les pas d'Empreinte.
- Ordre des styles d'une application : `apps/<app>/src/styles.css` (qui importe `@empreinte-studio/tokens/empreinte.css`), puis `tokens.css`, puis `layout.css`.

## 0.2.0 — 2026-10-18

### Ajouté

- Contrôle automatique `tools/design-system/check.mjs` (`npx nx lint design-tokens`) : CSS interdit dans les applications, valeurs brutes, classes et tokens inconnus, hiérarchie des niveaux, mode sombre, contraste WCAG AA en clair et en sombre.
- Primitifs d'ombre : `--ds-shadow-geometry-sm|md|lg` et teintes `--ds-color-black-alpha-8|12|35|50`.
- Sémantiques d'ombre : `--ds-color-shadow`, `--ds-color-shadow-strong` (le mode sombre ne change que ces teintes).

### Modifié

- `--ds-color-gray-500` : `#6b7280` → `#626977`. Le texte secondaire atteint 4,5:1 sur le fond de page (4,36:1 avant).
- `--ds-color-warning` et `--ds-color-warning-soft` : orange → jaune (700 sur 50 en clair, 300 en sombre). Le texte d'avertissement atteint 4,5:1 sur son fond doux (3,35:1 avant), et « Déléguer » reste distinct de « Faire » (rouge).
- `--ds-shadow-sm|md|lg` sont construits sur les primitifs d'ombre (rendu inchangé).

### Supprimé

- `--ds-color-overlay-shadow` et `--ds-color-overlay-shadow-strong`, remplacés par `--ds-color-shadow` et `--ds-color-shadow-strong`.
- `--ds-color-eisenhower-*` : la matrice utilise les sévérités PrimeNG (Faire = danger, Déléguer = warn, Planifier = info, Éliminer = secondary).
- `--ds-layout-section-gap` (inutilisé).

## 0.1.0 — 2026-10-18

### Ajouté

- `tokens.css` : primitifs, sémantiques (clair et sombre), composants.
- `primeng-preset.ts` : preset PrimeNG construit sur les tokens, variantes `avatarTone`.
- `layout.css` : remise à zéro, base, classes de mise en page `.ds-*`.
