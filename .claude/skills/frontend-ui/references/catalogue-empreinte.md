# Catalogue : les composants Empreinte pour Apex

Référence de tous les écrans d'Apex migrés vers Empreinte. Version couverte : **`@empreinte-studio/angular` 0.1.1** et **`@empreinte-studio/tokens` 0.1.1**, telles qu'installées dans `node_modules` (elles font foi en cas d'écart avec le dépôt). Chaque affirmation a été relevée dans `node_modules/@empreinte-studio/angular/types/*.d.ts` et `fesm2022/*.mjs` ; les sorties des fonctions de voix ont été obtenues en les exécutant.

Le cahier de la migration (`docs/features/migration-empreinte.md`) fixe le périmètre, le vocabulaire et les règles d'écran ; ce catalogue dit **avec quoi** les construire.

Sommaire : 1. Installation · 2. Composants, point d'entrée par point d'entrée · 3. Icônes · 4. Fonctions de voix · 5. Classes du kit · 6. Tokens · 7. PrimeNG → Empreinte · 8. Pièges · 9. Ce qui manque pour la V1.

## Règles d'or

- **Un composant Empreinte d'abord.** Il se pose le plus souvent sur l'élément natif (`button[eBouton]`, `input[eSaisie]`, `li[eTache]`…) : sémantique, clavier et formulaires restent natifs.
- **La mise en page est celle d'Apex.** Elle s'écrit dans la feuille du composant (`<nom>.css`, `styleUrl`) ou avec les utilitaires partagés `.ds-*` (`apps/apex-client/src/styles/layout.css`). Texte : les 8 classes typographiques (§ 5.2). Les classes `e-*` du kit ne s'écrivent à la main que dans les cas listés au § 5.4.
- **Un sceau par écran** (bouton `sceau`, `e-sceau`, tête d'`e-arete`), **une corne par groupe** (toujours avec `aria-current`), **les lumières pour les domaines, jamais pour un état**.
- **La voix** : tutoiement, phrases courtes, ni « échec », « erreur », « raté », « en retard », « supprimer », ni pourcentage, ni point d'exclamation, ni emoji.
- Tous les composants sont standalone, en signaux (`input()`, `model()`, `output()`), `OnPush`, `ViewEncapsulation.None`. On les ajoute au tableau `imports` du composant.

```ts
import { EBouton, EIcone, ECarte } from '@empreinte-studio/angular';        // point d'entrée principal (ré-exporte tout)
import { EMatrice, EMatriceElement } from '@empreinte-studio/angular/matrice'; // ou famille par famille
```

---

## 1. Installation dans Apex

### 1.1 Dépendances

`@empreinte-studio/angular` 0.1.1 demande en pair `@angular/aria`, `@angular/cdk`, `@angular/common`, `@angular/core`, `@angular/forms` en `^22.2.0` (installés en 22.2.3). Il dépend de `@empreinte-studio/tokens` 0.1.1, qui dépend de `@fontsource/schibsted-grotesk` et `@fontsource/shippori-mincho` (présents dans `node_modules`). Aucune feuille du CDK n'est à charger : le CDK injecte lui-même les styles de l'overlay, du drag-drop et du text-field.

### 1.2 Les styles globaux

Une seule feuille à charger, une fois, avant tout composant :

```css
/* apps/apex-client/src/styles.css */
@import '@empreinte-studio/tokens/empreinte.css';
```

`empreinte.css` importe, dans l'ordre :

| Fichier | Contenu |
| --- | --- |
| `polices.css` | Shippori Mincho 500, 600, 700 et Schibsted Grotesk 400, 600, sous-ensemble latin, auto-hébergées via Fontsource (aucune requête vers Google Fonts). |
| `tokens.css` | Les variables CSS : couleurs Jour sur `:root, [data-theme="jour"]`, couleurs Nuit sur `[data-theme="nuit"]`, valeurs communes sur `:root` (§ 6). **Aucune media query `prefers-color-scheme`** : la Nuit ne s'applique que par `data-theme="nuit"`. |
| `typographie.css` | Les 8 classes `.manifeste`, `.objectif`, `.voix`, `.palier`, `.section`, `.corps`, `.detail`, `.repere` (§ 5.2). |
| `base.css` | `body` (marge 0, fond `--fond`, encre, police structure 16/24), focus global `:focus-visible { outline: 2px solid var(--encre); outline-offset: 2px }`, `::selection` en `--soleil-voile`, la classe `.e-masque`, l'animation `@keyframes e-fondu` (utilisée par tous les composants quand le mouvement est réduit). |

Les feuilles des composants ne sont pas à importer : chaque composant porte la sienne (§ 5.1). Les utilitaires `.ds-*` d'Apex (`apps/apex-client/src/styles/layout.css`), construits sur ces tokens, sont chargés **après** `empreinte.css`.

### 1.3 `provideEmpreinte`

```ts
// app.config.ts
import { provideEmpreinte } from '@empreinte-studio/angular';
providers: [provideEmpreinte({ theme: 'jour' })]
```

`provideEmpreinte(config?: Partial<ConfigEmpreinte>): EnvironmentProviders` fournit `CONFIG_EMPREINTE` (fusion avec `CONFIG_PAR_DEFAUT`) et un initialiseur d'environnement qui instancie le service `Theme` dès le démarrage.

| Clé de `ConfigEmpreinte` | Type | Défaut | Rôle |
| --- | --- | --- | --- |
| `theme` | `'jour' \| 'nuit' \| 'systeme'` | `'jour'` | Thème au premier lancement (si rien n'est retenu). |
| `memoriserTheme` | `boolean` | `true` | Retenir le choix dans `localStorage`. |
| `cleTheme` | `string` | `'empreinte:theme'` | Clé `localStorage`. Le script d'`index.html` doit lire la même. |
| `haptique` | `boolean` | `true` | Vibrations (case cochée, empreinte, palier) via `navigator.vibrate`. |
| `gardienSceau` | `boolean` | `true` | Avertissement console en développement quand plus d'un sceau est affiché. |

Sans `provideEmpreinte`, `CONFIG_EMPREINTE` retombe sur `CONFIG_PAR_DEFAUT` (jeton `providedIn: 'root'`), mais le thème n'est appliqué que si quelqu'un injecte `Theme`.

### 1.4 Le script de thème d'`index.html`

Copie conforme de la vitrine d'Empreinte, à placer dans le `<head>` : il pose le thème retenu avant le démarrage d'Angular et évite un éclair de Jour en Nuit.

```html
<script>
  // Applique le thème retenu avant le premier affichage, pour éviter un éclair de Jour en Nuit.
  try {
    var t = localStorage.getItem('empreinte:theme');
    if (t === 'nuit' || t === 'jour') document.documentElement.setAttribute('data-theme', t);
    else if (t === 'systeme' && matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.setAttribute('data-theme', 'nuit');
  } catch (e) {}
</script>
```

### 1.5 Le service `Theme` (`core`)

Service auto-fourni à la racine (`@Service()` d'Angular 22).

| Membre | Type | Comportement |
| --- | --- | --- |
| `preference` | `WritableSignal<'jour' \| 'nuit' \| 'systeme'>` | Le choix de la personne. Initialisé depuis `localStorage` (si `memoriserTheme` et valeur valide), sinon `config.theme`. |
| `actif` | `Signal<'jour' \| 'nuit'>` | Le thème affiché. `'systeme'` suit `prefers-color-scheme: dark` en direct (écouteur `change`). |
| `definir(preference)` | `void` | Choisit Jour, Nuit ou `'systeme'`. |
| `basculer()` | `void` | Passe à l'opposé du thème **affiché** (écrit `'jour'` ou `'nuit'`, donc quitte `'systeme'`). |

Effets : `data-theme` est posé sur `<html>` à chaque changement de `actif` ; `preference` est écrite dans `localStorage` (erreurs avalées).

```ts
// Réglages de la coque : Jour, Nuit, Comme l'appareil (cahier § 8)
protected readonly theme = inject(Theme);
protected readonly themes: OptionFiltre<PreferenceTheme>[] = [
  { valeur: 'jour', libelle: 'Jour' },
  { valeur: 'nuit', libelle: 'Nuit' },
  { valeur: 'systeme', libelle: "Comme l'appareil" },
];
```

```html
<e-filtres libelle="Thème" [libelleTous]="null" [options]="themes"
           [selection]="theme.preference()" (selectionChange)="theme.definir($event ?? 'systeme')" />
```

### 1.6 Les autres services de `core`

| Export | API | Notes |
| --- | --- | --- |
| `GardienSceau` | `nombre: Signal<number>` ; `enregistrer(nature: string): () => void` | Actif seulement si `isDevMode()` **et** `config.gardienSceau`. Enregistrent un sceau : `EBouton` en variante `sceau`, chaque `ESceau` (grand ou non), chaque `EArete` (la tête). **Ne comptent pas** : `EEmpreinte`, `ETraits`, la marque. Au-delà d'un sceau visible, un seul `console.warn` pour toute la session : « [Empreinte] N sceaux à l'écran (…). Le brand book en autorise un seul : garde le sceau pour l’engagement principal, et passe les autres actions en bouton « trait ». » Inactif : `enregistrer` ne fait rien et `nombre` reste à 0. |
| `Haptique` | `vibrer(moment: 'pas' \| 'empreinte' \| 'palier')` | Motifs des tokens : `pas` [8], `empreinte` [12, 48, 20], `palier` [10, 70, 10, 70, 30]. Rien sans vibreur ou si `config.haptique` est faux. |
| `PreferencesMouvement` | `reduit: WritableSignal<boolean>` | Suit `prefers-reduced-motion: reduce`. |
| `ChargeurStyles` | `charger(porteur: Type<unknown>)` | Interne aux directives : crée une fois, sans l'attacher, un composant vide qui porte une feuille (§ 5.1). |
| `CONFIG_EMPREINTE`, `CONFIG_PAR_DEFAUT` | jeton et valeurs par défaut | Voir § 1.3. |
| `idUnique(prefixe)` | `string` | `` `${prefixe}-${n}` ``, compteur global à la page. |
| `UNITES`, `Unite`, `NomUnite` | unités comptées | `pas`, `etape`, `tache`, `empreinte` (singulier, pluriel, genre, « Premier… »). |
| Types | `Lumiere` (`'ciel' \| 'aube' \| 'soleil' \| 'fjord'`), `EtatPas` (`'fait' \| 'en-cours' \| 'a-venir'`), `TailleCorne` (`'s' \| 'm' \| 'l'`), `Courant` (`'true' \| 'page' \| 'step' \| 'location' \| 'date' \| 'time'`), `ThemeEmpreinte`, `PreferenceTheme`, `MomentHaptique`, `ConfigEmpreinte`, `Progression`, `OptionsLegende` | |

---

## 2. Les composants, point d'entrée par point d'entrée

Notation : « bool » = entrée booléenne avec `booleanAttribute` (l'attribut seul vaut `true`) ; « nombre » = `numberAttribute` (`taille="18"` fonctionne). « Requis » = `input.required`, oublier l'entrée est une erreur de compilation.

### 2.1 `icone` : `EIcone`, `ICONES_EMPREINTE`, `provideIcones`

**`<e-icone>`**

| Entrée | Type | Défaut | Notes |
| --- | --- | --- | --- |
| `nom` | `NomIcone \| string` | requis | Nom inconnu : rien n'est dessiné, `console.warn` en développement. Liste au § 3. |
| `taille` | nombre (px) | `20` | 20 dans les listes et la navigation, 24 seule. |
| `libelle` | `string \| undefined` | `undefined` | Avec libellé : `role="img"` + `aria-label`. Sans : `aria-hidden="true"` (décorative). |

Hôte : classe `e-icone-hote` (inline-flex). Rendu : `<svg class="e-icone" viewBox="0 0 24 24" focusable="false">`, trait `currentColor` en `--trait-icone`, tracés « pleins » remplis. La couleur suit celle du texte.

```html
<button eBouton="trait" petit type="button"><e-icone nom="plus" [taille]="18" />Ajouter un pas</button>
<e-icone nom="akari" [taille]="24" libelle="Akari" />
```

### 2.2 `surface` : `ESurface`, `ECorne`

**`[eSurface]`** (tout élément) — le panneau carré, plus lumineux que le fond, cerné d'un filet `trame`.

| Entrée | Type | Défaut | Effet |
| --- | --- | --- | --- |
| `marquee` | bool | `false` | Contour `encre` en `trait-net` : « la surface qui compte maintenant ». |

Hôte : `e-surface`, `e-surface--marquee` si `marquee`. Le fond et le contour sont dessinés par un `::before` en `z-index: -1` ; l'hôte reçoit `position: relative; isolation: isolate`. Aucun padding : l'espacement intérieur vient d'Apex (un `.ds-panel`, ou la feuille du composant).

**`[eCorne]`** — le coin haut-droit replié, « tu en es là ».

| Entrée | Type | Défaut | Effet |
| --- | --- | --- | --- |
| `eCorne` | `'' \| 's' \| 'm' \| 'l' \| null \| undefined` | `''` | `''` (attribut seul) = `m`. `null`/`undefined` = pas de corne. |
| `courant` | `Courant` | `'true'` | Valeur d'`aria-current` posée avec la corne. |
| `sansRabat` | bool | `false` | Coupe le coin sans dessiner le triangle replié. |

Hôte : `e-corne`, `e-corne--s` / `e-corne--l`, `e-corne--sans-rabat`, et `aria-current` quand la corne est active (jamais de corne sans `aria-current`). **Toujours avec `eSurface`** sur le même élément : la découpe passe par le `::before` d'`.e-surface`, et le rabat (`::after` absolu) a besoin de l'hôte positionné que donne `.e-surface`.

```html
<section eSurface eCorne="l" aria-labelledby="t-brouillon">…</section>
<article eSurface [eCorne]="etape.enCours ? 's' : null" [marquee]="etape.enCours">…</article>
```

### 2.3 `bouton` : `EBouton`

**`button[eBouton]`, `a[eBouton]`** (exportAs `eBouton`)

| Entrée | Type | Défaut | Effet |
| --- | --- | --- | --- |
| `eBouton` (variante) | `'sceau' \| 'trait' \| 'nu' \| ''` | `'trait'` | `''` (attribut seul) = `trait`. `sceau` : l'engagement, un seul par écran, jamais destructif, corne `s` qui s'ouvre en `m` au survol. `trait` : les actions courantes. `nu` : sorties douces (« Plus tard », « Laisser filer »), texte souligné. |
| `petit` | bool | `false` | 36px de haut au lieu de 44px. |
| `icone` | bool | `false` | Bouton carré 44×44 (36×36 en petit) qui ne porte qu'une `e-icone` : **`aria-label` obligatoire**. |

Hôte : `e-btn` + `e-btn--sceau|trait|nu`, `e-btn--petit`, `e-btn--icone`. Contenu projeté tel quel (texte et `<e-icone>`, espacés de `--pas-2`). Désactivé : attribut natif `disabled` (bouton) ou `aria-disabled="true"` (style seulement : un lien reste cliquable). Pas d'état de chargement. Pas de style de focus propre : c'est l'anneau global de `base.css`. Libellés de moins de 4 mots, qui commencent par un verbe ou disent l'intention.

```html
<a eBouton="sceau" routerLink="/objectifs/nouveau"><e-icone nom="plus" [taille]="18" />Nouvel objectif</a>
<button eBouton="trait" petit type="button" (click)="ajouterEtape()"><e-icone nom="plus" [taille]="18" />Ajouter une étape</button>
<button eBouton="nu" petit type="button" (click)="plusTard()">Pas maintenant</button>
<button eBouton="trait" icone type="submit" aria-label="Envoyer"><e-icone nom="envoyer" /></button>
```

### 2.4 `etiquette` : `EEtiquette`

**`<e-etiquette>`** — l'étiquette d'un domaine de vie, en capitales 12px.

| Entrée | Type | Défaut | Effet |
| --- | --- | --- | --- |
| `lumiere` | `Lumiere \| null \| undefined` | `null` | Fond `--<lumiere>-voile`, texte `--<lumiere>-vif`. Sans lumière : neutre (`creux` / `encre`). |

Hôte : `e-etiquette`, `e-etiquette--ciel|aube|soleil|fjord`. `align-self: flex-start` : elle ne s'étire pas dans une pile. Une lumière dit un domaine, **jamais un état** (pas de lumière pour un quadrant ou une étape). Les domaines de vie attendent le back-end (cahier § 3) : en V1, seulement l'étiquette neutre.

```html
<e-etiquette>Étape 3</e-etiquette>
```

### 2.5 `carte` : `ECarte`, `ECarteObjectif`, `ECarteAction`

**`article[eCarte]`, `section[eCarte]`, `div[eCarte]`, `li[eCarte]`** — un panneau carré sans ombre ni arrondi.

| Entrée | Type | Défaut | Effet |
| --- | --- | --- | --- |
| `marquee` | bool | `false` | La carte en cours : classes `e-corne` + `e-carte--marquee`, contour `encre` en `trait-net`, `aria-current="true"`. Une seule par liste ou par colonne. |

Hôte : `e-carte e-surface`. Mise en page intégrée : colonne flex, `gap: --pas-4`, `padding: --pas-6`, marges des enfants à 0. Sous-classes disponibles **à l'intérieur** de la carte (§ 5.4) : `e-carte__entete` (rangée étalée), `e-carte__pied` (rangée étalée, retour à la ligne), `e-carte__meta` et `e-carte__raison` (texte `encre-douce`). Pas de `a[eCarte]` : une carte cliquable porte un lien « Ouvrir » (`a[eBouton]`).

**`article[eCarteObjectif]`, `li[eCarteObjectif]`** — la carte d'objectif du brand book, toute faite.

| Entrée | Type | Défaut | Rendu |
| --- | --- | --- | --- |
| `titre` | `string` | requis | Titre en `.objectif`. |
| `niveau` | nombre | `2` | `3` → `h3`, `4` → `h4`, toute autre valeur → `h2`. |
| `domaine` | `string \| undefined` | — | `e-etiquette` dans l'en-tête. |
| `lumiere` | `Lumiere \| null` | `null` | Lumière de l'étiquette. |
| `contexte` | `string \| undefined` | — | Texte `detail` à droite de l'étiquette. L'en-tête n'existe que si `domaine` ou `contexte`. |
| `meta` | `string` | `''` | Ligne du pied (`p.e-carte__meta.detail`, rendue même vide). |
| `marquee` | bool | `false` | Comme `ECarte`. |
| `faits`, `enCours`, `aVenir` | nombre, bool, nombre | `0`, `false`, `0` | Transmis à l'`e-pas` intégré. |
| `unite` | `'pas' \| 'etape' \| 'tache' \| 'empreinte'` | `'pas'` | Idem (pas d'objet `Unite` ici, contrairement à `e-pas`). |
| `nomEnCours` | `string \| undefined` | — | Idem. |
| `accompli` | `string` | `'objectif accompli'` | Idem. |
| `libelleAction` | `string` | `'Ouvrir'` | Libellé du bouton `trait petit` du pied. |

Sortie : `ouvrir: void` (clic sur le bouton du pied). Contenu : le contenu par défaut se place **entre le titre et l'`e-pas`** (par exemple `<p class="voix e-carte__raison">« … »</p>`) ; un élément `[eCarteAction]` remplace le bouton du pied (par exemple un lien). Ordre fixe : en-tête, titre, contenu, `e-pas`, pied (meta + action).

**`[eCarteAction]`** : directive marqueur, sans entrée.

L'ordre d'`ECarteObjectif` ne correspond pas à la maquette `Objectifs` (horizon en tête, prochain pas dans le pied, après l'`e-pas`) : la carte d'objectif d'Apex se compose avec `article[eCarte]`.

```html
<article eCarte [attr.aria-labelledby]="'objectif-' + o.id">
  <p class="detail e-carte__meta">{{ o.horizon }}</p>                      <!-- « Jusqu'en mai » -->
  <h2 class="objectif" [id]="'objectif-' + o.id">{{ o.titre }}</h2>
  @if (o.pourquoi) {
    <p class="voix e-carte__raison">« {{ o.pourquoi }} »</p>
  }
  <e-pas [faits]="o.etapesFaites" [enCours]="!!o.etapeEnCours" [aVenir]="o.etapesAVenir"
         unite="etape" [nomEnCours]="o.etapeEnCours?.nom" />
  <div class="e-carte__pied">
    @if (o.prochainPas; as pas) {
      <ul eListe nue>
        <li eTache [titre]="pas.titre" meta="Prochain pas" [fait]="pas.fait" (faitChange)="basculer(pas.id, $event)"></li>
      </ul>
    }
    <a eBouton="trait" petit [routerLink]="['/objectifs', o.id]">Ouvrir</a>
  </div>
</article>
```

### 2.6 `pas` : `EPas`

**`<e-pas>`** — la progression case par case. On lit ce qui est fait.

| Entrée | Type | Défaut | Effet |
| --- | --- | --- | --- |
| `faits` | nombre | `0` | Cases pleines (`encre`). |
| `enCours` | bool | `false` | Une case en cours (contour `encre` net, corne `s`). Une seule. |
| `aVenir` | nombre | `0` | Cases à venir **sans** compter celle en cours. |
| `unite` | `'pas' \| 'etape' \| 'tache' \| 'empreinte' \| Unite` | `'pas'` | Ce qu'on compte dans la légende. |
| `nomEnCours` | `string \| undefined` | — | « 2 étapes faites · Endurance en cours ». |
| `accompli` | `string \| undefined` | `undefined` → « étape accomplie » | Fin de légende quand tout est fait. |
| `legende` | `string \| undefined` | `undefined` | Remplace la légende calculée **et** le nom accessible ; `''` les masque tous les deux. |

Hôte : `e-progression`. Rendu : `div.e-pas[role=img][aria-label=descriptionProgression(…)]` + `p.e-pas__legende` (`aria-hidden`, calculée par `legendeProgression`, § 4). Au-delà de 12 cases : `console.warn` en développement (« regroupe-les en étapes ») ; rien n'est tronqué. Aucune case et aucune légende si tout vaut 0.

```html
<e-pas [faits]="4" enCours [aVenir]="2" />                                   <!-- « 4 pas faits · 3 à venir » -->
<e-pas [faits]="2" enCours [aVenir]="3" unite="etape" nomEnCours="Endurance" /> <!-- « 2 étapes faites · Endurance en cours » -->
```

### 2.7 `sceau` : `ESceau`, `EEmpreinte`, `ETraits`

**`<e-sceau>`** — le grand sceau de palier (hors V1 : les paliers attendent le back-end).

| Entrée | Type | Défaut | Effet |
| --- | --- | --- | --- |
| `palier` | nombre | requis | Le chiffre. Quand il augmente : le sceau se repose (rebond) et vibre « palier ». |
| `repere` | `string` | `'Palier'` | Au-dessus du chiffre. |
| `grand` | bool | `false` | 136px au lieu de 120px. |
| `pose` | bool | `false` | Se poser au premier rendu, avec la vibration. |

Hôte : `e-sceau`, `role="img"`, `aria-label="<repere> <palier>"`, `e-sceau--grand`, `e-sceau--pose`. **Enregistré au `GardienSceau`**, grand ou non.

**`<e-empreinte>`** — l'empreinte d'une étape faite : petit sceau vermillon tourné de −2°, coche en deux traits. Peut se répéter ; non compté par le gardien.

| Entrée | Type | Défaut | Effet |
| --- | --- | --- | --- |
| `taille` | nombre (px) | `40` | Côté du sceau (variable `--e-taille` posée sur l'hôte). |
| `libelle` | `string` | `'Empreinte'` | Nom accessible. |
| `decorative` | bool | `false` | `aria-hidden="true"` au lieu de `role="img"` + `aria-label`. |
| `pose` | bool | `false` | Rebond et vibration « empreinte » **au premier rendu seulement** (lu une fois dans `afterNextRender`). |

Hôte : `e-sceau e-sceau--empreinte`, `e-sceau--pose` pendant l'animation.

**`<e-traits>`** — les traits vers le palier suivant (hors V1).

| Entrée | Type | Défaut | Effet |
| --- | --- | --- | --- |
| `gagnes` | nombre | requis | Traits pleins (plafonnés à `total`). Une hausse anime le nouveau trait. |
| `total` | nombre | `5` | Traits par palier. |
| `pose` | bool | `false` | Empilement animé au premier rendu. |
| `decoratifs` | bool | `false` | `aria-hidden` au lieu de `role="img"` + « 3 empreintes sur 5 vers le palier suivant ». |

```html
<e-empreinte [taille]="24" libelle="Étape faite" />
<e-empreinte [taille]="20" decorative />   <!-- dans une légende qui dit déjà « Faite » -->
```

### 2.8 `case` : `ECase`

**`input[type=checkbox][eCase]`** — la case carrée. Aucune entrée. `type="checkbox"` doit être écrit en dur (le sélecteur l'exige).

Hôte : `e-case` (20×20, `creux`, contour `trame-forte` ; cochée : `encre` avec coche `panneau` ; `indeterminate` et `disabled` gérés). Cocher vibre « pas ». Formulaires : c'est la case native, donc `[formField]`, `formControlName`, `[(ngModel)]` et `[checked]`/`(change)` marchent sans adaptateur. La case fait 20px : relier un `<label for>` (ou l'envelopper dans un `<label>`) pour offrir une cible confortable.

```html
<input type="checkbox" eCase id="pas-12" [checked]="pas.fait" (change)="basculer(pas.id, $any($event.target).checked)" />
<label class="corps" for="pas-12">{{ pas.titre }}</label>
```

### 2.9 `tache` : `EListe`, `ETache`, `ETacheMeta`, `ETacheActions`

**`ul[eListe]`, `ol[eListe]`**

| Entrée | Type | Défaut | Effet |
| --- | --- | --- | --- |
| `nue` | bool | `false` | Sans panneau, quand la liste est déjà dans une surface. Sinon l'hôte reçoit aussi `e-surface`. |

Hôte : `e-liste` (puces et marges retirées). Indispensable autour de `li[eTache]`.

**`li[eTache]`** — une ligne de pas avec sa case.

| Entrée | Type | Défaut | Effet |
| --- | --- | --- | --- |
| `titre` | `string` | requis | Intitulé, dans un `<label>` relié à la case. |
| `meta` | `string \| undefined` | — | Ligne de détail (`encre-douce`), reliée à la case par `aria-describedby`. |
| `fait` | `model<boolean>` | `false` | Double liaison `[(fait)]`, ou `[fait]` + `(faitChange)`. |
| `attend` | `boolean \| Date \| null` | `false` | La date est passée : une `Date` remplace `meta` par `formaterAttente(date)` (tant que le pas n'est pas fait) ; `true` garde `meta`. Fait apparaître « Replacer » et « Laisser filer ». |
| `libelleReplacer` | `string` | `'Replacer à demain'` | Libellé du bouton `trait petit`. |
| `desactivee` | bool | `false` | Désactive la case. |

Sorties : `faitChange: boolean`, `replacer: void`, `laisserFiler: void`. Contenu : `[eTacheMeta]` est projeté **dans le `<p>` de la ligne de détail**, avant le texte de `meta` (donc un élément en ligne, comme une `e-etiquette`) ; `[eTacheActions]` **remplace** les actions par défaut, dans un bloc placé sous le texte (colonne 2 de la grille), pas à droite.

Hôte : `e-tache`, `e-tache--faite`, `e-tache--attend` (si `attend` et pas fait). Rendu : grille `20px 1fr`, `padding: --pas-4 --pas-6`, filet `trame` entre deux tâches ; `input.e-case` (sans la directive `ECase`, mêmes styles), `label.e-tache__titre`, `p.e-tache__meta`, `div.e-tache__actions`. Faite : titre en `encre-douce`, jamais barré. Cocher vibre « pas ».

Clavier et souris : le titre est le `<label>` de la case, **cliquer le titre coche le pas**. Pour ouvrir ou modifier un pas, ajouter un bouton dans `eTacheActions`.

**`[eTacheMeta]`**, **`[eTacheActions]`** : directives marqueurs, sans entrée.

```html
<ul eListe nue>
  @for (pas of etape.pas; track pas.id) {
    <li eTache [titre]="pas.titre" [meta]="pas.fait ? 'Fait' : undefined"
        [fait]="pas.fait" (faitChange)="store.basculer(pas.id, $event)">
      <div eTacheActions>
        <button eBouton="nu" petit icone type="button" [attr.aria-label]="'Modifier « ' + pas.titre + ' »'" (click)="modifier(pas)">
          <e-icone nom="modifier" />
        </button>
      </div>
    </li>
  }
</ul>
```

### 2.10 `note` : `ENote`, `ENoteActions`

**`aside[eNote]`, `section[eNote]`, `div[eNote]`** — une phrase d'Akari posée dans la page, sans bulle ni cadre. Une note par écran au plus.

| Entrée | Type | Défaut | Effet |
| --- | --- | --- | --- |
| `qui` | `string` | `'Akari'` | Signature (en `repere`, donc affichée « AKARI »), précédée du losange. |
| `contexte` | `string \| undefined` | — | Signature « Akari · <contexte> ». |
| `libelle` | `string \| undefined` | « Message d'Akari » | `aria-label` de l'hôte (élision automatique « d' » devant une voyelle). |
| `large` | bool | `false` | 860px de large au lieu de 560px. |

Hôte : `e-note`, `e-note--large`, `aria-label`. Rendu : `p.e-note__qui` (signature), `div.e-note__voix` (le contenu projeté, en voix 20/30), puis l'élément `[eNoteActions]`.

**`[eNoteActions]`** : pose la classe `e-note__actions` (rangée de boutons, masquée si vide). Deux actions au plus : un `trait petit` et un `nu petit`.

```html
<!-- AnnoncesStore.signaler(…) affiché par la coque (cahier § 7) -->
<aside eNote>
  <p>Je n'ai pas pu enregistrer ce pas. Vérifie ta connexion, puis réessaie.</p>
  <div eNoteActions><button eBouton="trait" petit type="button" (click)="annonces.compris()">Compris</button></div>
</aside>
```

### 2.11 `champ` : `EChamp`, `ESaisie`, `ETailleAuto`, `ecrireErreur`

**`<e-champ>`** — libellé toujours visible, contrôle, aide, message.

| Entrée | Type | Défaut | Effet |
| --- | --- | --- | --- |
| `libelle` | `string` | requis | `<label>` relié au contrôle (`for` = id du contrôle). |
| `aide` | `string \| undefined` | — | Aide sous le contrôle. |
| `erreur` | `string \| null \| undefined` | — | Message affiché (prime sur celui de Signal Forms). Contour du contrôle en `trait-net`, losange d'encre, **jamais de rouge**. |
| `facultatif` | bool | `false` | Ajoute « facultatif » au libellé (on marque le facultatif, pas l'obligatoire). |

Fournit `CONTEXTE_CHAMP` ; trouve le premier `CONTROLE_CHAMP` descendant (`input[eSaisie]`, `textarea[eSaisie]`, `e-selection`). Le message vit dans un `<p aria-live="polite">` toujours présent, caché quand vide ; aide et message sont reliés au contrôle par `aria-describedby`. Hôte : `e-champ` (grille, `gap: --pas-2`).

**`input[eSaisie]`, `textarea[eSaisie]`** (exportAs `eSaisie`)

| Entrée | Type | Défaut | Effet |
| --- | --- | --- | --- |
| `id` | `string \| undefined` | `e-saisie-N` | Id du contrôle (posé sur l'hôte). |
| `invalide` | bool | `false` | Force l'état invalide (formulaires réactifs, validation maison). |

Hôte : `e-saisie` (creux carré, 100 % de large, 44px min, 88px pour un `textarea`), `id`, `aria-describedby` (depuis le champ), `aria-invalid="true"` si invalide. Formulaires : élément natif, donc `formControlName`, `[(ngModel)]`, `[formField]`. **Avec Signal Forms seulement** (`[formField]`, jeton `FORM_FIELD`), la première erreur s'écrit seule dans le champ, une fois le contrôle touché, via `ecrireErreur`. Avec les formulaires réactifs d'Apex, passer le message par `[erreur]` du champ.

**`textarea[eSaisie][tailleAuto]`** (`ETailleAuto`) — grandit avec le texte (`CdkTextareaAutosize` en directive hôte). Entrées `lignesMin`, `lignesMax` (nombres). Hôte : `e-saisie--taille-auto` (56px min, pas de poignée).

**`ecrireErreur(erreur: ValidationError): string`** — le `message` du validateur passe en premier ; sinon, vérifié à l'exécution :

| `kind` | Texte |
| --- | --- |
| `required` | « Écris quelque chose ici pour continuer. » |
| `email` | « Cette adresse semble incomplète. Ajoute la fin, par exemple @gmail.com. » |
| `minLength` (3) | « Encore un peu : au moins 3 caractères. » |
| `maxLength` (80) | « C'est un peu long : 80 caractères au plus. » |
| `min` (1) / `max` (5) | « Choisis une valeur d'au moins 1. » / « Choisis une valeur de 5 au plus. » |
| `minDate` / `maxDate` | « Choisis une date à partir du 21 octobre 2026. » / « … jusqu'au … » |
| `pattern` | « Le format n'est pas encore le bon. Vérifie ce que tu as écrit. » |
| `parse` | « Cette valeur n'est pas lisible. Vérifie ce que tu as écrit. » |
| autre | « Vérifie ce que tu as écrit. » |

Aussi exportés : `CONTROLE_CHAMP`, `CONTEXTE_CHAMP`, les interfaces `ControleChamp` (`idControle`, `messageAuto`) et `ContexteChamp` (`idLibelle`, `idsDecrivant`, `enErreur`), `EStylesChamp`.

```html
<form [formGroup]="form" (ngSubmit)="enregistrer()" class="ds-stack">
  <e-champ libelle="Ce que tu veux construire" [erreur]="erreurTitre()">
    <input eSaisie formControlName="title" autocomplete="off" />
  </e-champ>
  <e-champ libelle="Pourquoi ça compte pour toi" facultatif>
    <textarea eSaisie tailleAuto [lignesMin]="2" [lignesMax]="6" formControlName="why"></textarea>
  </e-champ>
  <e-champ libelle="Pour quand" aide="Une date, même approximative.">
    <input eSaisie type="date" formControlName="dueDate" />
  </e-champ>
</form>
```

### 2.12 `selection` : `ESelection`

**`<e-selection>`** — une liste déroulante (Angular Aria : combobox + listbox).

| Entrée | Type | Défaut | Effet |
| --- | --- | --- | --- |
| `options` | `readonly OptionSelection<T>[]` | requis | `{ valeur: T; libelle: string; desactivee?: boolean }`. |
| `valeur` | `model<T \| null>` | `null` | `[(valeur)]` ou `(valeurChange)`. `null` affiche `texteVide`. |
| `texteVide` | `string` | `'Choisir'` | Texte tant que rien n'est choisi. |
| `libelle` | `string \| undefined` | — | `aria-label`, **seulement hors d'un `e-champ`** (dans un champ, `aria-labelledby` pointe le libellé). |
| `desactivee` | bool | `false` | |
| `comparer` | `(a: T, b: T) => boolean` | `Object.is` | Retrouve l'option choisie (utile si `T` est un objet). |
| `id` | `string \| undefined` | `e-selection-N` | Id du combobox. |

Formulaires : `ControlValueAccessor` (fourni par `NG_VALUE_ACCESSOR`), donc `formControlName`, `[(ngModel)]`, et `[formField]` par l'interopérabilité de Signal Forms. `writeValue(undefined)` devient `null`. Touché à la sortie du focus quand la liste est repliée. **Pas de message automatique** : passer l'erreur par `[erreur]` du champ.

Clavier : flèches, Entrée, Échap, saisie pour atteindre une option. La liste s'ouvre dans un overlay CDK en popover natif (`usePopover: 'inline'`, largeur de l'origine) : rien à configurer, pas d'équivalent d'`appendTo` nécessaire, y compris dans une feuille. Hôte : `e-selection-hote` (bloc). Rendu : `div.e-selection` (le combobox, avec `e-selection__valeur` et un chevron), `div.e-liste-options` > `div.e-option` (coche sur l'option choisie).

```ts
// les niveaux d'Apex, déjà en { valeur, libelle } : chore/constants/task.constante.ts
protected readonly importances = IMPORTANCE_OPTIONS;
```
```html
<e-champ libelle="Importance">
  <e-selection [options]="importances" formControlName="importance" texteVide="Choisis" />
</e-champ>
```

### 2.13 `menu` : `EMenu`

**`<e-menu>`** — un bouton qui déplie un menu d'actions (Angular Aria pour le clavier, CDK pour la position).

| Entrée | Type | Défaut | Effet |
| --- | --- | --- | --- |
| `entrees` | `readonly EntreeMenu<V>[]` | requis | Actions et séparateurs. |
| `libelle` | `string` | requis | Nom du menu ; aussi `aria-label` du bouton quand il n'a pas de texte. |
| `texte` | `string \| undefined` | — | Texte du bouton. Sans texte : bouton icône carré. |
| `icone` | `string \| null` | `'actions'` | Nom d'`e-icone` du bouton (ici une chaîne, pas un booléen comme sur `eBouton`). `null` : pas d'icône. |
| `variante` | `'sceau' \| 'trait' \| 'nu'` | `'nu'` | Variante du bouton (`sceau` compterait au gardien). |
| `petit` | bool | `false` | Bouton petit. |

Sortie : `choix: V` (le menu se replie seul). Formes exactes :

```ts
interface ElementMenu<V> { valeur: V; libelle: string; icone?: string; doux?: boolean; desactive?: boolean }
interface SeparateurMenu { separateur: true }
type EntreeMenu<V> = ElementMenu<V> | SeparateurMenu;
```

`doux` : texte `encre-douce` (sorties douces). `desactive` (masculin ici, `desactivee` ailleurs). Le menu ne marque pas l'élément choisi (pas d'élément radio) : pour un choix exclusif visible, préférer `e-filtres` ou `e-selection`. Hôte : `e-menu-hote`. Rendu : `div.e-menu` > `div.e-menu__element` (44px), `div.e-menu__separateur[role=separator]`.

```ts
protected readonly cibles = QUADRANTS.map((q): EntreeMenu<Quadrant> => ({ valeur: q, libelle: TITRES_QUADRANTS[q] }));
```
```html
<e-menu libelle="Déplacer vers…" icone="deplacer" petit [entrees]="cibles" (choix)="deplacerVers(pas, $event)" />
```

### 2.14 `filtres` : `EFiltres`

**`<e-filtres>`** — une rangée de bascules, une seule active (Angular Aria `Toolbar` : une tabulation pour entrer, flèches pour se déplacer, retour au début).

| Entrée | Type | Défaut | Effet |
| --- | --- | --- | --- |
| `options` | `readonly OptionFiltre<V>[]` | requis | `{ valeur: V; libelle: string; lumiere?: Lumiere }` (la lumière ajoute un petit carré de couleur). |
| `selection` | `model<V \| null>` | `null` | `[(selection)]` ou `(selectionChange)`. `null` = « Tous ». Comparaison par `===`. |
| `libelleTous` | `string \| null` | `'Tous'` | Premier filtre, qui remet `null`. `null` ou `''` : pas de filtre « Tous ». |
| `libelle` | `string` | requis | `aria-label` de la rangée. |

Rendu : `div.e-filtres` > `button[eBouton=trait][petit].e-filtre` avec `aria-pressed` ; le filtre actif prend le contour d'encre et sa corne `s`. Recliquer le filtre actif ne le désactive pas.

```html
<e-filtres libelle="Filtrer par objectif" libelleTous="Tous les objectifs" [options]="filtresObjectifs()" [(selection)]="objectifFiltre" />
```

### 2.15 `onglets` : `EOnglets`, `EListeOnglets`, `EOnglet`, `EPanneauOnglet`, `EVues`, `EVue`

Onglets dans la page (Angular Aria `Tabs`) :

| Sélecteur | Directive Aria | Entrées (alias) | Hôte |
| --- | --- | --- | --- |
| `[eOnglets]` | `Tabs` | — | `e-onglets` (colonne, `gap: --pas-6`) ; charge la feuille. |
| `[eListeOnglets]` | `TabList` | `selection` (`model<string \| undefined>`, sortie `selectionChange`), `orientation` (`'horizontal' \| 'vertical'`), `modeSelection` (`'follow'` par défaut \| `'explicit'`), `boucle` (bool) | `e-onglets__liste` |
| `[eOnglet]` | `Tab` | `eOnglet` (la valeur, `string`, **requise**), `desactive` (bool) | `e-onglet` ; actif = panneau éclairé + corne `s` (`aria-selected="true"`) |
| `[ePanneauOnglet]` | `TabPanel` | `ePanneauOnglet` (valeur, **requise**) | `e-onglets__panneau` ; caché (`inert`) tant que son onglet n'est pas actif |

Vues qui sont des routes (liens, sans rôle d'onglet) : **`nav[eVues]`** (`e-onglets__liste`, charge la feuille) et **`a[eVue]`** (`e-onglet`), avec `routerLink`, `routerLinkActive` et `ariaCurrentWhenActive="page"` : l'entrée courante prend la même forme. `a[eVue]` seul, hors de `nav[eVues]`, n'est pas stylé tant qu'aucune directive de la famille n'a chargé la feuille. Pas d'usage prévu dans les maquettes V1.

```html
<div eOnglets>
  <div eListeOnglets [(selection)]="vue" aria-label="Vues de l'objectif">
    <button eOnglet="arete"><e-icone nom="arete" [taille]="18" />Arête</button>
    <button eOnglet="pas"><e-icone nom="coche" [taille]="18" />Pas</button>
  </div>
  <section ePanneauOnglet="arete">…</section>
  <section ePanneauOnglet="pas">…</section>
</div>
```

### 2.16 `navigation` : `ECoque`, `ECoquePrincipal`, `ECoqueContenu`, `ENav`, `ENavListe`, `ENavBas`, `ELienNav`, `EMarque`, `EFilAriane`

| Sélecteur | Entrées | Hôte | Rôle |
| --- | --- | --- | --- |
| `[eCoque]` | — | `e-coque` | Flex avec retour à la ligne, `min-height: 100dvh`, fond `--fond`. Charge la feuille de navigation. |
| `nav[eNav]` | — | `e-nav e-coque__nav` | Colonne (base 232px), `gap: 40px`, filet `trame` à droite. |
| `ul[eNavListe]` | — | `e-nav__liste` | Liste des entrées. Chaque `li` est en flex. |
| `a[eLienNav]` | `icone: string \| null` (défaut `null`) | `e-nav__lien` | Lien 44px avec `e-icone` 20px et `span.e-nav__libelle`. L'entrée qui porte `aria-current="page"` devient un panneau éclairé avec corne `s`. |
| `[eNavBas]` | — | `e-nav__bas` | Bas de la navigation (`margin-top: auto`, colonne). **Masqué sous 760px.** |
| `e-marque`, `a[eMarque]` | — | `e-marque` | Petit sceau à corne (non compté par le gardien) + nom en `sens` 26/32 semi-gras, 44px. |
| `main[eCoquePrincipal]` (tout élément) | — | `e-coque__principal` | La page : `padding: 48px 56px 72px` (sous 760px : `24px 16px 48px`). |
| `[eCoqueContenu]` | — | `e-coque__contenu` | Centré, 1120px au plus, colonne, `gap: 40px`. |
| `nav[eFilAriane]` | `libelle: string` (défaut « Fil d'Ariane ») | `e-fil-ariane`, `aria-label` | Fil d'Ariane : `ol > li`, séparateurs « / » dessinés, liens soulignés `encre-douce`, page courante `[aria-current=page]` en encre. |

Sous 760px : la navigation passe en haut, en rangée ; les libellés des liens deviennent invisibles (restent lus) ; `eNavBas` disparaît. La classe `e-nav__marque` (padding `0 --pas-3`) existe dans la feuille mais aucune directive ne la pose : l'ajouter à la main sur la marque (§ 5.4).

Structure complète attendue (coque d'Apex, entrées V1 : Objectifs, Matrice) :

```html
<div eCoque>
  <nav eNav aria-label="Navigation principale">
    <a eMarque class="e-nav__marque" routerLink="/">Apex</a>
    <ul eNavListe>
      <li>
        <a eLienNav icone="objectifs" routerLink="/" routerLinkActive ariaCurrentWhenActive="page"
           [routerLinkActiveOptions]="{ exact: true }">Objectifs</a>
      </li>
      <li>
        <a eLienNav icone="matrice" routerLink="/matrice" routerLinkActive ariaCurrentWhenActive="page">Matrice</a>
      </li>
    </ul>
    <div eNavBas>
      <!-- réglages (thème) : invisibles sous 760px, prévoir un autre accès sur mobile -->
    </div>
  </nav>
  <main eCoquePrincipal id="contenu" tabindex="-1">
    <div eCoqueContenu>
      <!-- AnnoncesStore.signaler : aside[eNote] ici -->
      <router-outlet />
    </div>
  </main>
</div>
```

```html
<nav eFilAriane>
  <ol>
    <li><a routerLink="/">Objectifs</a></li>
    <li aria-current="page">{{ objectif.titre }}</li>
  </ol>
</nav>
```

### 2.17 `feuille` : `Feuilles`, `EFeuille`, `EFeuilleActions`

Une feuille est un dialogue modal (CDK Dialog), centré, qui se déplie depuis son pli haut. Pas de panneau latéral dans Empreinte.

**`Feuilles`** (service racine)

```ts
ouvrir<C, D = unknown, R = unknown>(composant: ComponentType<C>, options?: OptionsFeuille<D>): DialogRef<R, C>

interface OptionsFeuille<D> {
  donnees?: D;                          // injectées avec DIALOG_DATA
  sansFermetureExterieure?: boolean;    // Échap et clic sur le fond ne ferment plus (disableClose)
  libelle?: string;                     // aria-label, quand la feuille n'a pas d'e-feuille titrée
  cdk?: Partial<DialogConfig<D>>;       // réglages CDK ajoutés en dernier (écrasent les précédents)
}
```

Configuration passée au CDK : `data`, `panelClass: 'e-feuille-panneau'`, `backdropClass: 'e-feuille-fond'`, `ariaLabel`, `disableClose`, `autoFocus: 'first-heading'` (le focus va sur le titre `h2` de l'`e-feuille`), `restoreFocus: true`, puis `...options.cdk` (écraser `panelClass` fait perdre le style du panneau).

Dans le composant ouvert, depuis `@angular/cdk/dialog` :

```ts
protected readonly donnees = inject<DonneesFeuillePas>(DIALOG_DATA);
protected readonly ref = inject<DialogRef<ResultatFeuillePas, FeuillePas>>(DialogRef);
// fermer avec une valeur : this.ref.close(resultat) ; sans : this.ref.close()
```

Côté appelant : `ref.closed` (`Observable<R | undefined>`) émet la valeur de `close()`, ou `undefined` pour Échap, le fond ou le bouton « Fermer ».

**Injecteur** : `Feuilles` et `Dialog` sont fournis à la racine, donc le composant ouvert hérite de l'injecteur **racine**. Les stores fournis par la coque (`providers: [ObjectiveStore, …]` dans `shell.ts`) n'y sont pas : passer `cdk: { injector: inject(Injector) }` (ou `viewContainerRef`) depuis le composant appelant.

**`<e-feuille>`** — la mise en page de la feuille, dans le gabarit du composant ouvert.

| Entrée | Type | Défaut | Effet |
| --- | --- | --- | --- |
| `titre` | `string` | requis | `h2.e-feuille__titre` (28/36 en `sens`, `tabindex="-1"`) ; nomme le dialogue (`aria-labelledby`) si aucun `aria-label` n'est posé. |
| `styleTitre` | `'objectif' \| 'manifeste'` | `'objectif'` | `manifeste` : 44/52, pour un moment fort. |
| `fermable` | bool | `true` | Bouton `nu icone` « Fermer » en haut à droite (appelle `ref.close()`). |
| `largeur` | nombre (px) | `640` | Largeur maximale (`--e-largeur`), bornée à l'écran moins `--pas-4` de chaque côté. |

Rendu : en-tête (titre + fermer), `div.e-feuille__corps` (le contenu projeté, colonne `gap: --pas-4`), puis `[eFeuilleActions]`. Fond `panneau`, `--ombre-feuille`, défilement interne au-delà de la hauteur d'écran.

**`[eFeuilleActions]`** : pose `e-feuille__actions` (rangée de boutons, masquée si vide).

```ts
// Ouvrir
private readonly feuilles = inject(Feuilles);
private readonly injecteur = inject(Injector);
modifier(pas: TaskViewModel) {
  this.feuilles
    .ouvrir<FeuillePas, DonneesFeuillePas, ResultatFeuillePas>(FeuillePas, { donnees: { pas }, cdk: { injector: this.injecteur } })
    .closed.subscribe((resultat) => resultat && this.store.editTask(resultat));
}
```
```html
<!-- feuille-pas.html -->
<e-feuille titre="Modifier le pas">
  <form [formGroup]="form" (ngSubmit)="ref.close(form.getRawValue())" class="ds-stack" id="form-pas">
    <e-champ libelle="Le pas"><input eSaisie formControlName="title" /></e-champ>
  </form>
  <div eFeuilleActions>
    <button eBouton="trait" type="submit" form="form-pas">Enregistrer</button>
    <button eBouton="nu" type="button" (click)="ref.close()">Annuler</button>
  </div>
</e-feuille>
```

Une feuille ouverte par-dessus un écran qui a déjà son sceau (la tête de l'arête, par exemple) ne doit pas porter de bouton `sceau` : le gardien compte tout ce qui est affiché.

### 2.18 `carnet` : `ECarnet`, `EPli` (hors V1)

**`<e-carnet>`** (directive hôte Aria `AccordionGroup`) : `ouvert` (`model<unknown>`, `null` = replié, `[(ouvert)]`), `libelle` (`aria-label` de la liste). Hôte `e-carnet-cadre` (conteneur de requête) ; rend un `ol.e-carnet` : plis horizontaux (dos verticaux de 64px), verticaux sous 720px de large.

**`li[ePli]`** : `valeur` (`unknown`, requis), `titre` (`string`, requis), `date` (`string`, `''`), `marque` (`'sceau' \| 'pause' \| null`), `libelle` (nom accessible du dos), `niveau` (nombre, `3`, `aria-level` de l'en-tête). Un seul pli ouvert ; le pli ouvert porte la corne. Pensé pour l'historique des décisions : ce n'est pas un accordéon générique.

### 2.19 `matrice` : `EMatrice`, `EMatriceElement`, `appliquerDeplacement`, `QUADRANTS`, `TITRES_QUADRANTS`

**`<e-matrice>`** — la matrice d'Eisenhower en shoji ; elle ne garde rien et annonce `(deplacement)`.

| Entrée | Type | Défaut | Effet |
| --- | --- | --- | --- |
| `quadrants` | `Readonly<Record<Quadrant, readonly T[]>>` | requis | Les éléments de chaque quadrant (`'maintenant' \| 'planifier' \| 'confier' \| 'laisser-filer'`). |
| `piste` | `(element: T) => unknown` | identité | Clé du `@for` et repère de l'élément qui arrive. Passer `(t) => t.id` dès que les objets sont recréés par le store. |
| `courant` | `Quadrant \| null` | `'maintenant'` | Le quadrant qui porte la corne et `aria-current="true"`. |
| `titres` | `Readonly<Record<Quadrant, string>>` | `TITRES_QUADRANTS` | Maintenant, À planifier, À confier, À laisser filer. |
| `axes` | `{ urgent; pasUrgent; important; secondaire }` (chaînes) | Urgent, Pas urgent, Important, Secondaire | |
| `unite` | `readonly [string, string]` (singulier, pluriel) | `['tâche', 'tâches']` | Le compte de chaque quadrant : `compter(n, …)`, par exemple « 4 pas ». |
| `libelle` | `string` | « Matrice d'Eisenhower » | `aria-label` du groupe des quadrants. |
| `deplacable` | bool | `true` | Glisser-déposer (CDK) actif. |

Sortie : `deplacement: DeplacementMatrice<T>` = `{ element: T; de: Quadrant; vers: Quadrant; index: number }` (index dans le quadrant d'arrivée). Rien n'est émis si l'élément revient à sa place. L'élément arrivé se déplie (`e-quadrant__element--arrive`).

Contenu : **`ng-template[eMatriceElement]`** — le gabarit d'un élément. Contexte : `$implicit` (l'élément) et `quadrant`. L'entrée `eMatriceElement` (les quadrants ou une liste) ne sert qu'à typer `let-…`. Sans gabarit, chaque élément s'affiche en texte avec une puce.

Rendu : grille `auto 1fr 1fr` ; axes en `repere` ; `div.e-matrice__grille[role=group]` sur fond `encre` ; quatre `section.e-quadrant.e-surface[aria-labelledby]` dans l'ordre maintenant, planifier (rangée Important), confier, laisser-filer (rangée Secondaire) ; titre **`h3.e-quadrant__titre`** ; `p.e-quadrant__compte` ; `ul.e-quadrant__liste[cdkDropList]` > `li.e-quadrant__element[cdkDrag]` (toute la ligne se saisit, curseur « grab »). Sous 640px, les quadrants s'empilent sur une colonne.

Le glisser-déposer ne se fait pas au clavier : chaque élément doit offrir une action « Déplacer vers… » (`e-menu`).

**`appliquerDeplacement(quadrants, deplacement, piste?)`** : renvoie de nouveaux quadrants sans muter (retire l'élément du départ par sa clé, l'insère à `index` borné). Vérifié : déplacer `{id:1}` de `maintenant` vers `planifier` à l'index 0 donne `planifier: [{id:1},{id:3}]`. Sans `piste`, la comparaison se fait par référence.

**`QUADRANTS`** = `['maintenant', 'planifier', 'confier', 'laisser-filer']` ; **`TITRES_QUADRANTS`** = `{ maintenant: 'Maintenant', planifier: 'À planifier', confier: 'À confier', 'laisser-filer': 'À laisser filer' }`. Types `Quadrant`, `DeplacementMatrice<T>`, `ContexteElementMatrice<T>`.

```ts
protected readonly parId = (pas: TaskViewModelWithCategoryAndObjectiveTitle) => pas.id;
protected readonly unitePas = ['pas', 'pas'] as const;   // un tableau littéral dans le gabarit serait typé string[]
protected readonly cibles = QUADRANTS.map((q): EntreeMenu<Quadrant> => ({ valeur: q, libelle: TITRES_QUADRANTS[q] }));
```
```html
<e-matrice [quadrants]="quadrants()" [piste]="parId" [unite]="unitePas" (deplacement)="deplacer($event)">
  <ng-template [eMatriceElement]="quadrants()" let-pas let-quadrant="quadrant">
    <ul eListe nue>
      <li eTache [titre]="pas.title" [meta]="pas.objectiveTitle" [fait]="pas.done" (faitChange)="basculer(pas.id, $event)">
        <div eTacheActions>
          <e-menu libelle="Déplacer vers…" icone="deplacer" petit [entrees]="cibles"
                  (choix)="deplacer({ element: pas, de: quadrant, vers: $event, index: 0 })" />
        </div>
      </li>
    </ul>
  </ng-template>
</e-matrice>
```

### 2.20 `arete` : `EArete`, `etapesAffichees`, `lignesTete`, `MAXIMUM_ARETES`

**`<e-arete>`** — le diagramme d'Ishikawa : la tête (l'objectif) dans un sceau à corne, une colonne d'encre, une arête à 45° par étape, alternativement au-dessus et au-dessous, de la plus ancienne (à gauche) à la plus proche de l'objectif.

| Entrée | Type | Défaut | Effet |
| --- | --- | --- | --- |
| `objectif` | `string` | requis | Écrit dans la tête : 2 lignes de 15 caractères au plus (`lignesTete`). |
| `etapes` | `readonly EtapeArete[]` | requis | `{ nom: string; etat: 'faite' \| 'en-cours' \| 'a-venir'; detail?: string }`. |
| `repere` | `string` | `'OBJECTIF'` | Au-dessus du nom dans la tête. |
| `interactive` | bool | `false` | Chaque arête devient un bouton (`role="button"`, `tabindex="0"`, Entrée et Espace) avec une zone de clic. |

Sortie : `choisir: EtapeArete` — **l'objet passé dans `etapes`** (pas d'identifiant). Pour retrouver l'étape, passer des objets enrichis (`EtapeArete & { id: string }`) et comparer par référence ; l'arête repliée « Faites » (au-delà de 8 étapes) est un objet créé par le composant, sans `id`.

Rendu : `svg.e-arete` (viewBox de hauteur 300, largeur selon le nombre d'arêtes, `max-width: 720px`, `width: 100%`) avec `role="img"` (ou `group` si interactive) et un `<title>` résumé : « Arête de l'objectif « X » : 6 étapes, 2 faites, 1 en cours, 3 à venir ». Par étape : branche (faite : `trait-net` ; à venir : `trame-forte`), borne carrée de 8px (faite : pleine ; en cours : vide encre ; à venir : vide `trame-forte`), nom tronqué à 18 caractères, détail tronqué à 22 (par défaut « Faite », « En cours », « À venir »). Une nouvelle étape se trace en s'animant. **La tête est un sceau, enregistrée au `GardienSceau`.**

**`etapesAffichees(etapes)`** : au-delà de `MAXIMUM_ARETES` (8) étapes et s'il y en a au moins une faite, les faites se replient en tête de liste dans `{ nom: 'Faites', etat: 'faite', detail: '<n> étapes' }`. Vérifié : 3 faites + 6 autres donnent `Faites (3 étapes)` + les 6.

**`lignesTete(texte, max = 15)`** : vérifié — « Courir un semi-marathon en mai » → `['Courir un', 'semi-marathon…']` ; « Semi-marathon en mai » → `['Semi-marathon', 'en mai']`.

```ts
protected readonly etapes = computed<(EtapeArete & { id: string })[]>(() =>
  this.store.etapes().map((e) => ({ id: e.id, nom: e.titre, etat: e.etat, detail: e.legende })),
);
protected choisir(etape: EtapeArete) {
  const choisie = this.etapes().find((e) => e === etape);
  if (choisie) this.etapeOuverte.set(choisie.id);
}
```
```html
<e-arete [objectif]="objectif().titre" [etapes]="etapes()" interactive (choisir)="choisir($event)" />
```

---

## 3. Les icônes

`ICONES_EMPREINTE` contient 29 icônes, dessinées sur une grille de 24px, segments à 0°, 45° et 90°, extrémités carrées, jonctions en biseau, un cercle devient un octogone, pleines seulement pour l'état « fait ».

| Nom | Pour |
| --- | --- |
| `aujourdhui` | Aujourd'hui (hors V1) |
| `objectifs` | Objectifs (navigation, accueil) |
| `matrice` | Matrice |
| `carnet` | Carnet (hors V1) |
| `akari` | Akari (losange plein au centre) |
| `arete` | L'arête |
| `reglages` | Réglages |
| `plus` | Ajouter |
| `fermer` | Fermer |
| `envoyer` | Envoyer |
| `replacer` | Replacer |
| `laisser-filer` | Laisser filer |
| `modifier` | Modifier |
| `pause` | Mettre en pause |
| `reprendre` | Reprendre |
| `recherche` | Rechercher |
| `menu` | Menu |
| `actions` | Actions (trois carrés pleins verticaux ; icône par défaut d'`e-menu`) |
| `deplacer` | Déplacer (six carrés pleins) |
| `chevron-bas`, `chevron-haut`, `chevron-droite`, `chevron-gauche` | Déplier, replier, aller, revenir |
| `coche` | Fait |
| `empreinte` | Empreinte |
| `information` | Information |
| `calendrier` | Date, horizon |
| `jour`, `nuit` | Thèmes |

Type `NomIcone` = les clés de `ICONES_EMPREINTE` ; `e-icone` accepte aussi toute chaîne.

**Ajouter une icône** : `provideIcones(icones: Record<string, readonly Trace[]>): Provider` (fournisseur `multi` du jeton `ICONES_SUPPLEMENTAIRES`), où `Trace = string | { d: string; plein: true }`. À placer dans les `providers` d'`app.config.ts` (ou d'un composant). Les jeux ajoutés sont consultés **avant** ceux d'Empreinte : un nom existant serait remplacé. Dessiner selon les mêmes règles.

```ts
provideIcones({ etape: ['M4 18h16', 'M8 18V10h8v8'] })
```

---

## 4. Les fonctions de voix (`core`)

Sorties obtenues en exécutant les fonctions installées.

**`legendeProgression(progression: Progression, options?: OptionsLegende): string`** — commence toujours par ce qui est fait. `Progression = { faits: number; enCours?: number; aVenir: number }` (`enCours` vaut 1 s'il est vrai, `aVenir` sans celui en cours). `OptionsLegende = { unite?: NomUnite | Unite; nomEnCours?: string; accompli?: string }` (`accompli` par défaut « étape accomplie »).

| Appel | Résultat |
| --- | --- |
| `{ faits: 4, enCours: 1, aVenir: 2 }` | « 4 pas faits · 3 à venir » |
| `{ faits: 0, enCours: 1, aVenir: 5 }` | « Premier pas en cours · 5 à venir » |
| `{ faits: 0, enCours: 1, aVenir: 0 }` | « Premier pas en cours » |
| `{ faits: 0, aVenir: 3 }` | « 3 pas à venir » |
| `{ faits: 7, aVenir: 0 }` | « 7 pas faits · étape accomplie » |
| `{ faits: 1, aVenir: 0 }` | « 1 pas fait · étape accomplie » |
| `{ faits: 1, enCours: 1, aVenir: 0 }` | « 1 pas fait · 1 à venir » (l'en-cours compte dans « à venir ») |
| `{ faits: 0, aVenir: 0 }` | « » (chaîne vide) |
| `{ faits: 2, enCours: 1, aVenir: 3 }, { unite: 'etape', nomEnCours: 'Endurance' }` | « 2 étapes faites · Endurance en cours » |
| `{ faits: 0, enCours: 1, aVenir: 3 }, { unite: 'etape', nomEnCours: 'Endurance' }` | « Endurance en cours · 3 étapes à venir » |
| `{ faits: 1, aVenir: 3 }, { unite: 'etape' }` | « 1 étape faite · 3 à venir » |
| `{ faits: 3, aVenir: 0 }, { unite: 'etape', accompli: 'objectif accompli' }` | « 3 étapes faites · objectif accompli » |

**`descriptionProgression(progression, unite = 'pas'): string`** — le nom accessible (`aria-label` d'`e-pas`).

| Appel | Résultat |
| --- | --- |
| `{ faits: 4, enCours: 1, aVenir: 2 }` | « 4 pas faits, 1 en cours, 2 à venir » |
| `{ faits: 0, enCours: 1, aVenir: 5 }` | « Premier pas en cours, 5 à venir » |
| `{ faits: 7, aVenir: 0 }` | « 7 pas faits, tout est fait » |
| `{ faits: 2, enCours: 1, aVenir: 3 }, 'etape'` | « 2 étapes faites, 1 en cours, 3 à venir » |
| `{ faits: 0, enCours: 1, aVenir: 3 }, 'etape'` | « Première étape en cours, 3 à venir » |
| `{ faits: 0, aVenir: 0 }` | « » |

**`formaterAttente(depuis: Date, maintenant = new Date()): string`** — compare des jours calendaires (exemples avec maintenant = mercredi 21 octobre 2026).

| `depuis` | Résultat |
| --- | --- |
| le jour même | « Pour aujourd'hui » |
| **toute date future** (jeudi 22 octobre) | « Pour aujourd'hui » |
| la veille | « T'attend depuis hier » |
| 2 à 6 jours avant | « T'attend depuis lundi », « T'attend depuis jeudi » |
| 7 jours ou plus | « T'attend depuis le 14 octobre » ; le 1er : « T'attend depuis le 1er octobre » |
| une autre année | « T'attend depuis le 3 décembre 2025 » |

**`formaterSerie(jours: number, etat?: { enPause?: boolean; reprise?: boolean }): string`** — 0 → « 0 jour tenu », 1 → « 1 jour tenu », 47 → « 47 jours tenus », `(47, { enPause: true })` → « Série en pause · 47 jours tenus », `(3, { reprise: true })` → « Reprise · 3 jours tenus » (`enPause` l'emporte sur `reprise`). Hors V1.

**`compter(n: number, singulier: string, pluriel = singulier + 's'): string`** — 0 et 1 au singulier : `compter(0, 'tâche')` → « 0 tâche », `compter(3, 'tâche')` → « 3 tâches », `compter(2, 'pas', 'pas')` → « 2 pas ». Donner le pluriel des mots invariables (`pas`), sinon « pass ».

**`motsAEviter(texte: string): { mot: string; plutot: string }[]`** et **`LEXIQUE`** (`{ motif: RegExp; mot; plutot }[]`). Les mots surveillés : échec, raté, manqué, en retard, perdu, supprimer, il te reste, pourcentage (`\d+\s*%`), point d'exclamation, ne lâche rien. Résultats vérifiés :

| Texte | Détecté |
| --- | --- |
| « Tâche manquée » | `manqué` |
| « En retard de 3 jours » | `en retard` |
| « Série perdue » | `perdu` |
| « Supprimer l'objectif » | `supprimer` |
| « 57 % », « 57% » | `pourcentage` |
| « Bravo ! » | `point d'exclamation` |
| « il te reste 3 pas » | `il te reste` |
| « Ratée » | `raté` |
| **« Échec », « Un échec », « échouer », « raté », « Objectif raté », « manqué », « supprimé »** | **rien** (voir § 8.6) |
| « Erreur », « Une erreur est survenue » | rien : « erreur » n'est pas dans le lexique |

---

## 5. Les classes du kit

### 5.1 Comment les feuilles arrivent dans la page

- Chaque **composant** embarque sa feuille (`ViewEncapsulation.None`, donc globale). Angular l'injecte à la création de la première instance et, comme `REMOVE_STYLES_ON_COMPONENT_DESTROY` vaut `true` par défaut (Angular 22), **la retire quand la dernière instance est détruite** (comptage par contenu de feuille : une feuille identique portée par plusieurs composants reste tant que l'un d'eux vit).
- Les **directives** posées sur un élément natif (`eSurface`, `eCorne`, `eCase`, `eListe`, `eSaisie`, `eOnglets`, `eVues`, `eCoque`, `eNav`, `eCoquePrincipal`, `eCoqueContenu`, `eFilAriane`) confient leur feuille à un « porteur » créé une fois par `ChargeurStyles` et jamais détruit : la feuille reste chargée jusqu'à la fin de l'application, **à partir du premier usage** de la directive.

### 5.2 Les 8 classes typographiques (`typographie.css`, toujours chargées)

| Classe | Police | Taille / interligne | Graisse | Pour |
| --- | --- | --- | --- | --- |
| `.manifeste` | sens | 44 / 52, approche −0,01em | 600 | La phrase de vision, une fois par écran au plus (titres de page des maquettes). |
| `.objectif` | sens | 28 / 36 | 600 | Nom d'un objectif, titre de carte ou de panneau. |
| `.voix` | sens | 20 / 30 | 500 | Phrases d'Akari, le « pourquoi » relu. |
| `.palier` | sens | 56 / 56 | 700 | Chiffre de palier. |
| `.section` | structure | 17 / 24 | 600 | Titre de section, de colonne, de quadrant. |
| `.corps` | structure | 16 / 24 | 400 | Texte courant, intitulés de pas, répliques de la personne. |
| `.detail` | structure | 14 / 20 | 400 | Métadonnées, aides, légendes. |
| `.repere` | structure | 12 / 16, approche 0,08em, **capitales** | 600 | Repères : horizons, axes, « ÉTAPE 3 · EN COURS ». |

Elles ne fixent ni couleur ni marge : un `h1.manifeste` garde les marges du navigateur et la couleur héritée (`encre`). Le texte `encre-douce` des maquettes et la remise à zéro des marges viennent d'Apex : `.ds-muted` et les conteneurs `.ds-*` (Empreinte ne livre aucune classe utilitaire de couleur).

### 5.3 Les classes `e-*` livrées, et qui les pose

Toutes sont réellement présentes dans les feuilles embarquées des paquets installés.

| Famille | Classes | Posées par | Feuille chargée par |
| --- | --- | --- | --- |
| Masque | `e-masque` (visible des seuls lecteurs d'écran) | à la main | `base.css` (toujours) |
| Icône | `e-icone`, `e-icone-hote` | `EIcone` | `EIcone`, `EMenu`, `ESelection`, `EFeuille`, `ELienNav`, porteur navigation |
| Surface | `e-surface`, `e-surface--marquee`, `e-corne`, `e-corne--s`, `e-corne--l`, `e-corne--sans-rabat` | `ESurface`, `ECorne` ; `e-surface` aussi par `ECarte`, `ECarteObjectif`, `EListe` (sauf `nue`), `EMatrice` (quadrants), `EPli` (feuille du pli) ; `e-corne` par `ECarte[marquee]`, `EMatrice` (courant), `EPli` | porteur surface (`ESurface`, `ECorne`), porteur liste (`EListe`), `ECarte`, `ECarteObjectif`, `ECarnet`, `EMatrice` |
| Bouton | `e-btn`, `e-btn--sceau`, `e-btn--trait`, `e-btn--nu`, `e-btn--petit`, `e-btn--icone` | `EBouton` (et les boutons internes d'`ECarteObjectif`, `ETache`, `EMenu`, `EFiltres`, `EFeuille`) | `EBouton` |
| Étiquette | `e-etiquette`, `e-etiquette--ciel`, `--aube`, `--soleil`, `--fjord` | `EEtiquette` | `EEtiquette` |
| Carte | `e-carte`, `e-carte--marquee`, `e-carte__entete`, `e-carte__pied`, `e-carte__meta`, `e-carte__raison` | `ECarte`, `ECarteObjectif` (hôte et gabarit) ; sous-classes à la main dans une carte | `ECarte`, `ECarteObjectif` |
| Pas | `e-progression`, `e-pas`, `e-pas__case` (`data-etat="fait"` / `"en-cours"`), `e-pas__legende` | `EPas` | `EPas` |
| Sceau | `e-sceau`, `e-sceau__repere`, `e-sceau__chiffre`, `e-sceau--grand`, `e-sceau--empreinte`, `e-sceau--pose`, `e-traits`, `e-traits__trait` (`data-etat="a-venir"`), `e-traits--pose`, `e-traits__trait--neuf` | `ESceau`, `EEmpreinte`, `ETraits` | `ESceau`, `EEmpreinte`, `ETraits` |
| Case | `e-case` | `ECase`, `ETache` (case interne) | porteur case (`ECase`), porteur liste, `ETache` |
| Tâche | `e-liste`, `e-tache`, `e-tache--faite`, `e-tache--attend`, `e-tache__texte`, `e-tache__titre`, `e-tache__meta`, `e-tache__actions` | `EListe`, `ETache` | porteur liste (`EListe`), `ETache` |
| Note | `e-note`, `e-note--large`, `e-note__qui`, `e-note__voix`, `e-note__actions` | `ENote`, `ENoteActions` | `ENote` |
| Champ | `e-champ`, `e-champ__libelle`, `e-champ__facultatif`, `e-champ__aide`, `e-champ__message`, `e-saisie`, `e-saisie--taille-auto` | `EChamp`, `ESaisie`, `ETailleAuto` | porteur champ (`ESaisie`), `EChamp` |
| Sélection | `e-selection-hote`, `e-selection`, `e-selection__valeur`, `e-selection__valeur--vide`, `e-selection__chevron`, `e-liste-options`, `e-option` | `ESelection` | `ESelection` |
| Menu | `e-menu-hote`, `e-menu`, `e-menu__element`, `e-menu__element--doux`, `e-menu__separateur` | `EMenu` | `EMenu`, `ESelection` |
| Filtres | `e-filtres`, `e-filtre`, `e-filtre__lumiere`, `--ciel`, `--aube`, `--soleil`, `--fjord` | `EFiltres` | `EFiltres` |
| Onglets | `e-onglets`, `e-onglets__liste`, `e-onglet`, `e-onglets__panneau` | `EOnglets`, `EListeOnglets`, `EOnglet`, `EPanneauOnglet`, `EVues`, `EVue` | porteur onglets (`EOnglets`, `EVues`) |
| Coque | `e-coque`, `e-coque__nav`, `e-coque__principal`, `e-coque__contenu`, `e-nav`, `e-nav__marque`, `e-nav__liste`, `e-nav__lien`, `e-nav__libelle`, `e-nav__bas` | `ECoque`, `ENav`, `ECoquePrincipal`, `ECoqueContenu`, `ENavListe`, `ENavBas`, `ELienNav` ; `e-nav__marque` à la main | porteur navigation, `ELienNav` |
| Marque | `e-marque`, `e-marque__sceau`, `e-marque__nom` | `EMarque` | `EMarque`, porteur navigation |
| Fil d'Ariane | `e-fil-ariane` | `EFilAriane` | porteur navigation |
| Feuille | `e-feuille`, `e-feuille__entete`, `e-feuille__titre`, `e-feuille__titre--manifeste`, `e-feuille__fermer`, `e-feuille__corps`, `e-feuille__actions`, `e-feuille-fond`, `e-feuille-panneau` | `EFeuille`, `EFeuilleActions`, `Feuilles` (fond et panneau CDK) | `EFeuille` |
| Carnet | `e-carnet-cadre`, `e-carnet`, `e-pli`, `e-pli--ouvert`, `e-pli__entete`, `e-pli__dos`, `e-pli__marque`, `e-pli__marque--sceau`, `e-pli__marque--pause`, `e-pli__titre`, `e-pli__date`, `e-pli__contenu`, `e-pli__feuille` | `ECarnet`, `EPli` | `ECarnet` |
| Matrice | `e-matrice-hote`, `e-matrice`, `e-matrice__axe`, `e-matrice__axe--ligne`, `e-matrice__axe--haut`, `e-matrice__axe--bas`, `e-matrice__grille`, `e-quadrant`, `e-quadrant__titre`, `e-quadrant__compte`, `e-quadrant__liste`, `e-quadrant__liste--puces`, `e-quadrant__element`, `e-quadrant__element--arrive` (`e-quadrant--survol` existe mais n'est jamais posée) | `EMatrice` | `EMatrice` |
| Arête | `e-arete-hote`, `e-arete` (et, sous `.e-arete` dans le SVG : `colonne`, `branche`, `branche--faite`, `branche--a-venir`, `borne`, `borne--faite`, `borne--a-venir`, `tete`, `tete-repere`, `tete-texte`, `nom`, `etat`, `etape`, `etape-cible`, `etape--neuve`) | `EArete` | `EArete` |

### 5.4 Quand écrire une classe du kit à la main

Règle : **le composant ou la directive d'abord**. Une classe `e-*` écrite à la main n'est stylée que si sa feuille est chargée (§ 5.1) ; elle peut donc disparaître d'un écran à l'autre. Cas légitimes, tous vérifiés :

| Classe à la main | Où | Pourquoi c'est sûr |
| --- | --- | --- |
| `e-carte__entete`, `e-carte__pied`, `e-carte__meta`, `e-carte__raison` | à l'intérieur d'un `[eCarte]` / `[eCarteObjectif]` | La carte qui les contient porte leur feuille tant qu'elle est affichée. |
| `e-nav__marque` | sur l'`a[eMarque]` placé dans `nav[eNav]` | Feuille du porteur navigation, chargé par `ENav`. |
| `e-masque` | n'importe où (libellé pour lecteurs d'écran, comme le `<label>` de la zone de réponse à Akari) | `base.css`, toujours chargé. Il reste masqué même au focus : un lien d'évitement a besoin d'une classe d'Apex qui le révèle (`.skip-link`, `shell.css`). |

Cas **à ne pas faire**, parce qu'un composant existe ou que la feuille peut manquer :

| Écrit dans la maquette | À écrire dans Apex |
| --- | --- |
| `<span class="e-sceau e-sceau--empreinte" role="img" aria-label="Accompli">` | `<e-empreinte libelle="Accompli" />` (ou `[taille]="24" decorative`) |
| `<div class="e-pas" role="img" …><span class="e-pas__case" …>` + `p.e-pas__legende` | `<e-pas …>` |
| `<button class="e-btn e-btn--trait e-btn--petit">`, `<a class="e-btn e-btn--sceau">` | `button[eBouton]`, `a[eBouton]` |
| `<input class="e-case" type="checkbox">` | `input[type=checkbox][eCase]` |
| `<ul class="e-liste"><li class="e-tache">…` | `ul[eListe] > li[eTache]` |
| `class="e-surface e-corne e-corne--s"` | `eSurface eCorne="s"` |
| `p.e-note__qui` seul (signature d'Akari hors d'une note) | aucun équivalent sûr : la feuille d'`ENote` n'est présente que si une note est affichée (§ 9) |
| `div.e-matrice` écrit à la main | `<e-matrice>` |
| SVG d'arête dessiné à la main | `<e-arete>` |

---

## 6. Les tokens

Noms exacts des variables CSS (`tokens.css`, généré depuis `tokens.json`, « Empreinte v2 »). Constantes TypeScript équivalentes dans `@empreinte-studio/tokens` (`couleurs`, `ombres`, `pas`, `angles`, `cornes`, `traits`, `durees`, `courbes`, `haptique`, `familles`, `typographie`).

### 6.1 Couleurs (Jour : `:root, [data-theme="jour"]` ; Nuit : `[data-theme="nuit"]`)

| Variable | Jour | Nuit | Usage |
| --- | --- | --- | --- |
| `--fond` | `#f5f4f0` | `#0c111b` | Le mur derrière le shoji : fond de page (`body`, `e-coque`). |
| `--panneau` | `#ffffff` | `#151b28` | Surfaces, cartes, feuilles, menus : toujours plus lumineux que le fond. |
| `--creux` | `#ecebe5` | `#1e2534` | Champs, cases vides, survols, rabat de la corne. |
| `--trame` | `#dedbd2` | `#283044` | Filets décoratifs, contours des surfaces, séparateurs. |
| `--trame-forte` | `#7a7f8a` | `#6e7890` | Contours des contrôles (saisie, case), éléments « à venir ». 3:1. |
| `--encre` | `#141b2d` | `#eceff5` | Texte principal, contour marqué, case cochée, anneau de focus. |
| `--encre-douce` | `#555d70` | `#a1a9bb` | Texte secondaire, détails, tâche faite. |
| `--sceau` | `#cc3a1d` | `#ff6a4a` | Engagement : bouton sceau, sceaux, tête d'arête, marque. Jamais une erreur. |
| `--sur-sceau` | `#ffffff` | `#170c09` | Texte et coche posés sur `--sceau`. |
| `--ciel-voile` / `--ciel-vif` | `#ddebfa` / `#1d64b8` | `#13253c` / `#7db8ff` | Lumière d'un domaine : `-voile` en fond, `-vif` pour le texte posé dessus. |
| `--aube-voile` / `--aube-vif` | `#fbe4ec` / `#b23565` | `#3a1a28` / `#ff9bc0` | Idem. |
| `--soleil-voile` / `--soleil-vif` | `#fbefcb` / `#835600` | `#33280c` / `#f2c45a` | Idem ; `--soleil-voile` sert aussi à `::selection`. |
| `--fjord-voile` / `--fjord-vif` | `#d9f0e8` / `#146b54` | `#0f2e27` / `#6fd6b0` | Idem. |

`color-scheme` vaut `light` en Jour, `dark` en Nuit.

### 6.2 Ombre

| Variable | Jour | Nuit | Usage |
| --- | --- | --- | --- |
| `--ombre-feuille` | `0 1px 0 rgba(20, 27, 45, 0.05), 0 18px 36px -18px rgba(20, 27, 45, 0.25)` | `0 18px 36px -14px rgba(0, 0, 0, 0.6)` | La seule ombre : feuilles, menus et listes d'options. Jamais sur une carte. |

### 6.3 Valeurs communes (`:root`)

| Groupe | Variables | Usage |
| --- | --- | --- |
| Pas (grille de 4px) | `--pas-1` 4px, `--pas-2` 8px, `--pas-3` 12px, `--pas-4` 16px, `--pas-6` 24px, `--pas-8` 32px, `--pas-12` 48px, `--pas-16` 64px | `pas-6` dans les cartes, `pas-8` entre sections, `pas-12` autour d'un manifeste, `pas-16` autour d'un moment fort. Il n'y a ni `pas-5`, ni `pas-10`. |
| Angles | `--angle-net` 0px, `--angle-doux` 2px | `angle-net` partout ; `angle-doux` seulement sous 24px (cases, cases de progression). |
| Cornes | `--corne-s` 8px, `--corne-m` 14px, `--corne-l` 24px | `s` boutons et cases, `m` cartes, `l` grands panneaux et sceau de palier. |
| Traits | `--trait-fin` 1px, `--trait-icone` 1.5px, `--trait-net` 2px | Filets ; tracé des icônes ; contours marqués et focus. |
| Déploiement | `--deplier-vite` 160ms, `--deplier` 280ms, `--deplier-lent` 480ms, `--decalage-palier` 70ms | Corne au survol ; panneau, menu, arête ; feuille entière ; traits d'un palier. |
| Courbes | `--courbe-pli` `cubic-bezier(0.2, 0.8, 0.2, 1)`, `--courbe-sceau` `cubic-bezier(0.3, 1.5, 0.5, 1)` | Tout ce qui se déplie ; le rebond du tampon. |
| Haptique | `--haptique-pas` `8`, `--haptique-empreinte` `12 48 20`, `--haptique-palier` `10 70 10 70 30` | Motifs de vibration (lus en TypeScript par `Haptique`). |
| Polices | `--font-sens` `"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", Georgia, serif` ; `--font-structure` `"Schibsted Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif` | `sens` : ce qui a du sens (objectifs, Akari, paliers). `structure` : ce qui organise. Pas d'italique. |

Les composants posent aussi des variables locales (`--e-fond`, `--e-contour`, `--e-trait`, `--e-rabat`, `--e-decoupe`, `--e-c`, `--e-taille`, `--e-largeur`, `--e-hauteur-carnet`) : ce ne sont pas des tokens, on n'y touche pas depuis Apex.

---

## 7. PrimeNG → Empreinte, dans Apex

Inventaire des usages actuels sous `apps/apex-client/src/app` : 24 `<p-button>`, 11 `<p-card>`, 10 `pInputText`, 6 `<p-select>`, 6 `<p-avatar>`, 5 `pTextarea`, 4 `<p-tag>`, 3 `<p-progressbar>`, 3 `<p-dialog>`, 3 `<p-datepicker>`, 3 `<p-checkbox>`, 3 `<p-badge>`, 2 `<p-message>`, 2 `<p-drawer>`, 2 `pButton`, 1 `<p-toolbar>`, 1 `<p-toast>`, 1 `<p-divider>` ; `MessageService` dans 6 stores et `app.ts` ; 21 classes `pi-*` différentes (dont `pi-spin` et `pi-spinner`), y compris celles de `shell.ts` et `stats-card.ts`. Aucun `p-skeleton`.

| PrimeNG (où dans Apex) | Empreinte | Ce qui change |
| --- | --- | --- |
| `<p-button label icon>` (partout) | `<button eBouton type="button">` + `<e-icone>` dans le contenu | Action principale de l'écran → `sceau` (une seule) ; `severity="secondary" variant="text"` (Annuler) → `nu` ; `size="small"` → `petit` ; bouton icône seule → `icone` + `aria-label` ; `severity="danger"` → « Laisser filer » en `nu` ; `[loading]` → pas d'équivalent (désactiver et dire ce qui se passe en texte) ; `fluid` → classe `.ds-*`. Toujours écrire `type`. |
| `a[pButton]` (`shell.html`, `objective-overview.html`) | `a[eBouton]` ; navigation → `a[eLienNav]` ; retour → `nav[eFilAriane]` | `[text]`, `[severity]` disparaissent. |
| `<p-card>` + `#title` (`board`, `objective-overview`, `quadrant`, `focus`, `stats-card`, `auth`) | `article[eCarte]` / `section[eCarte]` / `div[eCarte]`, ou `[eSurface]` | Pas de slot : on écrit le titre (`h2.objectif`, `h3.section`) dans le contenu. `[dt]` (fond teinté) → rien : un panneau est `panneau`, la carte en cours est `marquee`. Carte cliquable `a.ds-link-block > p-card` → lien « Ouvrir » dans le pied. Bulle de chat (`userBubbleTokens`) → pas de bulle. |
| `<p-checkbox [binary] [readonly] (click)>` (`objective-overview`, `quadrant`, `focus`) | `ul[eListe] > li[eTache]` avec `[fait]` + `(faitChange)` ; case isolée : `input[type=checkbox][eCase]` | Le titre devient le `<label>` de la case ; le titre n'est plus barré (`ds-strike` disparaît). |
| `<p-select [options] formControlName appendTo="body">` (`add-task`, `edit-task`) | `<e-selection [options] formControlName>` dans `e-champ` | Options `{ label, value }` → `{ libelle, valeur }`. `appendTo` inutile. `inputId` → le champ relie lui-même ; hors champ, `ariaLabel` → `libelle`. |
| `<p-datepicker [showIcon] [minDate]>` (`create-objective`, `edit-objective`, `edit-sub-objective`) | `<input eSaisie type="date">` dans `e-champ` | Pas de sélecteur de date Empreinte. Le contrôle porte une chaîne `aaaa-mm-jj` (comme `dueDate` du modèle de vue), plus une `Date` ; `[minDate]` → attribut `min`. |
| `<p-dialog header [visible] #footer>` (`create-objective`, `edit-task`, `edit-sub-objective`) | `Feuilles.ouvrir(Composant, { donnees, cdk: { injector } })` + `<e-feuille titre>` + `div[eFeuilleActions]` | Ouverture impérative au lieu de `[visible]` ; résultat par `ref.close(valeur)` / `closed`. Largeurs en tokens → entrée `largeur`. |
| `<p-drawer position="right">` (`edit-objective`, `chat`) | Modifier l'objectif → feuille ; le tiroir de chat → la route `/objectifs/:id/akari` (cahier § 5) | Aucun panneau latéral dans Empreinte. |
| `<p-toast>` + `MessageService.add({ severity, summary, detail })` | `AnnoncesStore` (cahier § 7) : `annoncer(texte)` (CDK `LiveAnnouncer`, rien d'affiché) ; `signaler(texte)` (`aside[eNote]` dans la coque + « Compris ») | Ne jamais afficher `data.error.message` du domaine : ce sont des messages techniques en anglais. Écrire une phrase par code d'erreur, avec la solution. |
| `<p-tag [severity]>` (catégorie Eisenhower, échéance, « Aucune tâche ») | `<e-etiquette>` neutre, ou du texte `detail` | `severity` (rouge, orange, vert) n'a pas d'équivalent : une lumière ne dit jamais un état. Le quadrant se lit dans la matrice ; l'échéance s'écrit « Jusqu'en mai ». |
| `<p-badge [value]>` (compteurs) | du texte : « 4 pas », `compter(n, …)` | Pas de badge. |
| `<p-progressbar [value]>` (`board`, `objective-overview`, `focus`) | `<e-pas>` ou `legendeProgression` | Plus de pourcentage. |
| `<p-avatar icon>` (`board`, `auth`, `create-objective`, `stats-card`, `focus`) | rien, ou une `e-icone` | Pas d'avatar ni de pastille d'icône. Les cartes de statistiques et le Focus sortent de la V1. |
| `<p-message severity="error">` (`auth`) | erreur d'un champ → `e-champ [erreur]` ; erreur de page → `AnnoncesStore.signaler` (`aside[eNote]`) | Écrite en encre, avec la solution. |
| `<p-message severity="info" icon="pi pi-shield">` + Refuser / Autoriser (`chat`) | dans la conversation : la demande d'Akari en `voix` + `trait petit` « Ajouter » et `nu petit` « Pas maintenant » | Cahier § 5. |
| `<p-toolbar>` + `nav.ds-float-bottom` (`shell`) | `[eCoque]` + `nav[eNav]` + `ul[eNavListe]` + `a[eLienNav]` | Structure au § 2.16. |
| `<p-divider>` (`shell`) | rien : les filets viennent des surfaces ou d'une classe `.ds-*` | |
| `<p-skeleton>` | (absent d'Apex) — pas d'équivalent | |
| `pInputText` (`auth`, `create-objective`, `edit-*`, `add-task`, `chat`) | `input[eSaisie]` dans `e-champ libelle` | Libellé toujours visible ; placeholder en `encre-douce`. Zone de réponse d'Akari : `textarea[eSaisie][tailleAuto]` + `button[eBouton=trait][icone]`. |
| `pTextarea` | `textarea[eSaisie]`, `tailleAuto` + `[lignesMin]` / `[lignesMax]` | |
| `<i class="pi pi-spin pi-spinner">` (`chat`) | pas d'équivalent : le statut en texte dans un `role="status"` | |
| `pi pi-*` | `<e-icone nom>` | `pi-plus` → `plus` ; `pi-bullseye`, `pi-home` → `objectifs` ; `pi-th-large` → `matrice` ; `pi-comments`, `pi-sparkles` → `akari` ; `pi-send` → `envoyer` ; `pi-pencil` → `modifier` ; `pi-calendar` → `calendrier` ; `pi-info-circle` → `information` ; `pi-check-circle`, `pi-check-square` → `coche` ou `<e-empreinte>` ; `pi-arrow-left` → `chevron-gauche` (ou le fil d'Ariane) ; `pi-angle-right` → `chevron-droite` ; `pi-sun` → `jour` ; `pi-exclamation-circle`, `pi-shield`, `pi-heart`, `pi-flag` → pas d'icône (une erreur ne porte pas d'alerte ; le « pourquoi » s'écrit en `voix` entre « ») ; `pi-spin` → rien. |
| `pTooltip` | (absent d'Apex) — pas d'infobulle : un texte visible | |

---

## 8. Les pièges

### 8.1 Installation et thème
1. **Nuit = `data-theme` seulement.** `tokens.css` n'a aucune media query : sans `provideEmpreinte` (qui démarre `Theme`) et sans le script d'`index.html`, `'systeme'` ne suit pas l'appareil. Une règle `@media (prefers-color-scheme: dark)` écrite dans Apex se désynchroniserait du thème choisi.
2. Le script d'`index.html` lit la clé `empreinte:theme` : si `cleTheme` change dans `provideEmpreinte`, changer le script.
3. `basculer()` quitte `'systeme'` ; pour revenir à l'appareil, `definir('systeme')`.

### 8.2 Feuilles de style
4. Les feuilles des composants **disparaissent avec leur dernière instance** (§ 5.1) : une classe `e-*` écrite à la main hors des cas du § 5.4 peut fonctionner sur un écran et pas sur un autre.
5. Les classes typographiques ne remettent pas les marges à zéro et ne colorent pas : prévoir un conteneur `.ds-*` (ou une remise à zéro dans la feuille du composant) et `.ds-muted`.

### 8.3 Sceau, corne, lumière
6. Le **`GardienSceau`** compte tout ce qui est affiché en même temps, coque et feuilles comprises : `EBouton` variante `sceau`, chaque `ESceau` (même petit), la tête de chaque `EArete`. Une arête + un bouton sceau, ou une feuille avec un bouton sceau au-dessus d'une arête, déclenchent l'avertissement. Il ne prévient qu'une fois par session (recharger la page pour le revoir) et seulement en développement, tests Vitest compris.
7. `eCorne` sans `eSurface` : ni découpe, ni rabat bien placé. `ECarte` ne prend pas `eCorne` : utiliser `marquee`.
8. `eCorne` pose toujours `aria-current` (`'true'` par défaut) : ne pas la poser pour décorer.

### 8.4 Composants
9. **`li[eTache]`** : cliquer le titre coche le pas (c'est le `<label>`). `eTacheActions` remplace « Replacer » / « Laisser filer » et se place sous le texte. `eTacheMeta` est projeté dans un `<p>` : contenu en ligne seulement.
10. **`[(fait)]` / `[fait]` + `(faitChange)`** : le composant passe à « fait » localement dès le clic. Si le store ne change pas la valeur liée (pas de mise à jour optimiste) puis échoue, la valeur liée reste identique et la case **reste cochée**. Toujours patcher le store tout de suite (optimiste), puis revenir en arrière : le changement de valeur resynchronise la case.
11. **`[attend]` avec une date future** affiche « Pour aujourd'hui » et les actions : ne passer une `Date` que si elle est passée. Les échéances des pas attendent le back-end (cahier § 3).
12. **`e-pas [legende]=""`** masque la légende **et** vide le nom accessible (`role="img"` sans nom). Pour masquer seulement la légende visible, il n'y a pas d'option.
13. **`e-pas`** au-delà de 12 cases : avertissement console, rien n'est coupé.
14. **`ECarteObjectif`** : ordre de rendu figé (en-tête, titre, contenu, pas, pied) ; `accompli` vaut par défaut « objectif accompli » (celui d'`e-pas` : « étape accomplie ») ; le pied rend un `<p>` même si `meta` est vide.
15. **`EEmpreinte [pose]`** ne joue qu'au premier rendu : pour poser une empreinte quand une étape s'achève, faire apparaître l'élément à ce moment-là (`@if`). `ESceau` rejoue quand `palier` augmente.
16. **`EArete`** : `choisir` émet l'objet d'étape, sans identifiant ; noms tronqués à 18 caractères, détails à 22, tête à 2 lignes de 15 caractères (« Courir un / semi-marathon… ») ; au-delà de 8 étapes, les faites se replient en une arête « Faites » synthétique ; la tête est toujours un sceau. Aucune légende n'est dessinée.
17. **`EMatrice`** : `piste` par défaut = identité (la liste est recréée si le store renvoie de nouveaux objets) ; `unite` attend un tuple (`as const` dans la classe, pas de tableau littéral dans le gabarit) ; titres en `h3` figés ; le compte n'écrit que « N unité » ; pas de glisser-déposer au clavier ; `appliquerDeplacement` sans `piste` compare par référence.
18. **`EMenu`** : `icone` est un nom d'icône (chaîne), alors que sur `eBouton` `icone` est un booléen ; désactiver une entrée = `desactive` (masculin), alors que c'est `desactivee` dans `OptionSelection`, `ETache` et `ESelection`, et `desactive` sur `eOnglet`. Le menu ne montre pas l'entrée choisie.
19. **`EFiltres`** : compare par `===` (pas d'objets comme valeurs, sauf même référence) ; `libelleTous` à `null` pour un choix sans « Tous ».
20. **`ESelection`** : pas d'erreur automatique de Signal Forms (passer `[erreur]`) ; dans un `e-champ`, le `<label for>` vise un `div` (cliquer le libellé ne déplie pas la liste) ; `libelle` ne sert que hors champ.
21. **`ESaisie`** : le message automatique n'existe qu'avec `[formField]` (Signal Forms). Avec `formControlName` (formulaires actuels d'Apex), écrire le message et le passer à `e-champ [erreur]`, ou poser `invalide`.
22. **`input[type=date][eSaisie]`** renvoie une chaîne `aaaa-mm-jj`, plus une `Date` comme `p-datepicker`.
23. **`ECase`** fait 20px : une `<label for>` (ou un `<label>` qui l'entoure) donne la cible confortable. `type="checkbox"` doit être statique.
24. **`EBouton`** : pas d'état de chargement ; `aria-disabled="true"` sur un lien ne bloque pas la navigation ; pas de style de focus propre (celui de `base.css`).
25. **`ENote`** : prévue une par écran ; `div[eNote]` porte un `aria-label` sans rôle (préférer `aside` ou `section`).
26. **Feuilles** : le composant ouvert hérite de l'injecteur racine → `cdk: { injector }` pour atteindre `ObjectiveStore` (fourni par la coque). `autoFocus` va sur le titre : le titre est requis. Écraser `panelClass` par `cdk` fait perdre le panneau. Une feuille est centrée (position par défaut du CDK Dialog) ; aucun style de panneau latéral n'existe.
27. **Navigation** : sous 760px, `eNavBas` disparaît (réglages, personne) et les libellés des liens ne sont plus visibles ; pour l'entrée `/`, `[routerLinkActiveOptions]="{ exact: true }"` sinon elle est active partout.
28. **Overlays** (`e-menu`, `e-selection`) : CDK en popover natif ; dans jsdom (Vitest), le CDK repasse en overlay classique (pas de `showPopover`).

### 8.5 Tests
29. En Vitest (mode développement), `GardienSceau`, `e-pas` (> 12) et `e-icone` (nom inconnu) écrivent des `console.warn`.

### 8.6 La voix
30. **`motsAEviter` laisse passer « échec », « Un échec », « échouer », « raté », « Objectif raté », « manqué », « supprimé »** : ses motifs utilisent `\b`, qui ne reconnaît pas une frontière avant ou après une lettre accentuée (vérifié à l'exécution). Il ne connaît pas non plus « erreur » ni les emoji, que le cahier interdit. Le test de voix d'Apex doit ajouter ses propres motifs (avec des frontières Unicode, par exemple `(?<![\p{L}])échec` avec le drapeau `u`), en plus de `motsAEviter()`.
31. **`formaterAttente`** ne sert qu'aux dates passées ; pour un horizon (« Jusqu'en mai »), formater soi-même.
32. **`compter`** met un « s » par défaut : donner le pluriel des mots invariables (`compter(n, 'pas', 'pas')`).

---

## 9. Ce qui manque à la librairie pour les maquettes V1

Relevé en comparant les maquettes `Objectifs`, `Arete`, `Matrice`, `Akari` au code installé. Ce qui relève de la mise en page d'Apex se règle dans Apex (feuille du composant ou utilitaire `.ds-*`) ; ce qui servirait à toute la suite (composant, variante, icône) se propose à Empreinte.

| Maquette | Manque | Contournement possible |
| --- | --- | --- |
| Toutes | Aucune classe utilitaire de couleur (`encre-douce`) ni de remise à zéro des marges | Utilitaires `.ds-*` d'Apex (`.ds-muted`, conteneurs). |
| Toutes (coque) | Pas d'avatar ni d'initiale (bas de navigation « L · Léa ») ; `eNavBas` masqué sous 760px | Initiale en `.initial` (`shell.css`, fond creux de la maquette) ; réglages dans un `e-menu` en `.ds-show-mobile`. À proposer à Empreinte : un composant d'initiale. |
| Toutes | Pas d'indicateur de chargement (bouton, zone), pas d'infobulle, pas de panneau latéral, pas de sélecteur de date | Texte d'état en `role="status"` ; `input[type=date][eSaisie]` ; feuilles centrées. |
| Objectifs | `ECarteObjectif` ne suit pas la maquette (horizon, pourquoi, pas, prochain pas avec case dans le pied) | Composer avec `article[eCarte]` (§ 2.5). Une `li[eTache]` dans le pied garde son padding de ligne (`--pas-4 --pas-6`). |
| Objectifs | Pas de repli générique (`<details>` « Accomplis ») ; `ECarnet` n'est pas un accordéon générique | `details.accomplished` natif (`objectives.css`, fait), ou demande d'ajout à Empreinte. |
| Arête | Rendu d'`EArete` différent de la maquette : bornes carrées au lieu d'empreintes pour les étapes faites, pas d'étiquette encadrée avec corne pour l'étape en cours, pas de légende (Faite / En cours / À venir), troncatures (18 / 22 / 2×15 caractères), `choisir` sans identifiant | Utiliser `EArete` tel quel ; légende avec `<e-empreinte [taille]="20" decorative />` pour « Faite », les deux autres repères demandent une classe dans `objective-page.css` ; passer un nom d'objectif court. |
| Matrice | Compte de quadrant non personnalisable (« Important · urgent · 4 pas aujourd'hui » impossible, seulement « 4 pas ») ; titres `h3` figés | Accepter « N pas ». |
| Matrice | Sous 640px, les axes « Urgent / Pas urgent » restent au-dessus d'une grille passée sur une colonne (la maquette masque les axes) — lu dans la feuille, **non vérifié à l'écran** | À vérifier à 375px ; sinon demande de correction à Empreinte. |
| Matrice | Pas de ligne « case + titre + objectif » sans le padding de `li[eTache]` dans un quadrant | `ul[eListe nue] > li[eTache]` (padding en plus), ou `input[eCase]` + `label` dans une grille `.ds-check` (fait). |
| Akari | Pas de composant « réplique » : `ENote` est une note par écran, signature au-dessus du texte, et `.e-note__qui` (le losange signé « AKARI ») n'est stylé que si une `ENote` est affichée | Soit une `div[eNote]` par réplique d'Akari (contraire à « une note par écran »), soit une demande d'ajout à Empreinte ; les répliques de la personne : `p.repere` + `p.corps` dans `li.reply` (`conversation.css`). |
| Akari (nouvel objectif) | `EArete` n'a pas de variante brouillon : la tête est toujours un sceau, comptée au gardien → avec le bouton `sceau` « Je m'y engage », deux sceaux | Ne pas afficher l'aperçu d'arête dans le brouillon (la maquette le masque déjà sur mobile) et garder la liste numérotée des étapes ; ou demande d'ajout à Empreinte. |
| Akari | Aucun style pour le HTML Markdown rendu (listes, titres, code) | `.ds-prose` sur le conteneur du Markdown, globale : le HTML inséré par `[innerHTML]` n'est pas encapsulé. |
| Voix (toutes) | `motsAEviter` rate les mots accentués et ne connaît pas « erreur » ni les emoji (§ 8.6) | Motifs complémentaires dans le test de voix d'Apex. |
