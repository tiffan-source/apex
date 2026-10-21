---
name: frontend-ui
description: Obligatoire avant toute intervention front-end dans une application (apps/**) — créer ou modifier un écran, un composant Angular, un gabarit HTML, une mise en page, une feuille (dialogue), un formulaire, un affichage responsive, le thème Jour ou Nuit, un texte d'interface, ou corriger un bug visuel. Explique comment construire l'interface d'Apex avec le design system Empreinte (@empreinte-studio/angular — eBouton, eCarte, eTache, e-pas, e-arete, e-matrice, eNote, e-champ, Feuilles, eCoque…), ses 8 styles typographiques et les classes de mise en page .ds-* de libs/design-tokens, sans jamais écrire de CSS, et comment écrire dans la voix d'Empreinte. Use for any UI, frontend, Empreinte, styling, layout, component, template, theme, accessibility or UI copy work.
---

# Construire une interface Apex avec Empreinte

Apex ne dessine rien lui-même. Trois sources, et rien d'autre :

- **L'apparence** vient des composants **Empreinte** (`@empreinte-studio/angular`), qui embarquent leur feuille, et de ses tokens (`@empreinte-studio/tokens` : couleurs Jour et Nuit, pas, cornes, traits, polices).
- **Le texte** prend l'un des **8 styles typographiques** d'Empreinte : `manifeste`, `objectif`, `voix`, `palier`, `section`, `corps`, `detail`, `repere`.
- **La mise en page** vient des classes **`.ds-*`** de `libs/design-tokens/src/layout.css` (la couche de mise en page d'Apex, posée sur Empreinte).

**Aucun CSS dans l'application.** Si un écran semble en exiger, c'est qu'il manque quelque chose : on fait évoluer Empreinte ou la couche Apex (skill `design-system-evolution`), on ne contourne pas.

PrimeNG est retiré et désinstallé (`primeng`, `@primeuix/themes`, `primeicons`, le preset, `[dt]`, les `pi pi-*`, les toasts). Ne le réintroduis jamais.

## 1. Lire avant de coder

Avant d'écrire la moindre ligne de gabarit :

1. **Le cahier de la migration** : `docs/features/migration-empreinte.md`. Il fait autorité : périmètre V1 et routes, vocabulaire (objectif, étape, pas, arête, laisser filer) et règles de données, Akari comme geste, voix, `AnnoncesStore` à la place des toasts, thème, liste de vérification d'un écran.
2. **Le catalogue des composants** : [references/catalogue-empreinte.md](references/catalogue-empreinte.md). API exacte de chaque composant de la version installée (sélecteurs, entrées, sorties, contenu projeté, clavier, formulaires), icônes, fonctions de voix, classes `e-*` (qui les pose, quand on peut les écrire), tokens, table PrimeNG → Empreinte (§ 7), pièges (§ 8), manques de la librairie (§ 9). En cas de doute sur une API : `node_modules/@empreinte-studio/angular/types/*.d.ts`, jamais la mémoire.
3. **La couche de mise en page** : `libs/design-tokens/src/layout.css` (chaque classe y est commentée) et `libs/design-tokens/README.md`. Ce sont les **seules** classes de mise en page permises.
4. **La maquette de l'écran** : canvas « Apex » https://claude.ai/artifact/E59CU8bjiq7EhNft2hZHCy, fichiers `project/<Nom>.dc.html`. V1 : `Objectifs`, `Arete`, `Matrice`, `Akari`. Hors V1 : `Main` (Aujourd'hui), `Carnet`, `Palier`. Ouvre-les avec l'outil Artifact (`read`), pas avec un fetch web. Elles sont écrites avec des styles en ligne et les classes du kit : elles donnent l'intention (hiérarchie, textes, espacements, ce qui porte la corne), **pas le code**. On les retranscrit en composants Empreinte et en classes `.ds-*`.
5. **Le brand book Empreinte** : design system « Empreinte » https://claude.ai/artifact/QBkmtgtj9oKk8xdJPb2QNe (`project/README.md`, `project/components/*/README.md`) : les trois gestes (trame, corne, empreinte), la voix d'Akari, les couleurs.
6. **Des exemples d'usage** : la vitrine du dépôt https://github.com/empreinte-studio/empreinte (`apps/vitrine/src/app/pages/*.ts`, dont `apex.ts`) et son `docs/MIGRATION-APEX.md`.
7. **L'écran migré le plus proche** (§ 6), pour reprendre sa structure.

## 2. L'échelle de décision

Pour chaque besoin visuel, descendre l'échelle et s'arrêter au premier niveau qui répond :

| #   | Question | Réponse |
| --- | --- | --- |
| 1   | Un composant Empreinte fait-il ça ? | Le poser, sur l'élément natif quand il s'y pose (`button[eBouton]`, `input[eSaisie]`, `li[eTache]`, `a[eLienNav]`…), et régler son apparence **par ses entrées** : variante `sceau` / `trait` / `nu`, `petit`, `icone`, `marquee`, `nue`, `eCorne`… Catalogue § 2, table de correspondance § 7. |
| 2   | Il faut une sous-partie que le composant ne pose pas lui-même ? | Une classe `e-*` écrite à la main, **uniquement** dans les cas du catalogue § 5.4 : `e-carte__entete`, `e-carte__pied`, `e-carte__meta`, `e-carte__raison` dans un `[eCarte]` ; `e-nav__marque` sur la marque de la navigation ; `e-masque` (lecteurs d'écran). Jamais pour recréer un composant : `<e-empreinte>` et non `span.e-sceau`, `<e-pas>` et non `div.e-pas`, `button[eBouton]` et non `button.e-btn`. |
| 3   | C'est du texte, ou de la mise en page (empiler, aligner, espacer, grille, trame de panneaux, responsive) ? | Texte : un des 8 styles typographiques, plus `.ds-muted` pour l'encre douce. Mise en page : les classes `.ds-*` de `layout.css` (§ 6). Une classe se bascule avec `[class.ds-x]="condition"`. |
| 4   | Rien ne convient ? | **Ne pas écrire de CSS.** S'arrêter, expliquer le manque à l'utilisateur et proposer une évolution (skill `design-system-evolution`) : **de la couche Apex** (`libs/design-tokens`) si c'est de la mise en page ; **d'Empreinte, en amont**, dans le dépôt `empreinte-studio/empreinte`, si c'est de l'apparence, un composant, une variante, une icône ou un token. Les manques déjà connus et leur contournement sont au catalogue § 9. |

## 3. Interdits

Le contrôle automatique (`npx nx lint design-tokens`, `tools/design-system/check.mjs`) refuse, dans `apps/<app>/src` :

**Fichiers et styles globaux**

- Toute feuille `.css`, `.scss`, `.sass` ou `.less` dans `apps/`, `libs/`, `apex-library/` ou `worklfows/`, sauf `apps/<app>/src/styles.css` et les deux feuilles de `libs/design-tokens/src`.
- Dans `styles.css`, autre chose que des `@import` ; le premier doit être `@import '@empreinte-studio/tokens/empreinte.css';`.
- Dans `apps/<app>/project.json`, un tableau `"styles"` différent de `["apps/<app>/src/styles.css", "libs/design-tokens/src/tokens.css", "libs/design-tokens/src/layout.css"]`, dans cet ordre.

**Gabarits** (`.html` et `template:` en ligne)

- La balise `<style>`, l'attribut `style="…"`, toute liaison `[style]` ou `[style.x]`, `[attr.style]`, `[ngStyle]` ; `::ng-deep` et `!important`.
- `[ngClass]`, `[class]`, `[className]`, `[attr.class]` et toute interpolation dans `class="{{ … }}"`. Écrire les classes en clair, et basculer avec `[class.ds-x]="condition"`.
- Toute classe hors de ces trois familles : les classes `.ds-*` définies dans `layout.css`, les classes `e-*` réellement livrées par Empreinte, les 8 styles typographiques. Pas de classe inventée, ni Tailwind, ni PrimeFlex.
- Une valeur brute dans un attribut (sauf `href`, `routerLink`, `fragment`, `src`) : couleur (`#hex`, `rgb()`, `hsl()`, `color-mix()`, nom de couleur), longueur avec unité (`px`, `rem`, `em`, `vh`, `vw`, `dvh`, `ch`…). **Permis** : un nombre sans unité passé à une entrée (`[taille]="28"`, `[lignesMin]="2"`, `[largeur]="560"`).
- Une référence `var(--x)` à un token qui n'existe ni dans Empreinte ni dans `tokens.css`.
- Toute trace de PrimeNG : balises `<p-…>`, attributs `pButton`, `pInputText`, `pTextarea`, `pTooltip`, `pRipple`, `pTemplate` (et tout `p` + majuscule), `[dt]`, classes `pi` / `pi-*` et `p-*`. Le message du contrôle donne l'équivalent Empreinte.

**TypeScript** (hors `*.spec.ts` et `test-setup.ts`, qui ne sont contrôlés que pour PrimeNG)

- `styles`, `styleUrl` ou `styleUrls` dans un `@Component` ou une `@Directive`.
- Un style posé par le code : `element.style…`, `setStyle`, `removeStyle`, `cssText`, `insertRule`, `CSSStyleSheet`, `setAttribute('style', …)`, `createElement('style')`.
- Dans `host`, des liaisons `'[style…]'`, `'[ngStyle]'`, `'[ngClass]'`, `'[class]'` ; une `class: '…'` ou un `'[class.x]'` y suit les mêmes règles de classes que les gabarits.
- Une chaîne qui contient une couleur ou une longueur brute, y compris une requête média : pour `BreakpointObserver`, `import { DS_MEDIA } from '@org/design-tokens'` puis `observe(DS_MEDIA.sm)` (≤ 760px), `DS_MEDIA.md` (≤ 900px), `DS_MEDIA.lg` (≤ 1100px). Une chaîne égale à un nom de couleur (`'orange'`, `'white'`, `'transparent'`…) est aussi refusée.
- Les imports de `primeng`, `primeicons`, `@primeuix/*` (dont `MessageService`, `ConfirmationService`, `DialogService`), `providePrimeNG`, `definePreset`, `DesignSystemPreset`, `avatarTone`.

Le contrôle refuse aussi une classe `e-*` écrite à la main hors des cas du § 2 (règle `kit-class`) et une directive posée sur le mauvais élément (règle `unknown-directive`). Ce qu'il **ne voit pas** et reste interdit : une règle du brand book (§ 4) ; un texte hors de la voix (§ 5) ; une classe `e-carte__*` hors d'un `[eCarte]`.

## 4. Les règles du brand book, écran par écran

- **Un seul sceau visible à la fois** : bouton `sceau`, `<e-sceau>` ou tête d'`<e-arete>`, coque et feuilles comprises. Il dit l'engagement principal de l'écran (« Nouvel objectif », « Je m'y engage »), jamais une action destructive. L'écran de l'arête a déjà son sceau (la tête) : aucun bouton `sceau` dessus, ni dans une feuille ouverte par-dessus ; de même pour Akari sur un objectif, dont l'arête est affichée à droite. À l'inverse, sur le nouvel objectif, « Je m'y engage » est le sceau : pas d'`<e-arete>` dans le brouillon, mais la liste numérotée des étapes (catalogue § 9). En développement, le `GardienSceau` écrit un avertissement dans la console dès qu'il y en a deux (une fois par session). `<e-empreinte>` et la marque ne comptent pas.
- **Une corne par groupe** (une par liste, une par colonne), seulement sur ce qui compte maintenant : l'étape en cours, le quadrant « Maintenant », l'entrée de navigation courante, le filtre actif. Toujours avec `aria-current` : `eCorne` le pose, `ECarte[marquee]` aussi. `eCorne` va avec `eSurface` sur le même élément. Jamais en décoration.
- **Les lumières** (`ciel`, `aube`, `soleil`, `fjord`) disent un domaine de vie, en petites touches (étiquette, filtre) ; une seule peut couvrir une surface. **Jamais un état** : ni un quadrant, ni une étape, ni une erreur. Les domaines attendent le back-end : en V1, pas de lumière, `<e-etiquette>` reste neutre.
- **L'échec n'existe pas** : aucune erreur en rouge (le `sceau` n'est jamais une erreur), aucun pourcentage, aucun compte à rebours, aucun « en retard ». Une erreur s'écrit en encre avec la solution (`e-champ [erreur]`, ou `AnnoncesStore.signaler`). La progression se lit par ce qui est fait (`<e-pas>`, `legendeProgression`). On « laisse filer », on ne supprime pas.
- **Rien ne surgit** : pas de toast. Une réussite s'annonce aux lecteurs d'écran (`AnnoncesStore.annoncer`), un souci s'affiche dans la page, dans la note d'Akari que pose la coque (`AnnoncesStore.signaler`) ; cahier § 7, `apps/apex-client/src/chore/stores/annonces.store.ts`.
- **Focus** : l'anneau d'encre carré de `base.css` d'Empreinte, sur tout. Ne jamais le masquer. Tout élément cliquable est un `<button>`, un `<a>` ou un contrôle natif ; une ligne cliquable contient un vrai bouton.
- **Cibles** : 44px (36px en `petit`), données par `eBouton`. Une case `eCase` fait 20px : la relier à un `<label for>`, qui offre la cible.
- **Jour et Nuit** : le thème est posé par `data-theme` sur `<html>` (`provideEmpreinte({ theme: 'jour' })` dans `app.config.ts` et le script d'`index.html`, catalogue § 1.3-1.5). Aucune règle `prefers-color-scheme` dans Apex : elle se désynchroniserait du choix fait dans les réglages. Vérifier chaque écran dans les deux thèmes.
- **375px** : lisible sans défilement horizontal de la page ; seule l'arête défile, dans un `.ds-scroll-x`.
- **Formes et mouvement** : pas d'arrondi, pas d'ombre sur une carte, rien qui tremble ni ne clignote. Les composants s'en chargent (et du repli `prefers-reduced-motion`) : ne rien recréer.

## 5. La voix

- **Tutoiement, phrases courtes**, nombres en chiffres, casse de phrase (seul `repere` est en capitales, et il les pose lui-même). Pas de point d'exclamation, pas d'emoji, pas d'italique.
- **Jamais** : « échec », « erreur », « raté », « manqué », « en retard », « perdu », « supprimer », « il te reste », « ne lâche rien », de pourcentage.

  | Ne dis pas | Dis |
  | --- | --- |
  | En retard | T'attend depuis mardi (`formaterAttente`) |
  | Tâche manquée | On la replace ? |
  | Supprimer l'objectif | Laisser filer |
  | Il te reste 43 % | 4 pas faits · 3 à venir (`legendeProgression`) |
  | Une erreur est survenue | Je n'ai pas pu enregistrer ce pas. Vérifie ta connexion, puis réessaie. |
  | Bravo ! | Empreinte posée. |

- **Le vocabulaire d'Apex** : objectif, étape, pas, arête, laisser filer (cahier § 4). L'horizon s'écrit « Jusqu'en mai » (« Jusqu'en mai 2027 » si ce n'est pas l'année en cours) ; le pourquoi en `voix`, entre « ».
- **Akari** parle en `voix` et signe « AKARI » ; l'interface parle en `corps`. Il constate et propose, il ne pousse pas.
- **Les fonctions de voix** de `@empreinte-studio/angular` (sorties exactes au catalogue § 4) : `legendeProgression`, `descriptionProgression`, `compter(n, singulier, pluriel)` (donner le pluriel des mots invariables : `compter(n, 'pas', 'pas')`), `formaterAttente` (dates passées seulement : une date future donne « Pour aujourd'hui »), `formaterSerie` (hors V1), `motsAEviter`. `motsAEviter` laisse passer « échec », « raté », « manqué » et « supprimé » (son `\b` ne reconnaît pas une frontière à côté d'une lettre accentuée), et ne connaît ni « erreur » ni les emoji : le test de voix d'Apex ajoute ses propres motifs à frontières Unicode (catalogue § 8.6).
- **Les erreurs du domaine** : ne jamais afficher `error.message` (messages techniques, en anglais). Une phrase par code d'erreur, avec la solution. Les phrases que les stores disent à la personne sont regroupées dans `apps/apex-client/src/chore/constants/messages.constante.ts` (`SUCCESS_ANNOUNCEMENTS`, `FAILURE_REPORTS`…) : y ajouter les nouvelles plutôt que de les écrire dans un store. « Pas » ouvre rarement une phrase (« Pas ajouté » se lirait « non ajouté » : « Nouveau pas ajouté »).
- **Les boutons** : moins de 4 mots, un verbe ou l'intention (« Ajouter un pas », « Je m'y engage »). L'action d'abord, la sortie douce ensuite, en `nu` (« Pas maintenant », « Annuler »).
- **Les dates et les nombres** : pipes Angular, la locale est `fr` (`date:'d MMMM'`).
- **Accessibilité des textes** : toute icône seule a un nom (`aria-label` sur le bouton `icone`, `libelle` sur `e-icone`) ; une icône à côté d'un texte reste décorative (sans `libelle`). Un statut qui change (« Akari réfléchit… ») est dans un `role="status"` ; il n'y a pas d'indicateur de chargement.

## 6. Modèles à réutiliser

Les écrans V1 sont sous `apps/apex-client/src/app/` : `shell/` (coque et navigation), `objectives/` (Objectifs, l'accueil), `objective/` (l'arête, ses feuilles, Akari), `matrix/` (la matrice), `auth/` (connexion). Le composant d'une route se trouve depuis `app/app.routes.ts` (routes au cahier § 3). Reprendre la structure de l'écran migré le plus proche ; à défaut, ces compositions, toutes vérifiées par le contrôle :

| Besoin | Où | Structure |
| --- | --- | --- |
| Coque | `app/shell/` | `div[eCoque]` > `nav[eNav]` (`a[eMarque].e-nav__marque`, `ul[eNavListe]` > `li` > `a[eLienNav][icone]` avec `routerLinkActive` et `ariaCurrentWhenActive="page"`, `div[eNavBas]`) + `main[eCoquePrincipal]` > `div[eCoqueContenu]` (note de `signaler`, puis `router-outlet`). Structure complète : catalogue § 2.16. |
| Page | tous les écrans | Le gabarit d'un écran affiché dans la coque a une seule racine, `div.ds-page` : `eCoqueContenu` gère déjà les marges et la largeur ; `.ds-page` ramène l'écart entre sections à 32px, comme les maquettes. La connexion, hors de la coque, part de `main.ds-screen-center`. |
| En-tête de page | `app/objectives/` | `header.ds-page-header` > (`div.ds-stack.ds-gap-2` > `p.repere.ds-muted` + `h1.manifeste.ds-break` + `p.detail.ds-muted`) + l'action |
| Fil d'Ariane | `app/objective/` | `header.ds-stack.ds-gap-5` > `nav[eFilAriane]` + `div.ds-page-header` |
| Cartes d'objectifs | `app/objectives/` | `div.ds-panels.ds-surfaces.ds-cols-2` > `article[eCarte]` (`div.ds-stack.ds-grow` > horizon, titre, pourquoi ; `e-pas` ; pied `div.ds-row.ds-wrap.ds-between.ds-rule-top` > `.ds-check.ds-grow` + lien « Ouvrir »). `.ds-surfaces` : un seul filet entre deux cartes, qui dessinent déjà le leur. Avec des `article.ds-panel`, pas de `.ds-surfaces`. |
| Bloc replié « Accomplis » | `app/objectives/` | `details.ds-disclosure.ds-rule-block` > `summary` (chevron, `span.section`, compte) + `ul.ds-divided`. Repli possible (Safari 18.3 et avant peut montrer sa flèche native à côté du chevron) : `div.ds-rule-block` > `button[eBouton="nu"][attr.aria-expanded]` + `@if (ouvert)` `ul.ds-divided`, ci-dessous. |
| Arête et étape | `app/objective/` | `div.ds-panels.ds-cols-2-1` > `section.ds-panel` (`.ds-title-row`, `div.ds-scroll-x` > `e-arete`) + `section.ds-panel.ds-panel-flush` (en-tête d'étape, `ul[eListe][nue]` > `li[eTache]`, `.ds-actions`) |
| Feuille (modifier un pas, une étape, l'objectif) | `app/objective/` | `Feuilles.ouvrir(Composant, { donnees, cdk: { injector } })` ; dans le composant ouvert, `e-feuille[titre]` > `form.ds-stack` + `div[eFeuilleActions]`. Catalogue § 2.17. |
| Formulaire | partout | `form.ds-stack` > `e-champ[libelle]` > `input[eSaisie]`, `textarea[eSaisie][tailleAuto]`, `e-selection`, `input[type=date][eSaisie]` ; erreur par `[erreur]` du champ ; `facultatif` plutôt qu'un astérisque. |
| Conversation et brouillon | `app/objective/` (Akari), nouvel objectif | `div.ds-panels.ds-cols-7-6` > `section.ds-panel.ds-gap-0` (`ol.ds-conversation`, `form.ds-composer.ds-rule-top.ds-push-down`) + `section.ds-panel[eSurface][eCorne="l"]` (brouillon, `ol.ds-divided` > `li.ds-entry`, bouton `sceau`) |
| Matrice | `app/matrix/` | `header.ds-stack.ds-gap-5` > titre + `e-filtres` ; `e-matrice` gère sa grille ; dans `ng-template[eMatriceElement]`, `.ds-check` (case, label, détail, `e-menu` « Déplacer vers… ») |
| Connexion | `app/auth/` | `main.ds-screen-center` > `form.ds-narrow.ds-stack.ds-gap-6` > `a[eMarque]` + `h1.objectif` + `e-champ`s + `button[eBouton="sceau"].ds-self-start` |
| Rangée d'actions | partout | `div.ds-actions` (`.ds-justify-end` pour l'aligner à droite) > `button[eBouton="trait"][petit]` + `button[eBouton="nu"][petit]` |
| Réussite, souci | stores (`chore/stores/annonces.store.ts`) | `annoncer(texte)` pour une réussite ; `signaler(texte)` pour un souci, que la coque affiche dans `aside[eNote]` avec un bouton « Compris » (`compris()`) ; phrases tirées de `chore/constants/messages.constante.ts` |

En-tête de page et grille de cartes :

```html
<div class="ds-page">
  <header class="ds-page-header">
    <div class="ds-stack ds-gap-2">
      <p class="repere ds-muted">Lundi 19 octobre</p>
      <h1 class="manifeste ds-break">Mes objectifs</h1>
      <p class="detail ds-muted">4 en marche</p>
    </div>
    <a eBouton="sceau" routerLink="/objectifs/nouveau"><e-icone nom="plus" [taille]="18" />Nouvel objectif</a>
  </header>

  <div class="ds-panels ds-cols-2">
    @for (o of objectifs(); track o.id) {
      <article class="ds-panel" [attr.aria-labelledby]="'objectif-' + o.id">
        <p class="detail ds-muted">{{ o.horizon }}</p>
        <h2 class="objectif ds-break" [id]="'objectif-' + o.id">{{ o.titre }}</h2>
        @if (o.pourquoi) {
          <p class="voix ds-muted">« {{ o.pourquoi }} »</p>
        }
        <div class="ds-push-down">
          <e-pas [faits]="o.etapesFaites" [enCours]="o.aUneEtapeEnCours" [aVenir]="o.etapesAVenir"
                 unite="etape" [nomEnCours]="o.nomEtapeEnCours" />
        </div>
        <div class="ds-row ds-wrap ds-between ds-rule-top">
          @if (o.prochainPas; as pas) {
            <div class="ds-check ds-grow">
              <input type="checkbox" eCase [id]="'pas-' + pas.id" [checked]="pas.fait"
                     (change)="basculer(pas.id, $any($event.target).checked)" />
              <label class="corps" [for]="'pas-' + pas.id">{{ pas.titre }}</label>
              <span class="detail ds-muted">Prochain pas · {{ o.nomEtapeEnCours }}</span>
            </div>
          }
          <a eBouton="trait" petit [routerLink]="['/objectifs', o.id]">Ouvrir</a>
        </div>
      </article>
    }
  </div>
</div>
```

Bloc replié « Accomplis » :

```html
<div class="ds-rule-block">
  <button eBouton="nu" type="button" [attr.aria-expanded]="ouvert()" aria-controls="accomplis" (click)="basculer()">
    <e-icone [nom]="ouvert() ? 'chevron-haut' : 'chevron-bas'" />Accomplis · {{ accomplis().length }}
  </button>
  @if (ouvert()) {
    <ul class="ds-divided" id="accomplis">
      @for (o of accomplis(); track o.id) {
        <li class="ds-row ds-between">
          <a class="corps" [routerLink]="['/objectifs', o.id]">{{ o.titre }}</a>
          <e-empreinte [taille]="24" libelle="Accompli" />
        </li>
      }
    </ul>
  }
</div>
```

L'arête et l'étape en cours (pas de bouton `sceau` : la tête de l'arête en est un) :

```html
<div class="ds-panels ds-cols-2-1">
  <section class="ds-panel ds-gap-6" aria-labelledby="titre-arete">
    <div class="ds-title-row"><h2 class="section" id="titre-arete">L'arête · {{ etapes().length }} étapes</h2></div>
    <div class="ds-scroll-x">
      <e-arete [objectif]="objectif().titre" [etapes]="etapes()" interactive (choisir)="choisir($event)" />
    </div>
  </section>
  <section class="ds-panel ds-panel-flush" aria-labelledby="titre-etape">
    <div class="ds-stack ds-gap-2">
      <p class="repere ds-muted">Étape 3 · en cours</p>
      <h2 class="objectif" id="titre-etape">{{ etape().titre }}</h2>
      <e-pas [faits]="etape().faits" [enCours]="etape().enCours" [aVenir]="etape().aVenir" />
    </div>
    <ul eListe nue>
      @for (pas of etape().pas; track pas.id) {
        <li eTache [titre]="pas.titre" [fait]="pas.fait" (faitChange)="basculer(pas.id, $event)">
          <div eTacheActions>
            <button eBouton="nu" petit icone type="button" [attr.aria-label]="'Modifier « ' + pas.titre + ' »'" (click)="modifier(pas)">
              <e-icone nom="modifier" />
            </button>
          </div>
        </li>
      }
    </ul>
    <div class="ds-actions">
      <button eBouton="trait" petit type="button" (click)="ajouterPas()"><e-icone nom="plus" [taille]="18" />Ajouter un pas</button>
      <a eBouton="nu" petit [routerLink]="['/objectifs', objectif().id, 'akari']" [queryParams]="{ etape: etape().id }">Proposer des pas avec Akari</a>
    </div>
  </section>
</div>
```

La conversation avec Akari et le brouillon (voir le piège sur la signature d'Akari, § 7) :

```html
<div class="ds-panels ds-cols-7-6">
  <section class="ds-panel ds-gap-0" aria-label="Conversation avec Akari">
    <ol class="ds-conversation">
      <li><aside eNote aria-label="Akari"><div class="ds-prose" [innerHTML]="message.content | markdown"></div></aside></li>
      <li class="ds-reply"><p class="repere ds-muted ds-reply-author">Léa</p><p class="corps">…</p></li>
    </ol>
    <p class="detail ds-muted" role="status">{{ statut() }}</p>
    <form class="ds-composer ds-rule-top ds-push-down" (ngSubmit)="envoyer()">
      <label class="e-masque" for="reponse">Réponds à Akari</label>
      <textarea eSaisie tailleAuto id="reponse" [lignesMin]="2" [lignesMax]="6" [formControl]="reponse"></textarea>
      <button eBouton="trait" icone type="submit" aria-label="Envoyer"><e-icone nom="envoyer" /></button>
    </form>
  </section>
  <section class="ds-panel ds-gap-5" eSurface eCorne="l" aria-labelledby="titre-brouillon">
    <p class="repere ds-muted">Brouillon · pas encore enregistré</p>
    <h2 class="objectif" id="titre-brouillon">{{ brouillon().titre }}</h2>
    <ol class="ds-divided">
      <li class="ds-entry">
        <span class="objectif">1</span><span class="corps">Portfolio</span>
        <span class="detail ds-muted">4 pas</span><span class="detail ds-muted">Commence cette semaine</span>
      </li>
    </ol>
    <div class="ds-actions"><button eBouton="sceau" type="button" (click)="engager()">Je m'y engage</button></div>
  </section>
</div>
```

Connexion et matrice :

```html
<main class="ds-screen-center">
  <form class="ds-narrow ds-stack ds-gap-6" [formGroup]="form" (ngSubmit)="connecter()">
    <a eMarque routerLink="/">Apex</a>
    <h1 class="objectif">Content de te revoir</h1>
    <e-champ libelle="Ton adresse" [erreur]="erreurAdresse()">
      <input eSaisie type="email" formControlName="email" autocomplete="email" />
    </e-champ>
    <button eBouton="sceau" type="submit" class="ds-self-start">Me connecter</button>
  </form>
</main>

<e-matrice [quadrants]="quadrants()" [piste]="parId" [unite]="unitePas" (deplacement)="deplacer($event)">
  <ng-template [eMatriceElement]="quadrants()" let-pas let-quadrant="quadrant">
    <div class="ds-check">
      <input type="checkbox" eCase [id]="'m-' + pas.id" [checked]="pas.done" (change)="basculer(pas.id, $any($event.target).checked)" />
      <label class="corps" [for]="'m-' + pas.id">{{ pas.title }}</label>
      <span class="detail ds-muted">{{ pas.objectiveTitle }}</span>
      <e-menu libelle="Déplacer vers…" icone="deplacer" petit [entrees]="cibles"
              (choix)="deplacer({ element: pas, de: quadrant, vers: $event, index: 0 })" />
    </div>
  </ng-template>
</e-matrice>
```

## 7. Pièges

Les 32 pièges vérifiés sont au catalogue § 8. Les plus fréquents :

- **Marges.** Les 8 styles typographiques ne remettent ni marge ni couleur : un `h1` ou un `p` ne perd ses marges que s'il est l'**enfant direct** d'un conteneur `.ds-*`. Envelopper chaque bloc dans un `.ds-stack`, `.ds-row`, `.ds-panel`…
- **Feuilles de style qui disparaissent.** La feuille d'un composant part avec sa dernière instance ; seules celles des directives (`eSurface`, `eCase`, `eListe`, `eSaisie`, `eCoque`…) restent une fois chargées. Une classe `e-*` écrite à la main n'est stylée que si son composant est présent sur la page.
- **Signature d'Akari.** `p.e-note__qui` écrit à la main est refusé (règle `kit-class`) : chaque phrase d'Akari est une `aside[eNote]`, qui pose elle-même la signature. Dans une conversation, elle se place directement dans le `li`, **sans** `.ds-reply`, qui est une grille à deux colonnes (un enfant seul tomberait dans la colonne du nom, 96px). Son Markdown rendu va dans un `div.ds-prose`.
- **`li[eTache]`.** Cliquer le titre coche le pas (c'est le `<label>`) ; pour ouvrir ou modifier, un bouton dans `eTacheActions` (placé sous le texte). Avec `(faitChange)`, toujours une mise à jour optimiste du store puis un retour en arrière en cas de souci, sinon la case reste cochée. Dans un panneau, la liste s'écrit `ul[eListe] nue` (sans `nue`, elle redevient une surface).
- **Feuilles.** Le composant ouvert hérite de l'injecteur racine : passer `cdk: { injector: inject(Injector) }` pour atteindre les stores fournis par la coque. `e-feuille` exige un `titre` (le focus y va).
- **Formulaires.** `e-selection` prend des options `{ valeur, libelle }` ; `input[type=date][eSaisie]` porte une chaîne `aaaa-mm-jj`, pas une `Date` ; avec `formControlName`, le message d'erreur passe par `e-champ [erreur]` (il n'est automatique qu'avec Signal Forms).
- **Navigation.** L'entrée `/` demande `[routerLinkActiveOptions]="{ exact: true }"` ; sous 760px, `eNavBas` disparaît : prévoir un autre accès aux réglages sur mobile.
- **`e-matrice`.** Passer `[piste]` (sinon la liste est recréée à chaque mise à jour du store) et une `unite` déclarée `as const` dans la classe ; le glisser-déposer ne se fait pas au clavier, d'où l'`e-menu` « Déplacer vers… ».
- **`e-menu`** : `icone` est un nom d'icône (chaîne), alors que sur `eBouton` c'est un booléen ; une entrée se désactive avec `desactive`, une option d'`e-selection` avec `desactivee`.
- **Couche `.ds-*`.** `.ds-hide-mobile` se pose sur un élément simple, jamais sur l'hôte d'un composant Empreinte ; `.ds-span-2` seulement dans `.ds-cols-3` ; dans `.ds-panel-flush`, les enfants directs gardent la marge par `margin-inline` (envelopper un bouton isolé dans un `.ds-actions`). À spécificité égale, la classe déclarée le plus bas dans `layout.css` l'emporte : si une combinaison ne rend pas, le signaler plutôt que contourner.
- **Faux positifs du contrôle.** Un texte d'attribut ou une chaîne TypeScript qui contient `#` suivi de 3, 4, 6 ou 8 chiffres hexadécimaux (« Pas #123 ») est lu comme une couleur : reformuler (« Pas 123 »).

## 8. Vérifier avant de rendre la main

Node 24.22 (`nvm use`, ou `export PATH=$HOME/.nvm/versions/node/v24.22.0/bin:$PATH`) ; les commandes passent par `npx nx`.

1. `npx nx lint design-tokens` : aucune violation dans tes fichiers. Corriger chaque violation dans l'esprit de la règle, jamais en contournant le contrôle. Dans Claude Code, un hook lance ce contrôle après chaque modification d'un fichier front-end et en fin de tour : corriger aussitôt ce qui relève de ton travail. Une violation dans un fichier qui n'est pas le tien : ne le corrige pas sans accord, signale-la.
2. `npx nx typecheck apex-client`, `npx nx vite:test apex-client` (dont le test de voix), puis `npx nx build apex-client`.
3. Contrôle visuel de chaque écran touché (`npx nx run apex-client:serve --excludeTaskDependencies`) : en Jour et en Nuit (réglages de la coque), à 375px de large, au clavier (ordre de tabulation, focus visible), console sans avertissement du `GardienSceau`.
4. La liste de vérification du cahier § 10.
5. Dans le compte rendu : les composants Empreinte et les classes `.ds-*` utilisés ; tout besoin non couvert, dit explicitement, avec l'évolution proposée (couche Apex ou Empreinte en amont).
