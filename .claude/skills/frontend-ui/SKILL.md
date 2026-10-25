---
name: frontend-ui
description: À suivre avant toute intervention front-end dans une application (apps/**) — créer ou modifier un écran, un composant Angular, un gabarit HTML, une mise en page, une feuille de style, une feuille (dialogue), un formulaire, un affichage responsive, le thème Jour ou Nuit, un texte d'interface, ou corriger un bug visuel. Explique comment construire l'interface d'Apex avec le design system Empreinte (@empreinte-studio/angular — eBouton, eCarte, eTache, e-pas, e-arete, e-matrice, eNote, e-champ, Feuilles…) et ses 8 styles typographiques, où écrire le style propre à Apex (la feuille du composant, les utilitaires .ds-* partagés), ce qui relève d'Empreinte ou d'Apex, et comment écrire dans la voix d'Empreinte. Use for any UI, frontend, Empreinte, styling, CSS, layout, component, template, theme, accessibility or UI copy work.
---

# Construire une interface Apex avec Empreinte

Deux sources, chacune à sa place :

- **Empreinte** donne l'identité, commune à toutes les applications de la suite : les composants (`@empreinte-studio/angular`), qui embarquent leur feuille, et les tokens (`@empreinte-studio/tokens` : couleurs Jour et Nuit, pas, cornes, traits, polices, les **8 styles typographiques** `manifeste`, `objectif`, `voix`, `palier`, `section`, `corps`, `detail`, `repere`).
- **Apex** possède sa mise en page et le style de ses écrans : la coque, la place de la navigation, les largeurs, les points de rupture, la composition de chaque écran. Ce style vit dans Apex, à côté des composants, et se change librement, au rythme d'Apex.

PrimeNG est retiré et désinstallé (`primeng`, `@primeuix/themes`, `primeicons`, le preset, `[dt]`, les `pi pi-*`, les toasts). Ne le réintroduis jamais.

## 1. Lire avant de coder

1. **Le cahier de la migration** : `docs/features/migration-empreinte.md`. Il fait autorité : périmètre V1 et routes, vocabulaire (objectif, étape, pas, arête, laisser filer) et règles de données, Akari comme geste, voix, `AnnoncesStore` à la place des toasts, thème, liste de vérification d'un écran.
2. **Le catalogue des composants** : [references/catalogue-empreinte.md](references/catalogue-empreinte.md). API exacte de chaque composant de la version installée (sélecteurs, entrées, sorties, contenu projeté, clavier, formulaires), icônes, fonctions de voix, classes `e-*` (qui les pose, quand on peut les écrire), tokens, table PrimeNG → Empreinte (§ 7), pièges (§ 8), manques de la librairie (§ 9). En cas de doute sur une API : `node_modules/@empreinte-studio/angular/types/*.d.ts`, jamais la mémoire.
3. **Le style d'Apex** : la feuille du composant que tu touches (`<nom>.css` à côté du gabarit) et les utilitaires partagés `apps/apex-client/src/styles/layout.css` (chaque classe y est commentée).
4. **La maquette de l'écran** : canvas « Apex » https://claude.ai/artifact/E59CU8bjiq7EhNft2hZHCy, fichiers `project/<Nom>.dc.html`. V1 : `Objectifs`, `Arete`, `Matrice`, `Akari`. Hors V1 : `Main` (Aujourd'hui), `Carnet`, `Palier`. Ouvre-les avec l'outil Artifact (`read`), pas avec un fetch web. Elles sont écrites avec des styles en ligne et les classes du kit : elles donnent l'intention (hiérarchie, textes, espacements, ce qui porte la corne), **pas le code**.
5. **Le brand book Empreinte** : design system « Empreinte » https://claude.ai/artifact/QBkmtgtj9oKk8xdJPb2QNe (`project/README.md`, `project/components/*/README.md`) : les trois gestes (trame, corne, empreinte), la voix d'Akari, les couleurs.
6. **Des exemples d'usage des composants** : la vitrine du dépôt https://github.com/empreinte-studio/empreinte (`apps/vitrine`).
7. **L'écran le plus proche** (§ 6), pour reprendre sa structure.

## 2. L'échelle de décision

Pour chaque besoin visuel, descendre l'échelle et s'arrêter au premier niveau qui répond :

| #   | Question | Réponse |
| --- | --- | --- |
| 1   | Un composant Empreinte fait-il ça ? | Le poser, sur l'élément natif quand il s'y pose (`button[eBouton]`, `input[eSaisie]`, `li[eTache]`, `a[eLienNav]`…), et régler son apparence **par ses entrées** : variante `sceau` / `trait` / `nu`, `petit`, `icone`, `marquee`, `nue`, `eCorne`… Catalogue § 2, table de correspondance § 7. |
| 2   | Il faut une sous-partie que le composant ne pose pas lui-même ? | Une classe `e-*` écrite à la main, dans les cas du catalogue § 5.4 : `e-carte__entete`, `e-carte__pied`, `e-carte__meta`, `e-carte__raison` dans un `[eCarte]` ; `e-masque` (lecteurs d'écran). Pas pour recréer un composant : `<e-empreinte>` et non `span.e-sceau`, `<e-pas>` et non `div.e-pas`, `button[eBouton]` et non `button.e-btn`. |
| 3   | C'est du texte ? | Un des 8 styles typographiques, plus `.ds-muted` pour l'encre douce. |
| 4   | C'est de la mise en page ou une composition propre à l'écran (placer, empiler, espacer, grille, responsive, dimensionner un composant dans sa colonne) ? | **Dans Apex** (§ 3) : un utilitaire `.ds-*` partagé s'il fait déjà l'affaire, sinon une classe dans la feuille du composant. |
| 5   | Le besoin servirait à toute la suite (un composant ou une variante qui manque, une icône, un token, un mot de la voix, un défaut d'un composant) ? | **Empreinte**, en amont : dépôt `empreinte-studio/empreinte`, puis une montée de version de `@empreinte-studio/*` ici (catalogue : manques connus au § 9). En attendant, Apex peut composer avec ce qui existe. La mise en page d'Apex ne va jamais dans Empreinte. |

## 3. Où écrire le style

- **La feuille du composant** : tout ce qui n'appartient qu'à un écran (sa composition, ses colonnes, ses exceptions) va dans `<nom>.css`, à côté du gabarit, déclaré par `styleUrl: './<nom>.css'` (ou `styleUrls` pour plusieurs feuilles). Encapsulation émulée : des classes courtes, sans préfixe, nommées par leur rôle dans l'écran (`.cards`, `.accomplished`, `.composer`). Une composition partagée par deux écrans peut avoir sa propre feuille, listée par les deux.
- **Les utilitaires partagés** : `apps/apex-client/src/styles/layout.css`, chargé après Empreinte par `apps/apex-client/project.json`. Préfixe `ds-` : la page (`.ds-page`, `.ds-page-header`, `.ds-title-row`), les empilements et rangées (`.ds-stack`, `.ds-row`, `.ds-actions`), la trame de panneaux (`.ds-panels`, `.ds-panel`, `.ds-cols-*`), les listes (`.ds-divided`, `.ds-check`), les écarts (`.ds-gap-*`) et quelques modificateurs. N'y monte une classe que lorsqu'un deuxième écran en a besoin. Les valeurs de mise en page partagées y sont aussi (`--ds-*`).
- **Le HTML inséré par `[innerHTML]`** ne reçoit pas l'attribut d'encapsulation. Le Markdown d'Akari est rendu dans une réplique d'`e-conversation`, dont la prose vient d'Empreinte (paragraphes, listes à puces carrées, liens à l'encre, code). Pas de `::ng-deep`.
- **Les valeurs** : les couleurs toujours en tokens d'Empreinte (`var(--encre-douce)`, `var(--trame)`, `var(--panneau)`…), sinon la Nuit ne suit pas ; les espacements et filets en tokens quand ils existent (`var(--pas-4)`, `var(--trait-fin)`, `--ds-space-*` pour les pas intermédiaires). Points de rupture d'Apex : 760px (mobile), 900px, 1100px ; pour `BreakpointObserver`, les mêmes valeurs.
- **Les composants d'Empreinte** : les placer, les dimensionner, les espacer depuis Apex est normal (`.arete > e-arete { min-width: 640px }`, `.panel-flush .e-tache { padding-inline: … }`). Changer leur apparence (couleur, forme, typographie) touche l'identité : si le changement vaut pour toute la suite, c'est une évolution d'Empreinte.
- **Le thème** : la Nuit passe par `data-theme` sur `<html>`. Aucune règle `prefers-color-scheme` dans Apex : elle se désynchroniserait du choix fait dans les réglages.
- **Remise à zéro des marges** : un conteneur dont les enfants sont des `p`, `h1`, `ul` remet leurs marges à zéro avec une spécificité nulle, pour qu'une marge propre à un composant d'Empreinte l'emporte : `:where(.composer > *) { margin: 0; }` (les conteneurs `.ds-*` le font déjà).

## 4. Les règles du brand book, écran par écran

- **Un seul sceau visible à la fois** : bouton `sceau`, `<e-sceau>` ou tête d'`<e-arete>`, coque et feuilles comprises. Il dit l'engagement principal de l'écran (« Nouvel objectif », « Je m'y engage »), jamais une action destructive. L'écran de l'arête a déjà son sceau (la tête) : aucun bouton `sceau` dessus, ni dans une feuille ouverte par-dessus ; de même pour Akari sur un objectif, dont l'arête est affichée à droite. À l'inverse, sur le nouvel objectif, « Je m'y engage » est le sceau : pas d'`<e-arete>` dans le brouillon, mais la liste numérotée des étapes (catalogue § 9). En développement, le `GardienSceau` écrit un avertissement dans la console dès qu'il y en a deux (une fois par session). `<e-empreinte>` et la marque ne comptent pas.
- **Une corne par groupe** (une par liste, une par colonne), seulement sur ce qui compte maintenant : l'étape en cours, le quadrant « Maintenant », l'entrée de navigation courante, le filtre actif. Toujours avec `aria-current` : `eCorne` le pose, `ECarte[marquee]` aussi. `eCorne` va avec `eSurface` sur le même élément. Jamais en décoration.
- **Les lumières** (`ciel`, `aube`, `soleil`, `fjord`) disent un domaine de vie, en petites touches (étiquette, filtre) ; une seule peut couvrir une surface. **Jamais un état** : ni un quadrant, ni une étape, ni une erreur. Les domaines attendent le back-end : en V1, pas de lumière, `<e-etiquette>` reste neutre.
- **L'échec n'existe pas** : aucune erreur en rouge (le `sceau` n'est jamais une erreur), aucun pourcentage, aucun compte à rebours, aucun « en retard ». Une erreur s'écrit en encre avec la solution (`e-champ [erreur]`, ou `AnnoncesStore.signaler`). La progression se lit par ce qui est fait (`<e-pas>`, `legendeProgression`). On « laisse filer », on ne supprime pas.
- **Rien ne surgit** : pas de toast. Une réussite s'annonce aux lecteurs d'écran (`AnnoncesStore.annoncer`), un souci s'affiche dans la page, dans la note d'Akari que pose la coque (`AnnoncesStore.signaler`) ; cahier § 7, `apps/apex-client/src/chore/stores/annonces.store.ts`.
- **Focus** : l'anneau d'encre carré de `base.css` d'Empreinte, sur tout. Ne jamais le masquer. Tout élément cliquable est un `<button>`, un `<a>` ou un contrôle natif ; une ligne cliquable contient un vrai bouton.
- **Cibles** : 44px (36px en `petit`), données par `eBouton`. Une case `eCase` fait 20px : la relier à un `<label for>`, qui offre la cible.
- **Jour et Nuit** : le thème est posé par `data-theme` sur `<html>` (`provideEmpreinte({ theme: 'jour' })` dans `app.config.ts` et le script d'`index.html`, catalogue § 1.3-1.5). Vérifier chaque écran dans les deux thèmes.
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

Les écrans V1 sont sous `apps/apex-client/src/app/` : `shell/` (coque et navigation), `objectives/` (Objectifs, l'accueil), `objective/` (l'arête, ses feuilles, Akari), `matrix/` (la matrice), `auth/` (connexion). Le composant d'une route se trouve depuis `app/app.routes.ts` (routes au cahier § 3). Reprendre la structure de l'écran le plus proche ; à défaut, ces compositions :

| Besoin | Où | Structure |
| --- | --- | --- |
| Coque | `app/shell/` | `div.shell` > `nav.nav` (`a[eMarque].brand`, `ul.links` > `li` > `a[eLienNav].link[icone]` > `span.link-label`, avec `routerLinkActive` et `ariaCurrentWhenActive="page"`, `div.nav-bottom`) + `main.page` > `div.content` (note de `signaler`, puis `router-outlet`). Toute la mise en page de la coque est dans `shell.css` ; structure au catalogue § 2.16. |
| Page | tous les écrans | Le gabarit d'un écran affiché dans la coque a une seule racine, `div.ds-page` : la coque gère déjà les marges et la largeur ; `.ds-page` ramène l'écart entre sections à 32px, comme les maquettes. La connexion, hors de la coque, part de `main.screen` (`auuthentication-page.css`). |
| En-tête de page | `app/objectives/` | `header.ds-page-header` > (`div.ds-stack.ds-gap-2` > `p.repere.ds-muted` + `h1.manifeste.ds-break` + `p.detail.ds-muted`) + l'action |
| Fil d'Ariane | `app/objective/` | `header.ds-stack.ds-gap-5` > `nav[eFilAriane]` + `div.ds-page-header` |
| Cartes d'objectifs | `app/objectives/` | `div.ds-panels.ds-cols-2.cards` > `article[eCarte]` (`div.ds-stack.ds-grow` > horizon, titre, pourquoi ; `e-pas` ; pied `div.ds-row.ds-wrap.ds-between.ds-rule-top` > `.ds-check.ds-grow` + lien « Ouvrir »). `.cards` (`objectives.css`) : un seul filet entre deux cartes, qui dessinent déjà le leur. |
| Bloc replié « Accomplis » | `app/objectives/` | `details.accomplished` (`objectives.css`) > `summary` (chevron, `span.section`, compte) + `ul.ds-divided`. |
| Arête et étape | `app/objective/` | `div.ds-panels.ds-cols-2-1` > `section.ds-panel` (`.ds-title-row`, `div.ds-scroll-x.arete` > `e-arete`) + `section.ds-panel.panel-flush` (en-tête d'étape, `ul[eListe][nue]` > `li[eTache]`, `.ds-actions`) ; `.arete` et `.panel-flush` dans `objective-page.css` |
| Feuille (modifier un pas, une étape, l'objectif) | `app/objective/` | `Feuilles.ouvrir(Composant, { donnees, cdk: { injector } })` ; dans le composant ouvert, `e-feuille[titre]` > `form.ds-stack` + `div[eFeuilleActions]`. Catalogue § 2.17. |
| Formulaire | partout | `form.ds-stack` > `e-champ[libelle]` > `input[eSaisie]`, `textarea[eSaisie][tailleAuto]`, `e-selection`, `input[type=date][eSaisie]` ; erreur par `[erreur]` du champ ; `facultatif` plutôt qu'un astérisque. |
| Conversation et brouillon | `app/objective/akari/`, nouvel objectif | Akari : `div.ds-page.akari` > `div.ds-panels.ds-cols-7-6.panels` > `e-conversation.conversation` (`[repliques]`, `[statut]`, `[pret]`, `[personne]`, `(envoyer)`, `(action)`, `ng-template[eRepliqueContenu]` pour le Markdown) + `section.ds-panel.stages` ; hauteur et retrait dans `akari.css`. Nouvel objectif : `section.ds-panel` > `ol[eFil]` > `li[eReplique]` (Akari) et `li[eReplique][auteur="personne"][qui]` (les champs) + `section.ds-panel[eSurface][eCorne="l"]` (brouillon, `ol.ds-divided` > `li.stage`, bouton `sceau`) |
| Matrice | `app/matrix/` | `header.ds-stack.ds-gap-5` > titre + `e-filtres` ; `e-matrice` gère sa grille ; dans `ng-template[eMatriceElement]`, `div.ds-row.task` > `.ds-check` (case, label, détail) + `e-menu` « Déplacer vers… » |
| Connexion | `app/auth/` | `main.screen` > `form[eSurface].ds-panel.form` > `e-marque` + `h1.objectif` + `e-champ`s + `button[eBouton="sceau"]` |
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

L'arête et l'étape en cours (pas de bouton `sceau` : la tête de l'arête en est un) :

```html
<div class="ds-panels ds-cols-2-1">
  <section class="ds-panel ds-gap-6" aria-labelledby="titre-arete">
    <div class="ds-title-row"><h2 class="section" id="titre-arete">L'arête · {{ etapes().length }} étapes</h2></div>
    <div class="ds-scroll-x arete">
      <e-arete [objectif]="objectif().titre" [etapes]="etapes()" interactive (choisir)="choisir($event)" />
    </div>
  </section>
  <section class="ds-panel panel-flush" aria-labelledby="titre-etape">
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

```css
/* objective-page.css */
.panel-flush { padding-inline: 0; }
.panel-flush > * { margin-inline: var(--ds-panel-inset); }
.panel-flush > .e-liste { margin-inline: 0; }
.panel-flush .e-tache { padding-inline: var(--ds-panel-inset); }
.arete > e-arete { min-width: 640px; }
```

La conversation avec Akari (le composant d'Empreinte, voir le piège sur la conversation, § 7) et le brouillon du nouvel objectif :

```html
<!-- Akari : les messages deviennent des Replique { id, auteur, texte, actions?, enAttente? } (akari.ts) -->
<div class="ds-panels ds-cols-7-6 panels">
  <e-conversation class="conversation" [repliques]="repliques()" [statut]="statut()" [pret]="pret()"
                  [personne]="prenom()" indication="Réponds à Akari…" (envoyer)="envoyer($event)" (action)="choisir($event)">
    <ng-template [eRepliqueContenu]="repliques()" let-r>
      @if (r.markdown) { <div [innerHTML]="r.texte | markdown"></div> } @else { <p>{{ r.texte }}</p> }
    </ng-template>
  </e-conversation>
  <section class="ds-panel ds-gap-6 stages" aria-labelledby="titre-arete">…</section>
</div>

<!-- Nouvel objectif : le fil seul, les réponses dans des champs -->
<div class="ds-panels ds-cols-7-6">
  <section class="ds-panel" aria-label="Conversation avec Akari">
    <ol eFil>
      <li eReplique><p id="question-titre">Qu'est-ce que tu veux construire&nbsp;?</p></li>
      <li eReplique auteur="personne" [qui]="prenom()">
        <e-champ libelle="Ton objectif"><input eSaisie [formField]="brouillon.titre" /></e-champ>
      </li>
    </ol>
  </section>
  <section class="ds-panel ds-gap-5" eSurface eCorne="l" aria-labelledby="titre-brouillon">
    <p class="repere ds-muted">Brouillon · pas encore enregistré</p>
    <h2 class="objectif" id="titre-brouillon">{{ brouillon().titre }}</h2>
    <ol class="ds-divided">
      <li class="stage">
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
<main class="screen">
  <form eSurface class="ds-panel ds-gap-8 form" [formRoot]="identifiants" aria-labelledby="titre">
    <e-marque>Apex</e-marque>
    <h1 class="objectif" id="titre">Content de te revoir</h1>
    <e-champ libelle="Ton adresse">
      <input eSaisie type="email" autocomplete="email" [formField]="identifiants.email" />
    </e-champ>
    <button eBouton="sceau" type="submit">Me connecter</button>
  </form>
</main>

<e-matrice [quadrants]="quadrants()" [piste]="parId" [unite]="unitePas" (deplacement)="deplacer($event)">
  <ng-template [eMatriceElement]="quadrants()" let-pas let-quadrant="quadrant">
    <div class="ds-row ds-items-start task">
      <div class="ds-check ds-grow">
        <input type="checkbox" eCase [id]="'m-' + pas.id" [checked]="pas.done" (change)="basculer(pas.id, $any($event.target).checked)" />
        <label class="corps" [for]="'m-' + pas.id">{{ pas.title }}</label>
        <span class="detail ds-muted">{{ pas.objectiveTitle }}</span>
      </div>
      <e-menu libelle="Déplacer vers…" icone="deplacer" petit [entrees]="cibles"
              (choix)="deplacer({ element: pas, de: quadrant, vers: $event, index: 0 })" />
    </div>
  </ng-template>
</e-matrice>
```

## 7. Pièges

Les pièges vérifiés des composants sont au catalogue § 8. Les plus fréquents :

- **Marges.** Les 8 styles typographiques ne remettent ni marge ni couleur : un `h1` ou un `p` garde les marges du navigateur s'il n'est pas l'enfant direct d'un conteneur `.ds-*` ou d'un conteneur qui les remet à zéro dans la feuille du composant (§ 3).
- **Encapsulation.** Une règle de la feuille d'un composant n'atteint que les éléments écrits dans son gabarit (et l'hôte des composants qui y sont posés) : ni l'intérieur d'un composant d'Empreinte, ni le HTML inséré par `[innerHTML]` (la prose du Markdown d'Akari vient donc d'Empreinte). Un `ng-template` passé à un composant (`eMatriceElement`) appartient au gabarit qui l'écrit : sa feuille s'y applique.
- **Feuilles de style qui disparaissent.** La feuille d'un composant d'Empreinte part avec sa dernière instance ; seules celles des directives (`eSurface`, `eCase`, `eListe`, `eSaisie`, `eFilAriane`…) restent une fois chargées. Une classe `e-*` écrite à la main n'est stylée que si son composant est présent sur la page.
- **Conversation.** `e-conversation` défile seule : sans hauteur sur l'hôte (`akari.css`), elle grandit avec ce qui est dit et la page redéfile. Au-dessus de 1100px, la route d'Akari porte `data: { fitsWindow: true }` : la coque passe la hauteur de la fenêtre à la page, et chaque niveau jusqu'à la conversation garde `min-height: 0` (sinon toute la conversation remonte jusqu'à la page). En une colonne, la page descend jusqu'au pied de la conversation à l'ouverture (`akari.ts`). La prose d'une réplique (`.e-replique__prose`) est à spécificité nulle : la feuille de l'écran peut l'ajuster. Elle s'ouvre sur les dernières répliques et rend le focus à la zone de réponse : ne pas le refaire dans l'écran. L'invitation et la demande d'accord sont des répliques avec `actions` (un trait puis un nu, reliés à la phrase par `aria-describedby`), pas des `aside[eNote]` (une note par écran, celle de la coque). La zone de réponse reste ouverte pendant qu'Akari travaille : seul l'envoi attend `pret`. Une signature dans un fil passe par `qui` / `personne`, jamais par une classe `e-note__qui` écrite à la main.
- **`li[eTache]`.** Cliquer le titre coche le pas (c'est le `<label>`) ; pour ouvrir ou modifier, un bouton dans `eTacheActions` (placé sous le texte). Avec `(faitChange)`, toujours une mise à jour optimiste du store puis un retour en arrière en cas de souci, sinon la case reste cochée. Dans un panneau, la liste s'écrit `ul[eListe] nue` (sans `nue`, elle redevient une surface).
- **Feuilles.** Le composant ouvert hérite de l'injecteur racine : passer `cdk: { injector: inject(Injector) }` pour atteindre les stores fournis par la coque. `e-feuille` exige un `titre` (le focus y va).
- **Formulaires.** `e-selection` prend des options `{ valeur, libelle }` ; `input[type=date][eSaisie]` porte une chaîne `aaaa-mm-jj`, pas une `Date` ; avec `formControlName`, le message d'erreur passe par `e-champ [erreur]` (il n'est automatique qu'avec Signal Forms).
- **Navigation.** L'entrée `/` demande `[routerLinkActiveOptions]="{ exact: true }"` (ou, comme la coque, une lecture du routeur) ; sous 760px, le bas de la navigation disparaît : les réglages restent dans un `e-menu` en `.ds-show-mobile`.
- **`e-matrice`.** Passer `[piste]` (sinon la liste est recréée à chaque mise à jour du store) et une `unite` déclarée `as const` dans la classe ; le glisser-déposer ne se fait pas au clavier, d'où l'`e-menu` « Déplacer vers… ».
- **`e-menu`** : `icone` est un nom d'icône (chaîne), alors que sur `eBouton` c'est un booléen ; une entrée se désactive avec `desactive`, une option d'`e-selection` avec `desactivee`.
- **Utilitaires `.ds-*`.** `.ds-hide-mobile` et `.ds-show-mobile` se posent sur un élément simple, jamais sur l'hôte d'un composant Empreinte ; `.ds-span-2` seulement dans `.ds-cols-3`. À spécificité égale, la classe déclarée le plus bas dans `styles/layout.css` l'emporte ; une classe de la feuille d'un composant (encapsulée) l'emporte sur un utilitaire `.ds-*`.

## 8. Vérifier avant de rendre la main

Node 24.22 (`nvm use`, ou `export PATH=$HOME/.nvm/versions/node/v24.22.0/bin:$PATH`) ; les commandes passent par `npx nx`.

1. `npx nx typecheck apex-client`, `npx nx lint apex-client`, `npx nx vite:test apex-client` (dont le test de voix), puis `npx nx build apex-client` (budget d'une feuille de composant : 4 ko conseillés, 8 ko au plus).
2. Contrôle visuel de chaque écran touché (`npx nx run apex-client:serve --excludeTaskDependencies`) : en Jour et en Nuit (réglages de la coque), à 375px de large, au clavier (ordre de tabulation, focus visible), console sans avertissement du `GardienSceau`.
3. La liste de vérification du cahier § 10.
4. Dans le compte rendu : les composants Empreinte utilisés, les feuilles et les classes ajoutées ; ce qui mériterait une évolution d'Empreinte, dit explicitement.
