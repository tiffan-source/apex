#!/usr/bin/env node
/*
 * Contrôle automatique du design system (Empreinte + couche de mise en page d'Apex)
 * ============================================================================
 *
 * Apex ne dessine rien lui-même : l'apparence vient d'Empreinte
 * (@empreinte-studio/angular, @empreinte-studio/tokens), la mise en page des
 * classes .ds-* de libs/design-tokens/src/layout.css. Ce script le garantit :
 *
 *  a. Couche Apex (libs/design-tokens/src) : tokens.css sans couleur, noms
 *     --ds-kebab ; layout.css limité à des sélecteurs qui partent d'une classe
 *     .ds-*, à des valeurs en tokens (Empreinte ou --ds-*), sans !important ni
 *     typographie, sans retoucher l'apparence d'un composant ou d'un élément
 *     (couleur, fond, bordure, ombre) ; media queries annoncées par leur point
 *     de rupture et égales à sa valeur, jamais prefers-color-scheme ; index.ts
 *     aligné sur les points de rupture, sans valeur brute.
 *  b. Contraste : les couples texte / fond promis par le brand book d'Empreinte,
 *     dans les thèmes Jour ET Nuit (protège Apex d'une mise à jour d'Empreinte).
 *  c. Applications (apps/<app>/src) : aucune feuille de style (ni <link>), aucun
 *     style inline ni liaison de style (gabarits, host, @HostBinding, code),
 *     aucune valeur brute, seulement les classes .ds-*, les 8 styles
 *     typographiques et les classes e-* d'Empreinte que l'on peut écrire à la
 *     main (catalogue § 5.4), des directives d'Empreinte bien nommées et posées
 *     sur les éléments qu'elles visent, aucun token inconnu, plus aucune trace
 *     de PrimeNG ; styles.css n'importe qu'Empreinte.
 *  d. Ordre des styles dans apps/<app>/project.json : la couche Apex après
 *     styles.css, qui importe d'abord Empreinte.
 *  e. --unused : classes .ds-* et tokens --ds-* inutilisés.
 *
 * Usage :
 *   node tools/design-system/check.mjs            contrôle complet
 *   node tools/design-system/check.mjs --unused   liste aussi les classes .ds-*
 *                                                 et tokens --ds-* inutilisés
 *   npx nx lint design-tokens                     même contrôle, via Nx (CI)
 *
 * Code de sortie : 1 s'il existe au moins une violation, 0 sinon.
 * Règles détaillées : .claude/skills/frontend-ui et
 * .claude/skills/design-system-evolution. Aucune dépendance : Node seul.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOW_UNUSED = process.argv.includes('--unused');

// La couche de mise en page d'Apex
const DS_DIR = 'libs/design-tokens/src';
const TOKENS = `${DS_DIR}/tokens.css`;
const LAYOUT = `${DS_DIR}/layout.css`;
const INDEX = `${DS_DIR}/index.ts`;
const DS_FILES = new Set([TOKENS, LAYOUT, INDEX]);

// Empreinte, tel qu'installé
const EMPREINTE_TOKENS_DIR = 'node_modules/@empreinte-studio/tokens/dist';
const EMPREINTE_TOKENS = `${EMPREINTE_TOKENS_DIR}/tokens.css`;
const EMPREINTE_TYPO = `${EMPREINTE_TOKENS_DIR}/typographie.css`;
const EMPREINTE_BASE = `${EMPREINTE_TOKENS_DIR}/base.css`;
const EMPREINTE_ANGULAR = 'node_modules/@empreinte-studio/angular/fesm2022';
const EMPREINTE_IMPORT = '@empreinte-studio/tokens/empreinte.css';

// Où chercher de l'aide (cités dans les messages)
const SKILL_UI = '.claude/skills/frontend-ui/SKILL.md';
const SKILL_DS = '.claude/skills/design-system-evolution/SKILL.md';
const CATALOGUE = '.claude/skills/frontend-ui/references/catalogue-empreinte.md';

// Dossiers où aucune feuille de style ne doit apparaître (hors exceptions)
const SOURCE_ROOTS = ['apps', 'libs', 'apex-library', 'worklfows'];
const IGNORED_DIRS = new Set(['node_modules', 'dist', '.angular', '.nx', 'coverage']);

/*
 * Couples texte / fond promis par le brand book d'Empreinte, vérifiés dans
 * les deux thèmes : [texte, fond, ratio minimal].
 */
const LUMIERES = ['ciel', 'aube', 'soleil', 'fjord'];
const SURFACES = ['fond', 'panneau', 'creux'];
const CONTRAST_PAIRS = [
  ...['encre', 'encre-douce'].flatMap((texte) => SURFACES.map((fond) => [texte, fond, 4.5])),
  ['sur-sceau', 'sceau', 4.5],
  ...LUMIERES.flatMap((l) => [
    [`${l}-vif`, `${l}-voile`, 4.5],
    [`${l}-vif`, 'fond', 4.5],
    [`${l}-vif`, 'panneau', 4.5],
    ['encre', `${l}-voile`, 4.5],
  ]),
  ...['trame-forte', 'sceau'].flatMap((trait) => SURFACES.map((fond) => [trait, fond, 3])),
];

// La typographie et la forme appartiennent à Empreinte : layout.css n'y touche pas
const FORBIDDEN_LAYOUT_PROPS = new Set([
  'font',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-variant',
  'line-height',
  'letter-spacing',
  'text-transform',
  'text-decoration',
  'border-radius',
  'clip-path',
  'outline',
  'content',
  'transition',
  'animation',
  'filter',
]);
// Sous une .ds-*, une classe e-* ou un élément ne se règle qu'en mise en page : pas d'apparence
const APPEARANCE_PROPS = /^(?:color|background(?:-[\w-]+)?|border(?:-[\w-]+)?|box-shadow|text-shadow|fill|stroke(?:-[\w-]+)?|opacity|accent-color|caret-color)$/;
// Fonctions permises dans une valeur de layout.css
const LAYOUT_FUNCTIONS = new Set(['var', 'calc', 'min', 'max', 'clamp', 'minmax', 'repeat', 'fit-content']);

const HEX = /(?<![\w&])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/i;
const COLOR_FN = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i;
const LENGTH =
  /(?<![\w.-])-?(?:\d+\.?\d*|\.\d+)(?:px|rem|em|pt|pc|vh|vw|vmin|vmax|dvh|svh|lvh|dvw|svw|lvw|ch|ex|cm|mm)\b/i;
const NAMED_COLORS = new Set(
  (
    'white black red green blue gray grey orange yellow purple pink brown navy maroon olive lime aqua ' +
    'cyan magenta silver gold indigo violet crimson tomato teal coral salmon beige ivory khaki lavender ' +
    'turquoise transparent currentcolor'
  ).split(' '),
);
const VAR_REF = /var\(\s*(--[\w-]+)/g;
const DS_TOKEN_NAME = /^--ds-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DS_CLASS_NAME = /^ds-[a-z0-9]+(?:-[a-z0-9]+)*$/;

/* Ce que PrimeNG devient dans Empreinte (docs/MIGRATION-APEX.md d'Empreinte). */
const PRIMENG_TAGS = {
  'p-button': 'button[eBouton] (sceau, trait ou nu ; petit, icone)',
  'p-card': "article[eCarte], article[eCarteObjectif], ou un panneau .ds-panel dans une trame .ds-panels",
  'p-checkbox': 'input[type=checkbox][eCase], ou li[eTache] dans une liste ul[eListe]',
  'p-inputtext': 'input[eSaisie] dans e-champ',
  'p-textarea': 'textarea[eSaisie][tailleAuto] dans e-champ',
  'p-select': 'e-selection',
  'p-dropdown': 'e-selection',
  'p-tag': 'e-etiquette',
  'p-chip': 'e-etiquette',
  'p-badge': 'un texte en « detail » (pas de badge dans Empreinte)',
  'p-progressbar': 'e-pas (des cases, jamais de pourcentage)',
  'p-dialog': 'Feuilles.ouvrir() et e-feuille',
  'p-confirmdialog': 'Feuilles.ouvrir() et e-feuille',
  'p-drawer': 'une route, ou Feuilles.ouvrir() et e-feuille',
  'p-sidebar': 'eCoque et nav[eNav]',
  'p-menu': 'e-menu',
  'p-tieredmenu': 'e-menu',
  'p-menubar': 'eCoque, nav[eNav] et a[eLienNav]',
  'p-tabs': 'eOnglets, ou nav[eVues] et a[eVue] pour des vues qui sont des routes',
  'p-tabview': 'eOnglets, ou nav[eVues] et a[eVue] pour des vues qui sont des routes',
  'p-selectbutton': 'e-filtres',
  'p-togglebutton': 'e-filtres',
  'p-accordion': 'e-carnet, ou un bouton eBouton="nu" avec aria-expanded',
  'p-breadcrumb': 'nav[eFilAriane]',
  'p-toast': "AnnoncesStore (annoncer / signaler) et aside[eNote] posée dans la page",
  'p-message': 'aside[eNote]',
  'p-avatar': 'une initiale en texte',
  'p-datepicker': 'input[type=date][eSaisie] dans e-champ',
  'p-toolbar': 'une rangée .ds-row ou .ds-actions',
  'p-divider': 'un filet .ds-rule-top',
  'p-panel': 'un panneau .ds-panel',
  'p-skeleton': 'un texte visible',
  'p-floatlabel': 'e-champ (le libellé reste visible)',
  'p-iconfield': 'e-champ',
  'p-inputicon': 'e-champ',
  'p-scrollpanel': 'un bloc .ds-scroll-x',
};
const PRIMENG_ATTRIBUTES = {
  pButton: 'button[eBouton]',
  pInputText: 'input[eSaisie] dans e-champ',
  pTextarea: 'textarea[eSaisie][tailleAuto]',
  pTooltip: 'un texte visible (pas d’infobulle dans Empreinte)',
  pRipple: 'rien : Empreinte ne fait pas d’onde au clic',
  pTemplate: 'le gabarit prévu par le composant Empreinte',
};
const PRIMENG_PACKAGE = /^(?:primeng|primeicons|@primeuix|@primeng)(?:\/|$)/;
const PRIMENG_SYMBOLS = /\b(?:DesignSystemPreset|designSystemThemeOptions|avatarTone|AvatarTone)\b/g;

/* ------------------------------------------------------------------------ */
/* Outils                                                                    */
/* ------------------------------------------------------------------------ */

const violations = [];
const abs = (rel) => join(ROOT, rel);
const read = (rel) => readFileSync(abs(rel), 'utf8');
const lineAt = (text, index) => text.slice(0, Math.max(0, index)).split('\n').length;
const blank = (match) => match.replace(/[^\n]/g, ' ');
const stripCssComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, blank);
const stripHtmlComments = (text) => text.replace(/<!--[\s\S]*?-->/g, blank);

function report(file, text, index, rule, message) {
  violations.push({ file, line: text === null ? 0 : lineAt(text, index), rule, message });
}

function walk(dir, files = []) {
  if (!existsSync(abs(dir))) return files;
  for (const entry of readdirSync(abs(dir))) {
    if (IGNORED_DIRS.has(entry)) continue;
    const rel = `${dir}/${entry}`;
    if (statSync(abs(rel)).isDirectory()) walk(rel, files);
    else files.push(rel);
  }
  return files;
}

/** Index de la parenthèse (ou accolade) fermante qui répond à celle ouverte en `open`. */
function matching(text, open) {
  const pairs = { '(': ')', '{': '}', '[': ']' };
  const close = pairs[text[open]];
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === text[open]) depth++;
    else if (text[i] === close && --depth === 0) return i;
  }
  return text.length;
}

/** Découpe sur un séparateur, hors parenthèses et crochets. */
function splitTopLevel(text, separator) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === separator && depth === 0) {
      parts.push({ text: text.slice(start, i), offset: start });
      start = i + 1;
    }
  }
  parts.push({ text: text.slice(start), offset: start });
  return parts;
}

/* Ce qui, juste avant une barre oblique, en fait le début d'une expression régulière (et non une division). */
const REGEX_AFTER_CHAR = /[(,=:[!&|?{};+\-*%<>~^]/;
const REGEX_AFTER_WORD = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);

/** Fin (exclue) d'une expression régulière littérale qui commence en `start`, ou -1 si ce n'en est pas une. */
function regexEnd(source, start, code) {
  let k = code.length - 1;
  while (k >= 0 && /\s/.test(code[k])) k--;
  if (k >= 0 && !REGEX_AFTER_CHAR.test(code[k])) {
    let w = k;
    while (w >= 0 && /[\w$]/.test(code[w])) w--;
    if (!REGEX_AFTER_WORD.has(code.slice(w + 1, k + 1))) return -1;
  }
  let inClass = false;
  for (let j = start + 1; j < source.length; j++) {
    const ch = source[j];
    if (ch === '\\') j++;
    else if (ch === '\n') return -1;
    else if (inClass) inClass = ch !== ']';
    else if (ch === '[') inClass = true;
    else if (ch === '/') {
      let end = j + 1;
      while (end < source.length && /[a-z]/i.test(source[end])) end++;
      return end;
    }
  }
  return -1;
}

/**
 * Parcourt du TypeScript : code sans commentaires (positions conservées),
 * code « nu » sans commentaires ni contenu de chaînes, et littéraux de chaîne.
 * Les expressions régulières littérales sont reconnues : une apostrophe dans
 * /'/g n'ouvre pas de chaîne (sinon tout le reste du fichier serait mal lu).
 */
function scanTs(source) {
  const strings = [];
  let code = '';
  let bare = '';
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (c === '/' && next !== '/' && next !== '*') {
      const end = regexEnd(source, i, code);
      if (end > 0) {
        code += source.slice(i, end);
        bare += blank(source.slice(i, end));
        i = end;
        continue;
      }
    }
    if (c === '/' && next === '/') {
      const end = source.indexOf('\n', i);
      const stop = end < 0 ? source.length : end;
      code += blank(source.slice(i, stop));
      bare += blank(source.slice(i, stop));
      i = stop;
      continue;
    }
    if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end < 0 ? source.length : end + 2;
      code += blank(source.slice(i, stop));
      bare += blank(source.slice(i, stop));
      i = stop;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < source.length && source[j] !== c) j += source[j] === '\\' ? 2 : 1;
      strings.push({ value: source.slice(i + 1, j), index: i + 1 });
      code += source.slice(i, j + 1);
      bare += c + blank(source.slice(i + 1, j)) + (j < source.length ? c : '');
      i = j + 1;
      continue;
    }
    code += c;
    bare += c;
    i++;
  }
  return { code, bare, strings };
}

/** Valeur brute interdite dans une application : couleur ou longueur écrite en dur. */
function rawValueKind(value) {
  if (HEX.test(value)) return 'couleur hexadécimale';
  if (COLOR_FN.test(value)) return 'fonction de couleur';
  if (LENGTH.test(value)) return 'longueur avec unité';
  if (NAMED_COLORS.has(value.trim().replace(/^'(.*)'$/, '$1').toLowerCase())) return 'couleur nommée';
  return null;
}

/* ------------------------------------------------------------------------ */
/* Empreinte : ce qui existe réellement dans les paquets installés           */
/* ------------------------------------------------------------------------ */

/** Les blocs feuilles d'une feuille CSS (sans commentaires), avec les préludes des @règles qui les entourent. */
function cssLeafBlocks(text) {
  const blocks = [];
  const stack = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      stack.push({ prelude: text.slice(start, i).trim(), open: i, leaf: true });
      if (stack.length > 1) stack[stack.length - 2].leaf = false;
      start = i + 1;
    } else if (text[i] === '}') {
      const top = stack.pop();
      if (top?.leaf)
        blocks.push({
          selector: top.prelude,
          body: text.slice(top.open + 1, i),
          bodyIndex: top.open + 1,
          parents: stack.map((s) => s.prelude),
        });
      start = i + 1;
    }
  }
  return blocks;
}

/**
 * Les directives d'Empreinte qui se posent par attribut (eBouton, eSaisie, tailleAuto…), lues dans
 * les sélecteurs des composants installés : pour chacune, les formes qu'elle accepte
 * ({ tag, attrs: [{ name, value }] }), par exemple button[eBouton] et a[eBouton].
 */
function directiveSelectors(sources) {
  const directives = new Map();
  for (const source of sources) {
    for (const match of source.matchAll(/selector:\s*"([^"]+)"/g)) {
      for (const alternative of match[1].split(',')) {
        const form = alternative.trim().match(/^([a-z][\w-]*)?((?:\[[^\]]+\])+)$/i);
        if (!form) continue;
        const attrs = [...form[2].matchAll(/\[([\w-]+)(?:=([^\]]+))?\]/g)].map((a) => ({ name: a[1], value: a[2] ?? null }));
        const tag = form[1]?.toLowerCase() ?? null;
        const label = `${tag ?? ''}${attrs.map((a) => `[${a.name}${a.value === null ? '' : `=${a.value}`}]`).join('')}`;
        for (const { name } of attrs) {
          if (!/^e[A-Z]/.test(name) && name !== 'tailleAuto') continue;
          if (!directives.has(name)) directives.set(name, []);
          if (!directives.get(name).some((known) => known.label === label)) directives.get(name).push({ tag, attrs, label });
        }
      }
    }
  }
  return directives;
}

function loadEmpreinte() {
  const empreinte = {
    ok: false,
    tokens: new Set(), // toutes les variables --x d'Empreinte
    colors: new Set(), // celles qui sont des couleurs
    themes: { Jour: new Map(), Nuit: new Map() }, // nom → { value, index }
    raw: '',
    classes: new Set(), // classes e-* livrées par les composants et base.css
    typography: new Set(), // les 8 styles typographiques
    directives: new Map(), // directives posées par attribut (eBouton…) → formes acceptées
  };
  for (const file of [EMPREINTE_TOKENS, EMPREINTE_TYPO, EMPREINTE_BASE, EMPREINTE_ANGULAR]) {
    if (!existsSync(abs(file))) {
      report(
        file,
        null,
        0,
        'empreinte-missing',
        `Introuvable : les paquets @empreinte-studio/tokens et @empreinte-studio/angular doivent être installés (npm install) pour vérifier le design system.`,
      );
      return empreinte;
    }
  }

  // Tokens : :root et [data-theme="jour"] (Jour, par défaut), [data-theme="nuit"], puis les valeurs communes.
  // Un bloc qui n'est ni Jour ni Nuit (autre thème, @media prefers-color-scheme: dark…) ne se mêle pas
  // aux valeurs Jour : sinon une mise à jour d'Empreinte fausserait le contrôle du contraste.
  const raw = read(EMPREINTE_TOKENS);
  const text = stripCssComments(raw);
  empreinte.raw = raw;
  for (const block of cssLeafBlocks(text)) {
    const darkMedia = block.parents.some((prelude) => /^@media\b.*prefers-color-scheme\s*:\s*dark/.test(prelude));
    const nuit = darkMedia || /data-theme\s*=\s*["']?nuit/.test(block.selector);
    const jour =
      !nuit &&
      block.parents.length === 0 &&
      splitTopLevel(block.selector, ',').every(({ text: s }) => /^\s*(?::root|html|\[data-theme\s*=\s*["']?jour["']?\])\s*$/.test(s));
    for (const decl of block.body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      const entry = { value: decl[2].trim(), index: block.bodyIndex + decl.index };
      empreinte.tokens.add(decl[1]);
      if (nuit) empreinte.themes.Nuit.set(decl[1], entry);
      else if (jour) empreinte.themes.Jour.set(decl[1], entry);
      if (/^#[0-9a-f]{3,8}$/i.test(entry.value)) empreinte.colors.add(decl[1]);
    }
  }
  // Nuit ne redéfinit que ses couleurs : le reste vient de :root
  empreinte.themes.Nuit = new Map([...empreinte.themes.Jour, ...empreinte.themes.Nuit]);

  for (const match of stripCssComments(read(EMPREINTE_TYPO)).matchAll(/(?:^|\})\s*\.([a-z][\w-]*)\s*\{/g))
    empreinte.typography.add(match[1]);
  for (const match of stripCssComments(read(EMPREINTE_BASE)).matchAll(/\.(e-[\w-]+)/g))
    empreinte.classes.add(match[1]);

  // Classes e-* : celles des feuilles embarquées par les composants (chaînes CSS des fichiers .mjs)
  const sources = readdirSync(abs(EMPREINTE_ANGULAR))
    .filter((f) => f.endsWith('.mjs'))
    .map((f) => read(`${EMPREINTE_ANGULAR}/${f}`));
  for (const source of sources) {
    const { strings } = scanTs(source);
    for (const { value } of strings) {
      if (!/\{[^{}]*:[^{}]*\}/.test(value)) continue; // pas une feuille de style
      for (const match of value.matchAll(/\.(e-[a-z0-9_-]+)/gi)) empreinte.classes.add(match[1]);
    }
  }
  empreinte.directives = directiveSelectors(sources);
  empreinte.ok = true;
  return empreinte;
}

/* --- b. Contraste ----------------------------------------------------------- */

function parseHex(value) {
  const hex = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!hex) return null;
  const digits = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
  return [0, 2, 4].map((offset) => parseInt(digits.slice(offset, offset + 2), 16));
}

function luminance(rgb) {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

function checkContrast(empreinte) {
  for (const [theme, map] of Object.entries(empreinte.themes)) {
    for (const [fgName, bgName, minimum] of CONTRAST_PAIRS) {
      const fg = map.get(`--${fgName}`);
      const bg = map.get(`--${bgName}`);
      if (!fg || !bg) {
        report(
          EMPREINTE_TOKENS,
          empreinte.raw,
          0,
          'contrast',
          `Thème ${theme} : --${fgName} ou --${bgName} a disparu d'Empreinte. Le brand book promet ce couple : vérifier la mise à jour d'Empreinte avant de l'adopter.`,
        );
        continue;
      }
      const fgColor = parseHex(fg.value);
      const bgColor = parseHex(bg.value);
      if (!fgColor || !bgColor) {
        report(
          EMPREINTE_TOKENS,
          empreinte.raw,
          fg.index,
          'contrast',
          `Thème ${theme} : impossible de lire --${fgName} (${fg.value}) ou --${bgName} (${bg.value}) en #hex.`,
        );
        continue;
      }
      const ratio = contrast(fgColor, bgColor);
      if (ratio < minimum) {
        report(
          EMPREINTE_TOKENS,
          empreinte.raw,
          fg.index,
          'contrast',
          `Thème ${theme} : --${fgName} sur --${bgName} = ${ratio.toFixed(2)}:1, sous les ${minimum}:1 promis par le brand book. Ne pas adopter cette version d'Empreinte : signaler le problème au design system.`,
        );
      }
    }
  }
}

/* ------------------------------------------------------------------------ */
/* a. La couche Apex                                                          */
/* ------------------------------------------------------------------------ */

/** Lit un fichier CSS en règles { selector, body, media }, @media compris. */
function parseCss(file, text) {
  const rules = [];
  const atRules = [];
  const visit = (start, end, media) => {
    let cursor = start;
    while (cursor < end) {
      const open = text.indexOf('{', cursor);
      const stray = text.indexOf('}', cursor);
      if (open < 0 || open >= end) {
        if (text.slice(cursor, end).trim() && (stray < 0 || stray >= end)) {
          report(file, text, cursor, 'css-syntax', `Texte hors de toute règle : « ${text.slice(cursor, end).trim().slice(0, 60)} ».`);
        }
        return;
      }
      const prelude = text.slice(cursor, open);
      const preludeIndex = cursor + prelude.search(/\S|$/);
      const close = matching(text, open);
      if (prelude.trim().startsWith('@')) {
        atRules.push({ prelude: prelude.trim(), index: preludeIndex, media });
        if (/^@media\b/.test(prelude.trim())) visit(open + 1, close, { prelude: prelude.trim(), index: preludeIndex });
      } else {
        const body = text.slice(open + 1, close);
        if (body.includes('{')) report(file, text, open, 'css-syntax', `Règles imbriquées : à écrire à plat.`);
        rules.push({ selector: prelude.trim(), index: preludeIndex, body, bodyIndex: open + 1, media });
      }
      cursor = close + 1;
    }
  };
  visit(0, text.length, null);
  return { rules, atRules };
}

/** Déclarations d'un corps de règle, avec leur position. */
function declarations(rule) {
  return splitTopLevel(rule.body, ';')
    .filter((part) => part.text.includes(':'))
    .map((part) => {
      const colon = part.text.indexOf(':');
      return {
        // Une propriété CSS se compare en minuscules ; une variable garde sa casse (--ds-… est sensible)
        property: part.text.slice(0, colon).trim().replace(/^(?!--).*$/, (name) => name.toLowerCase()),
        value: part.text.slice(colon + 1).trim(),
        index: rule.bodyIndex + part.offset + part.text.search(/\S/),
      };
    });
}

/** tokens.css : uniquement des tokens --ds-* de mise en page, sous :root, sans couleur. */
function checkTokens(empreinte) {
  const raw = read(TOKENS);
  const text = stripCssComments(raw);
  const { rules, atRules } = parseCss(TOKENS, text);
  const tokens = new Map(); // nom → { value, index }

  for (const at of atRules)
    report(TOKENS, text, at.index, 'tokens-structure', `${at.prelude.split(/\s/)[0]} interdit ici : tokens.css ne contient que des tokens sous :root.`);

  for (const rule of rules) {
    if (rule.selector !== ':root')
      report(TOKENS, text, rule.index, 'tokens-structure', `Sélecteur « ${rule.selector} » : tokens.css ne déclare des tokens que sous :root.`);
    for (const decl of declarations(rule)) {
      const name = decl.property;
      if (!name.startsWith('--')) {
        report(TOKENS, text, decl.index, 'tokens-structure', `« ${name} » : tokens.css ne contient que des tokens --ds-*, aucune propriété CSS.`);
        continue;
      }
      if (!DS_TOKEN_NAME.test(name))
        report(TOKENS, text, decl.index, 'token-name', `${name} : nom invalide (attendu --ds-<kebab-case>, en anglais).`);
      if (tokens.has(name)) report(TOKENS, text, decl.index, 'token-duplicate', `${name} est déclaré deux fois.`);
      tokens.set(name, { value: decl.value, index: decl.index });

      const kind = HEX.test(decl.value)
        ? 'couleur hexadécimale'
        : COLOR_FN.test(decl.value)
          ? 'fonction de couleur'
          : decl.value.split(/[\s,()]+/).some((word) => NAMED_COLORS.has(word.toLowerCase()))
            ? 'couleur nommée'
            : null;
      if (kind)
        report(TOKENS, text, decl.index, 'tokens-color', `${name} : ${kind}. Aucune couleur dans la couche Apex : les couleurs viennent d'Empreinte (var(--encre), var(--panneau)…).`);
      if (/!important/i.test(decl.value)) report(TOKENS, text, decl.index, 'important', `${name} : !important interdit.`);
      for (const ref of decl.value.matchAll(VAR_REF)) {
        if (empreinte.colors.has(ref[1]))
          report(TOKENS, text, decl.index, 'tokens-color', `${name} référence la couleur ${ref[1]} : pas d'alias de couleur, utilise var(${ref[1]}) directement là où il le faut.`);
      }
    }
  }

  // Points de rupture : des pixels, pour pouvoir être recopiés dans @media
  const breakpoints = new Map();
  for (const [name, { value, index }] of tokens) {
    if (!name.startsWith('--ds-breakpoint-')) continue;
    if (!/^\d+px$/.test(value))
      report(TOKENS, text, index, 'breakpoint', `${name} : un point de rupture s'écrit en px entiers (il est recopié dans @media).`);
    breakpoints.set(name, value);
  }
  return { raw, text, tokens, breakpoints };
}

/** Les sélecteurs simples d'un sélecteur composé (.a.b:not(.c)[x]). */
function simpleSelectors(compound) {
  const parts = [];
  let i = 0;
  while (i < compound.length) {
    const rest = compound.slice(i);
    let m;
    if ((m = /^\.([\w-]+)/.exec(rest))) parts.push({ type: 'class', name: m[1] });
    else if ((m = /^#([\w-]+)/.exec(rest))) parts.push({ type: 'id', name: m[1] });
    else if (rest[0] === '[') m = [compound.slice(i, matching(compound, i) + 1)], parts.push({ type: 'attribute' });
    else if ((m = /^(::?)([\w-]+)/.exec(rest))) {
      let arg = null;
      let length = m[0].length;
      if (compound[i + length] === '(') {
        const close = matching(compound, i + length);
        arg = compound.slice(i + length + 1, close);
        length = close + 1 - i;
      }
      parts.push({ type: m[1] === '::' ? 'pseudo-element' : 'pseudo', name: m[2].toLowerCase(), arg });
      m = [compound.slice(i, i + length)];
    } else if (rest[0] === '*') (m = ['*']), parts.push({ type: 'universal' });
    else if ((m = /^[a-zA-Z][\w-]*/.exec(rest))) parts.push({ type: 'element', name: m[0].toLowerCase() });
    else m = [rest[0]];
    i += m[0].length;
  }
  return parts;
}

/** Les sélecteurs composés d'un sélecteur complexe, séparés par leurs combinateurs. */
function compounds(selector) {
  const list = [];
  let depth = 0;
  let current = '';
  for (const c of selector.trim()) {
    if (c === '(' || c === '[') depth++;
    if (c === ')' || c === ']') depth--;
    if (depth === 0 && /[\s>+~]/.test(c)) {
      if (current) list.push(current);
      current = '';
      continue;
    }
    current += c;
  }
  if (current) list.push(current);
  return list;
}

/** layout.css : classes .ds-* de mise en page, construites sur des tokens. */
function checkLayout(empreinte, apexTokens) {
  const raw = read(LAYOUT);
  const text = stripCssComments(raw);
  const { rules, atRules } = parseCss(LAYOUT, text);
  const classes = new Set();
  const locals = new Set();
  const references = [];
  const citedBreakpoints = new Set();

  // Premier passage : les classes .ds-* définies et les variables locales --ds-*
  for (const rule of rules) {
    for (const match of rule.selector.matchAll(/\.(ds-[\w-]+)/g)) classes.add(match[1]);
    for (const decl of declarations(rule)) if (decl.property.startsWith('--')) locals.add(decl.property);
  }
  const known = (name) => empreinte.tokens.has(name) || apexTokens.tokens.has(name) || locals.has(name);

  const checkClass = (name, index, selector) => {
    if (name.startsWith('ds-')) {
      if (!DS_CLASS_NAME.test(name))
        report(LAYOUT, text, index, 'layout-selector', `.${name} : nom invalide (attendu .ds-<kebab-case>, en anglais).`);
    } else if (name.startsWith('e-')) {
      if (empreinte.ok && !empreinte.classes.has(name))
        report(LAYOUT, text, index, 'layout-selector', `« ${selector} » : .${name} n'est pas une classe livrée par Empreinte.`);
    } else {
      report(LAYOUT, text, index, 'layout-selector', `« ${selector} » : .${name} interdite. Seules les classes .ds-* (et, sous une .ds-*, les classes e-* d'Empreinte) sont permises.`);
    }
  };

  /** Le sujet de tête doit être une classe .ds-* (seule, ou dans :where()/:is()). */
  const leadIsDs = (compound, index, selector) => {
    let hasDs = false;
    for (const part of simpleSelectors(compound)) {
      if (part.type === 'class') {
        if (part.name.startsWith('ds-')) hasDs = true;
        else if (part.name.startsWith('e-'))
          report(LAYOUT, text, index, 'layout-selector', `« ${selector} » : une classe e-* ou un élément ne se cible que SOUS une classe .ds-* (ex. « .ds-panel .e-tache »).`);
        checkClass(part.name, index, selector);
      } else if (part.type === 'pseudo' && (part.name === 'where' || part.name === 'is')) {
        const inner = splitTopLevel(part.arg ?? '', ',');
        if (inner.every((p) => compounds(p.text).length === 1 && leadIsDs(p.text.trim(), index, selector))) hasDs = true;
      } else if (part.type === 'pseudo' && (part.name === 'not' || part.name === 'has')) {
        for (const match of (part.arg ?? '').matchAll(/\.([\w-]+)/g)) checkClass(match[1], index, selector);
      } else if (part.type === 'element' || part.type === 'universal' || part.type === 'id') {
        report(LAYOUT, text, index, 'layout-selector', `« ${selector} » : toute règle part d'une classe .ds-* ; un élément ne se cible que sous elle.`);
      } else if (part.type === 'pseudo-element') {
        report(LAYOUT, text, index, 'layout-selector', `« ${selector} » : pas de pseudo-élément (::${part.name}) : la couche Apex ne génère aucun décor.`);
      }
    }
    return hasDs;
  };

  /** Le sujet du sélecteur (dernier composé) est-il un composant d'Empreinte (e-*) ou un élément ? */
  const foreignSubject = (selector) => {
    const parts = compounds(selector);
    return simpleSelectors(parts[parts.length - 1] ?? '').some(
      (part) =>
        (part.type === 'class' && part.name.startsWith('e-')) ||
        part.type === 'element' ||
        (part.type === 'pseudo' && (part.name === 'where' || part.name === 'is') && /\.e-|(?:^|[\s,(>+~])[a-z]/i.test(part.arg ?? '')),
    );
  };

  for (const rule of rules) {
    const foreign = splitTopLevel(rule.selector, ',').find(({ text: selector }) => foreignSubject(selector))?.text.trim();
    for (const { text: selector } of splitTopLevel(rule.selector, ',')) {
      const parts = compounds(selector);
      if (!parts.length) continue;
      const before = violations.length;
      // Message générique seulement si le sujet de tête n'a pas déjà été signalé plus précisément
      if (!leadIsDs(parts[0], rule.index, selector.trim()) && violations.length === before)
        report(LAYOUT, text, rule.index, 'layout-selector', `« ${selector.trim()} » : toute règle doit partir d'une classe .ds-*.`);
      for (const compound of parts.slice(1)) {
        for (const part of simpleSelectors(compound)) {
          if (part.type === 'class') checkClass(part.name, rule.index, selector.trim());
          else if (part.type === 'id') report(LAYOUT, text, rule.index, 'layout-selector', `« ${selector.trim()} » : pas de sélecteur d'identifiant.`);
          else if (part.type === 'pseudo-element')
            report(LAYOUT, text, rule.index, 'layout-selector', `« ${selector.trim()} » : pas de pseudo-élément (::${part.name}) : la couche Apex ne génère aucun décor.`);
          else if (part.type === 'pseudo' && part.arg) for (const match of part.arg.matchAll(/\.([\w-]+)/g)) checkClass(match[1], rule.index, selector.trim());
        }
      }
    }

    for (const decl of declarations(rule)) {
      const where = `« ${decl.property}: ${decl.value} »`;
      if (decl.property.startsWith('--')) {
        if (!DS_TOKEN_NAME.test(decl.property))
          report(LAYOUT, text, decl.index, 'token-name', `${decl.property} : une variable locale s'appelle --ds-<kebab-case>.`);
      } else if (FORBIDDEN_LAYOUT_PROPS.has(decl.property)) {
        report(LAYOUT, text, decl.index, 'layout-property', `${where} : la typographie, les formes et le mouvement viennent d'Empreinte (8 styles typographiques, composants). layout.css ne fait que de la mise en page.`);
      } else if (foreign && APPEARANCE_PROPS.test(decl.property)) {
        report(LAYOUT, text, decl.index, 'layout-property', `${where} sur « ${foreign} » : la couche ne retouche pas l'apparence d'un composant d'Empreinte ni d'un élément (couleur, fond, bordure, ombre…), seulement sa place. Une apparence à changer se change dans Empreinte, en amont.`);
      }
      if (/!important/i.test(decl.value)) report(LAYOUT, text, decl.index, 'important', `${where} : !important interdit.`);
      for (const ref of decl.value.matchAll(VAR_REF)) {
        references.push(ref[1]);
        if (!known(ref[1]))
          report(LAYOUT, text, decl.index, 'unknown-token', `${where} : ${ref[1]} n'existe ni dans Empreinte ni dans ${TOKENS}.`);
      }
      // Ce qui reste une fois les var(--…) retirées : nombres, %, fr, mots-clés, fonctions de calcul
      const rest = decl.value.replace(/var\(\s*--[\w-]+\s*/g, 'var(');
      for (const fn of rest.matchAll(/([a-z-]+)\(/gi)) {
        if (!LAYOUT_FUNCTIONS.has(fn[1].toLowerCase()))
          report(LAYOUT, text, decl.index, 'layout-raw-value', `${where} : fonction ${fn[1]}() interdite (permises : ${[...LAYOUT_FUNCTIONS].join(', ')}).`);
      }
      if (HEX.test(rest)) report(LAYOUT, text, decl.index, 'layout-raw-value', `${where} : couleur en dur. Les couleurs viennent d'Empreinte : var(--encre-douce), var(--trame)…`);
      for (const word of rest.split(/[\s,()/*+]+/)) {
        if (NAMED_COLORS.has(word.toLowerCase()))
          report(LAYOUT, text, decl.index, 'layout-raw-value', `${where} : couleur nommée « ${word} ». Les couleurs viennent d'Empreinte.`);
      }
      for (const number of rest.matchAll(/(?<![\w.-])-?(?:\d+\.?\d*|\.\d+)([a-z%]*)/gi)) {
        const unit = number[1].toLowerCase();
        if (unit && unit !== '%' && unit !== 'fr')
          report(LAYOUT, text, decl.index, 'layout-raw-value', `${where} : longueur brute « ${number[0]} ». Utilise un pas d'Empreinte (var(--pas-4)), un trait (var(--trait-fin)) ou un token var(--ds-*) de ${TOKENS}.`);
      }
    }
  }

  // At-rules : seulement @media, annoncées par le commentaire de leur point de rupture
  for (const at of atRules) {
    if (!/^@media\b/.test(at.prelude)) {
      report(LAYOUT, text, at.index, 'layout-at-rule', `${at.prelude.split(/\s/)[0]} interdit dans layout.css : seules les media queries y ont leur place.`);
      continue;
    }
    if (/prefers-color-scheme/.test(at.prelude)) {
      report(LAYOUT, text, at.index, 'layout-at-rule', `« ${at.prelude} » : le thème Nuit passe par [data-theme="nuit"] (service Theme d'Empreinte), pas par prefers-color-scheme, qui se désynchroniserait du choix de la personne. Et la couche n'a pas de couleur propre.`);
      continue;
    }
    const lengths = [...at.prelude.matchAll(/(\d+(?:\.\d+)?)([a-z]+)/gi)];
    if (!lengths.length) continue;
    const before = raw.slice(0, at.index).trimEnd().split('\n').pop() ?? '';
    const named = before.match(/--ds-breakpoint-[\w-]+/);
    if (!named) {
      report(LAYOUT, text, at.index, 'media-comment', `« ${at.prelude} » : ajoute juste au-dessus le commentaire /* --ds-breakpoint-xx */ du point de rupture utilisé.`);
      continue;
    }
    citedBreakpoints.add(named[0]);
    const expected = apexTokens.breakpoints.get(named[0]);
    for (const length of lengths) {
      if (`${length[1]}${length[2]}` !== expected)
        report(LAYOUT, text, at.index, 'media-breakpoint', `« ${at.prelude} » : ${length[0]} ne vaut pas ${named[0]} (${expected ?? 'inexistant'}).`);
    }
  }

  return { text, classes, locals, references, citedBreakpoints };
}

/** index.ts : un module TypeScript sans PrimeNG, dont les points de rupture suivent tokens.css. */
function checkIndex(apexTokens) {
  const exported = new Set();
  if (!existsSync(abs(INDEX))) {
    report(INDEX, null, 0, 'ds-index', `${INDEX} est le point d'entrée de l'alias @org/design-tokens : il doit exister.`);
    return exported;
  }
  const source = read(INDEX);
  const scan = scanTs(source);
  checkPrimeNgTs(INDEX, source, scan);
  // Pas de couleur ni de longueur écrite en dur : les requêtes média se construisent sur DS_BREAKPOINTS
  for (const { value, index } of scan.strings) {
    const kind = rawValueKind(value);
    if (kind) report(INDEX, source, index, 'ds-index', `« ${value} » : ${kind} interdite dans index.ts. Les couleurs viennent d'Empreinte ; les longueurs se construisent sur DS_BREAKPOINTS.`);
  }
  const block = source.match(/DS_BREAKPOINTS\s*=\s*\{([^}]*)\}/);
  if (!block) return exported;
  const blockIndex = block.index;
  for (const entry of block[1].matchAll(/([\w]+)\s*:\s*(\d+)/g)) {
    const token = `--ds-breakpoint-${entry[1]}`;
    exported.add(token);
    const expected = apexTokens.breakpoints.get(token);
    if (expected !== `${entry[2]}px`)
      report(INDEX, source, blockIndex, 'breakpoint', `DS_BREAKPOINTS.${entry[1]} = ${entry[2]} ne correspond pas à ${token} (${expected ?? 'inexistant'}) dans ${TOKENS}.`);
  }
  for (const token of apexTokens.breakpoints.keys()) {
    if (!exported.has(token))
      report(INDEX, source, blockIndex, 'breakpoint', `${token} manque dans DS_BREAKPOINTS : index.ts doit exporter tous les points de rupture de ${TOKENS}.`);
  }
  return exported;
}

/* ------------------------------------------------------------------------ */
/* c. Applications                                                           */
/* ------------------------------------------------------------------------ */

function primeNgImportMessage(specifier, statement) {
  if (/\b(?:MessageService|ConfirmationService)\b/.test(statement))
    return `Import de « ${specifier} » (${statement.match(/\b(?:MessageService|ConfirmationService)\b/)[0]}) : PrimeNG est retiré. Les toasts deviennent AnnoncesStore (annoncer / signaler, apps/apex-client/src/chore/stores/annonces.store.ts), les confirmations une feuille (Feuilles.ouvrir()).`;
  if (/\bDialogService\b/.test(statement)) return `Import de « ${specifier} » (DialogService) : PrimeNG est retiré. Utilise Feuilles.ouvrir() et e-feuille d'Empreinte.`;
  return `Import de « ${specifier} » : PrimeNG est retiré. Utilise le composant Empreinte correspondant (@empreinte-studio/angular, catalogue : ${CATALOGUE}).`;
}

/** Les traces de PrimeNG dans du TypeScript (imports, fournisseurs, preset). */
function checkPrimeNgTs(file, source, { code, bare }) {
  for (const match of code.matchAll(/\b(?:import|export)\b([^;]*?)\bfrom\s*(['"])([^'"]+)\2|\bimport\s*\(?\s*(['"])([^'"]+)\4/g)) {
    const specifier = match[3] ?? match[5];
    if (PRIMENG_PACKAGE.test(specifier)) report(file, source, match.index, 'primeng', primeNgImportMessage(specifier, match[0]));
  }
  for (const match of bare.matchAll(/\bprovidePrimeNG\s*\(/g))
    report(file, source, match.index, 'primeng', `providePrimeNG : PrimeNG est retiré. Le thème passe par provideEmpreinte({ theme: 'jour' }) de @empreinte-studio/angular.`);
  for (const match of bare.matchAll(/\bdefinePreset\s*\(/g))
    report(file, source, match.index, 'primeng', `definePreset : plus de preset de thème. L'apparence vient des composants Empreinte.`);
  for (const match of bare.matchAll(PRIMENG_SYMBOLS))
    report(file, source, match.index, 'primeng', `${match[0]} n'existe plus dans @org/design-tokens (preset PrimeNG supprimé) : l'apparence vient des composants Empreinte.`);
}

/*
 * Les classes e-* que l'application peut écrire à la main (catalogue § 5.4) : toutes les autres sont
 * posées par un composant ou une directive, et ne sont stylées que si sa feuille est chargée.
 */
const HAND_WRITTEN_KIT_CLASSES = new Set([
  'e-masque',
  'e-nav__marque',
  'e-carte__entete',
  'e-carte__pied',
  'e-carte__meta',
  'e-carte__raison',
]);
/** Le composant ou la directive qui pose une classe du kit, par préfixe (le premier qui convient). */
const KIT_OWNERS = [
  [/^e-btn/, 'button[eBouton] ou a[eBouton] (variantes sceau, trait, nu ; entrées petit, icone)'],
  [/^e-sceau--empreinte/, '<e-empreinte> (entrées taille, libelle, decorative)'],
  [/^e-sceau/, '<e-sceau>'],
  [/^e-traits/, '<e-traits>'],
  [/^e-(?:pas|progression)/, '<e-pas>'],
  [/^e-case$/, 'input[type=checkbox][eCase]'],
  [/^e-liste$/, 'ul[eListe] (entrée nue)'],
  [/^e-tache/, 'li[eTache] dans ul[eListe]'],
  [/^e-(?:surface|corne)/, 'les directives eSurface et eCorne (ou l’entrée marquee d’une carte)'],
  [/^e-carte/, 'article[eCarte] ou [eCarteObjectif] (entrée marquee)'],
  [/^e-note/, 'aside[eNote] (signature : entrées qui et contexte ; une note par réplique d’Akari, skill frontend-ui § 7)'],
  [/^e-(?:champ|saisie)/, 'e-champ, input[eSaisie] ou textarea[eSaisie][tailleAuto]'],
  [/^e-(?:selection|option|liste-options)/, '<e-selection>'],
  [/^e-menu/, '<e-menu>'],
  [/^e-filtre/, '<e-filtres>'],
  [/^e-onglet/, '[eOnglets], [eListeOnglets], [eOnglet], [ePanneauOnglet] (ou nav[eVues] et a[eVue])'],
  [/^e-(?:coque|nav)/, '[eCoque], nav[eNav], ul[eNavListe], a[eLienNav], [eNavBas], [eCoquePrincipal], [eCoqueContenu]'],
  [/^e-marque/, 'a[eMarque] ou <e-marque>'],
  [/^e-fil-ariane/, 'nav[eFilAriane]'],
  [/^e-feuille/, 'Feuilles.ouvrir() et <e-feuille>'],
  [/^e-(?:carnet|pli)/, '<e-carnet> et li[ePli]'],
  [/^e-(?:matrice|quadrant)/, '<e-matrice>'],
  [/^e-arete/, '<e-arete>'],
  [/^e-etiquette/, '<e-etiquette> (entrée lumiere)'],
  [/^e-icone/, '<e-icone nom="…">'],
];

function classMessage(name, layoutClasses, empreinte) {
  if (/^pi(?:-[\w-]+)?$/.test(name))
    return ['primeng', `Icône PrimeNG « ${name} » : utilise <e-icone nom="…" /> d'Empreinte (jeu runique, ICONES_EMPREINTE).`];
  if (/^p-[\w-]+$/.test(name)) return ['primeng', `Classe PrimeNG « ${name} » : PrimeNG est retiré, utilise le composant Empreinte correspondant (catalogue : ${CATALOGUE}).`];
  if (name.startsWith('ds-'))
    return layoutClasses.has(name) ? null : ['unknown-class', `Classe « ${name} » inexistante dans ${LAYOUT}. Vérifie le nom, ou propose l'ajout d'une classe (skill design-system-evolution).`];
  if (name.startsWith('e-')) {
    if (!empreinte.ok) return null;
    if (!empreinte.classes.has(name))
      return ['unknown-class', `Classe « ${name} » : Empreinte ne la livre pas. Pose le composant (button[eBouton], li[eTache]…), qui met ses classes lui-même.`];
    if (HAND_WRITTEN_KIT_CLASSES.has(name)) return null;
    const owner = KIT_OWNERS.find(([prefix]) => prefix.test(name))?.[1] ?? `le composant Empreinte qui la pose (catalogue § 5.3)`;
    return [
      'kit-class',
      `Classe « ${name} » écrite à la main : elle appartient à ${owner}, qui la pose lui-même ; à la main, elle n'est stylée que si ce composant est affiché ailleurs sur la page. Pose le composant. Seules ${[...HAND_WRITTEN_KIT_CLASSES].join(', ')} s'écrivent à la main (catalogue § 5.4).`,
    ];
  }
  if (empreinte.typography.has(name)) return null;
  return [
    'unknown-class',
    `Classe « ${name} » interdite : seules les classes .ds-* de ${LAYOUT}, les classes e-* d'Empreinte et les styles typographiques (${[...empreinte.typography].join(', ')}) sont permis. Pour la mise en page, voir le skill frontend-ui.`,
  ];
}

function checkClassList(file, source, index, value, context) {
  const { layoutClasses, empreinte, usedClasses } = context;
  if (/\{\{|\}\}|\$\{/.test(value)) {
    report(file, source, index, 'dynamic-class', `class="${value.trim()}" : classe interpolée interdite. Utilise [class.ds-…]="condition" ou l'entrée du composant Empreinte.`);
    return;
  }
  for (const name of value.split(/\s+/).filter(Boolean)) {
    if (name.startsWith('ds-')) usedClasses.add(name);
    const problem = classMessage(name, layoutClasses, empreinte);
    if (problem) report(file, source, index, problem[0], problem[1]);
  }
}

/** Parcourt les balises ouvrantes d'un gabarit Angular. */
function* startTags(text, start, end) {
  const tagPattern = /<([a-zA-Z][\w-]*)/g;
  tagPattern.lastIndex = start;
  let match;
  while ((match = tagPattern.exec(text)) && match.index < end) {
    let i = match.index + match[0].length;
    const attributes = [];
    while (i < end) {
      while (i < end && /\s/.test(text[i])) i++;
      if (text[i] === '>') {
        i++;
        break;
      }
      if (text[i] === '/' && text[i + 1] === '>') {
        i += 2;
        break;
      }
      const name = /^[^\s"'>/=]+/.exec(text.slice(i, i + 300))?.[0];
      if (!name) {
        i++;
        continue;
      }
      const nameIndex = i;
      i += name.length;
      while (i < end && /\s/.test(text[i])) i++;
      let value = null;
      if (text[i] === '=') {
        i++;
        while (i < end && /\s/.test(text[i])) i++;
        const quote = text[i];
        if (quote === '"' || quote === "'") {
          const close = text.indexOf(quote, i + 1);
          const stop = close < 0 || close > end ? end : close;
          value = text.slice(i + 1, stop);
          i = stop + 1;
        } else {
          value = /^[^\s>]*/.exec(text.slice(i, i + 300))[0];
          i += value.length;
        }
      }
      attributes.push({ name, value, index: nameIndex });
    }
    yield { tag: match[1].toLowerCase(), index: match.index, attributes };
    tagPattern.lastIndex = i;
  }
}

/** Forme canonique d'un nom d'attribut : bind-x → [x], on-x → (x), bindon-x → [(x)]. */
function canonicalAttribute(name) {
  if (name.startsWith('bindon-')) return `[(${name.slice(7)})]`;
  if (name.startsWith('bind-')) return `[${name.slice(5)}]`;
  if (name.startsWith('on-')) return `(${name.slice(3)})`;
  return name;
}

/**
 * Une directive d'Empreinte mal nommée ou posée sur le mauvais élément ne fait rien, sans erreur
 * de compilation (div[eBouton], input[eCase] sans type="checkbox", eBoutton…) : l'élément reste nu.
 */
function checkDirectives(file, full, tag, attributes, context) {
  const { directives } = context.empreinte;
  if (!directives?.size) return;
  const present = new Map();
  for (const { name, value } of attributes) {
    const bare = name.replace(/^[[(*]+|[\])]+$/g, '').split('.')[0];
    if (!present.has(bare)) present.set(bare, name.startsWith('[') ? undefined : value);
  }
  for (const { name, index } of attributes) {
    const bare = name.replace(/^[[(*]+|[\])]+$/g, '').split('.')[0];
    if (!/^e[A-Z]/.test(bare) && bare !== 'tailleAuto') continue;
    const forms = directives.get(bare);
    if (!forms) {
      report(file, full, index, 'unknown-directive', `${name} : aucune directive d'Empreinte ne porte ce nom, l'élément ne serait pas stylé. Vérifie le nom (catalogue : ${CATALOGUE}).`);
      continue;
    }
    const fits = forms.some(
      (form) =>
        (form.tag === null || form.tag === tag) &&
        form.attrs.every((attr) => present.has(attr.name) && (attr.value === null || present.get(attr.name) === attr.value)),
    );
    if (!fits) {
      report(file, full, index, 'unknown-directive', `${name} sur <${tag}> : la directive ne s'applique qu'à ${forms.map((form) => form.label).join(', ')} (attributs écrits en dur). Ici elle ne ferait rien.`);
    }
  }
}

function checkTemplate(file, full, context, start = 0, end = full.length) {
  const text = stripHtmlComments(full.slice(0, end)).padEnd(full.length, ' ');

  for (const { tag, index, attributes } of startTags(text, start, end)) {
    if (tag === 'style') report(file, full, index, 'inline-style', `<style> interdit dans un gabarit : la mise en page vient des classes .ds-*, l'apparence des composants Empreinte.`);
    if (tag === 'link' && attributes.some(({ name, value }) => (name === 'rel' && /stylesheet/i.test(value ?? '')) || (name === 'as' && value === 'style')))
      report(file, full, index, 'stylesheet', `<link> vers une feuille de style interdit : Empreinte charge ses polices et ses tokens (styles.css), la mise en page vient des classes .ds-*.`);
    if (tag.startsWith('p-'))
      report(file, full, index, 'primeng', `<${tag}> : PrimeNG est retiré. Utilise ${PRIMENG_TAGS[tag] ?? `le composant Empreinte correspondant (catalogue : ${CATALOGUE})`}.`);
    checkDirectives(file, full, tag, attributes, context);

    for (const { name: written, value, index: attrIndex } of attributes) {
      const name = canonicalAttribute(written);
      const lower = name.toLowerCase();
      const bare = name.replace(/^[[(*]+|[\])]+$/g, '');

      if (/^p[A-Z]/.test(bare)) {
        report(file, full, attrIndex, 'primeng', `Attribut PrimeNG ${written} : utilise ${PRIMENG_ATTRIBUTES[bare] ?? `l'équivalent Empreinte (catalogue : ${CATALOGUE})`}.`);
        continue;
      }
      if (bare.toLowerCase() === 'dt') {
        report(file, full, attrIndex, 'primeng', `${written} (jetons de thème PrimeNG) : plus de réglage d'apparence par instance. Choisis la variante du composant Empreinte (variante, petit, marquee, lumiere…).`);
        continue;
      }
      if (lower === 'style' || lower.startsWith('[style') || lower.startsWith('[attr.style') || lower === '[ngstyle]') {
        report(file, full, attrIndex, 'inline-style', `${written} interdit : aucun style dans l'application. Mise en page : classes .ds-* ; apparence : composant Empreinte (skill frontend-ui).`);
        continue;
      }
      if (['[ngclass]', '[class]', '[classname]', '[attr.class]'].includes(lower)) {
        report(file, full, attrIndex, 'dynamic-class', `${written} interdit : écris les classes en clair et bascule-les avec [class.ds-…]="condition".`);
        continue;
      }
      if (lower === 'class') {
        checkClassList(file, full, attrIndex, value ?? '', context);
        continue;
      }
      const classBinding = name.match(/^\[class\.([^\]]+)\]$/);
      if (classBinding) {
        checkClassList(file, full, attrIndex, classBinding[1], context);
        continue;
      }
      if (value === null || /href|routerlink|fragment|src$/.test(lower)) continue;
      const kind = rawValueKind(value);
      if (kind)
        report(file, full, attrIndex, 'raw-value', `${written}="${value.trim()}" : ${kind} interdite. Un nombre sans unité pour une entrée de composant ([taille]="28") est permis ; le reste passe par les composants Empreinte et les classes .ds-*.`);
    }
  }

  const zone = text.slice(start, end);
  for (const forbidden of zone.matchAll(/::ng-deep|!important/g))
    report(file, full, start + forbidden.index, 'forbidden', `${forbidden[0]} interdit.`);
  for (const ref of zone.matchAll(VAR_REF)) context.references.push({ name: ref[1], file, text: full, index: start + ref.index });
}

/** Les littéraux de chaîne compris entre deux positions (arguments d'un appel, objet host…). */
const stringsWithin = (strings, from, to) => strings.filter(({ index }) => index > from && index < to);

function checkComponentTs(file, source, context) {
  const scan = scanTs(source);
  const { code, bare, strings } = scan;
  checkPrimeNgTs(file, source, scan);

  // Métadonnées des composants : aucune feuille de style, aucun style posé par host
  for (const decorator of bare.matchAll(/@(?:Component|Directive)\s*\(/g)) {
    const open = decorator.index + decorator[0].length - 1;
    const close = matching(bare, open);
    const metadata = bare.slice(open, close);
    for (const key of metadata.matchAll(/\b(styles|styleUrls?)\s*:/g))
      report(file, source, open + key.index, 'component-styles', `${key[1]} interdit dans un composant : l'apparence vient des composants Empreinte, la mise en page des classes .ds-* (skill frontend-ui).`);
    const host = metadata.match(/\bhost\s*:\s*\{/);
    if (host) {
      const hostOpen = open + host.index + host[0].length - 1;
      const hostClose = matching(bare, hostOpen);
      for (const key of code.slice(hostOpen, hostClose).matchAll(/[{,]\s*(['"]?)style\1\s*:/g))
        report(file, source, hostOpen + key.index + 1, 'inline-style', `host: { style: … } interdit : aucun style posé sur l'hôte. Bascule une classe avec '[class.ds-…]'.`);
    }
  }

  // @HostBinding : mêmes règles que les liaisons d'un gabarit
  for (const match of code.matchAll(/@HostBinding\s*\(\s*(['"])([^'"]*)\1/g)) {
    const target = match[2];
    const classTarget = target.match(/^class\.(.+)$/);
    if (classTarget) checkClassList(file, source, match.index, classTarget[1], context);
    else if (/^(?:style|attr\.style)(?:\.|$)/.test(target))
      report(file, source, match.index, 'inline-style', `@HostBinding('${target}') interdit : aucun style posé par le code. Bascule une classe avec @HostBinding('class.ds-…').`);
    else if (/^(?:class|className|attr\.class)$/.test(target))
      report(file, source, match.index, 'dynamic-class', `@HostBinding('${target}') interdit : bascule chaque classe avec @HostBinding('class.ds-…').`);
  }

  // Style posé par le code
  for (const match of bare.matchAll(/\.style\b|\bsetStyle\s*\(|\bremoveStyle\s*\(|\.cssText\b|\binsertRule\s*\(|\bCSSStyleSheet\b|\badoptedStyleSheets\b/g))
    report(file, source, match.index, 'dom-style', `« ${match[0].trim()} » : ne pas styler par le code. Bascule une classe .ds-* ou une entrée du composant Empreinte.`);
  for (const match of code.matchAll(/\b(?:setAttribute|setProperty)\s*\([^)]*?['"]style['"]|\[\s*['"]style['"]\s*\]|createElement\(\s*['"]style['"]|::ng-deep|!important/g))
    report(file, source, match.index, 'dom-style', `« ${match[0].replace(/\s+/g, ' ')} » interdit : aucun style écrit par l'application.`);

  // Classes posées par le code : className et setAttribute('class') écrasent tout ; add/toggle/replace suivent les règles des classes
  for (const match of code.matchAll(/\.className\s*=(?!=)|\bsetAttribute\s*\([^)]*?['"]class['"]/g))
    report(file, source, match.index, 'dynamic-class', `« ${match[0].replace(/\s+/g, ' ')} » interdit : bascule chaque classe avec [class.ds-…]="condition".`);
  for (const match of bare.matchAll(/\.classList\s*\.\s*(?:add|toggle|replace)\s*\(|\baddClass\s*\(/g)) {
    const open = match.index + match[0].length - 1;
    for (const literal of stringsWithin(strings, open, matching(bare, open))) checkClassList(file, source, literal.index, literal.value, context);
  }

  // Classes posées par host: { class: '…' } ou '[class.x]'
  for (const match of code.matchAll(/['"]?\bclass['"]?\s*:\s*(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g))
    checkClassList(file, source, match.index, match[2], context);

  // Gabarits en ligne (template: `…`, '…' ou "…"), chacun contrôlé comme un fichier .html
  const templates = new Set();
  for (const match of bare.matchAll(/\btemplate\s*:\s*(['"`])/g)) {
    const start = match.index + match[0].length;
    const literal = strings.find(({ index }) => index === start);
    if (!literal) continue;
    templates.add(start);
    checkTemplate(file, source, context, start, start + literal.value.length);
  }

  for (const { value, index } of strings) {
    if (templates.has(index)) continue; // déjà contrôlé comme gabarit
    const binding = value.match(/^\[(style|attr\.style|attr\.class|ngStyle|ngClass|class|className)(?:\.([^\]]+))?\]$/);
    if (binding) {
      if (binding[1] === 'class' && binding[2]) checkClassList(file, source, index, binding[2], context);
      else report(file, source, index, /^(?:style|attr\.style|ngStyle)$/.test(binding[1]) ? 'inline-style' : 'dynamic-class', `« ${value} » interdit dans host : bascule une classe avec '[class.ds-…]'.`);
      continue;
    }
    if (/^(?:primeng|primeicons|@primeuix|@primeng)(?:\/|$)/.test(value)) continue; // déjà signalé comme import
    const kind = rawValueKind(value);
    if (kind) {
      const media = /\(\s*(?:max|min)-width\s*:/.test(value)
        ? ` Pour BreakpointObserver, utilise DS_MEDIA de @org/design-tokens.`
        : '';
      report(file, source, index, 'raw-value', `« ${value.length > 60 ? `${value.slice(0, 60)}…` : value} » : ${kind} interdite dans le code.${media} L'apparence vient des composants Empreinte, la mise en page des classes .ds-*.`);
    }
    for (const ref of value.matchAll(VAR_REF)) context.references.push({ name: ref[1], file, text: source, index: index + ref.index });
    for (const match of value.matchAll(/(?<![\w-])ds-[a-z0-9-]+/g)) context.usedClasses.add(match[0]);
  }
}

/** styles.css : uniquement des @import d'Empreinte, empreinte.css d'abord. */
function checkGlobalStyles(app) {
  const file = `apps/${app}/src/styles.css`;
  if (!existsSync(abs(file))) {
    report(file, null, 0, 'global-styles', `styles.css manquant : il importe Empreinte (@import '${EMPREINTE_IMPORT}';).`);
    return;
  }
  const source = read(file);
  const text = stripCssComments(source);
  const imports = [];
  let offset = 0;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed) {
      const match = trimmed.match(/^@import\s+(?:url\(\s*)?(['"])([^'"]+)\1\s*\)?[^;]*;$/);
      if (!match) report(file, source, offset, 'global-styles', `Seuls des @import sont permis dans styles.css : « ${trimmed.slice(0, 60)} ».`);
      else {
        imports.push(match[2]);
        if (PRIMENG_PACKAGE.test(match[2])) report(file, source, offset, 'primeng', `@import '${match[2]}' : PrimeNG est retiré (icônes : e-icone d'Empreinte).`);
        else if (!match[2].startsWith('@empreinte-studio/tokens/'))
          report(file, source, offset, 'global-styles', `@import '${match[2]}' : seule Empreinte (@empreinte-studio/tokens/…) se charge ici. Une feuille tierce contournerait le design system ; la mise en page d'Apex arrive par le tableau "styles" de project.json.`);
      }
    }
    offset += line.length + 1;
  }
  if (imports[0] !== EMPREINTE_IMPORT)
    report(file, source, 0, 'global-styles', `Le premier @import de styles.css doit être '${EMPREINTE_IMPORT}' (polices, tokens, typographie, base d'Empreinte).`);
}

/** project.json : styles.css (Empreinte), puis la couche Apex. */
function checkAppProject(app) {
  const file = `apps/${app}/project.json`;
  if (!existsSync(abs(file))) return;
  const source = read(file);
  const project = JSON.parse(source);
  const expected = [`apps/${app}/src/styles.css`, TOKENS, LAYOUT];
  for (const [targetName, target] of Object.entries(project.targets ?? {})) {
    const lists = [['options', target.options?.styles]];
    for (const [name, configuration] of Object.entries(target.configurations ?? {})) lists.push([`configurations.${name}`, configuration?.styles]);
    for (const [where, styles] of lists) {
      if (!Array.isArray(styles)) continue;
      const files = styles.map((entry) => (typeof entry === 'string' ? entry : entry.input));
      if (files.join('|') !== expected.join('|'))
        report(file, source, source.indexOf('"styles"'), 'app-styles-order', `Cible « ${targetName} » (${where}) : "styles" doit valoir exactement ${JSON.stringify(expected)} — Empreinte (importé par styles.css), puis les tokens et la mise en page d'Apex.`);
    }
  }
}

/* ------------------------------------------------------------------------ */
/* Exécution                                                                 */
/* ------------------------------------------------------------------------ */

const empreinte = loadEmpreinte();
if (empreinte.ok) checkContrast(empreinte);

const apexTokens = checkTokens(empreinte);
const layout = checkLayout(empreinte, apexTokens);
const exportedBreakpoints = checkIndex(apexTokens);

// Références de tokens dans tokens.css
const tokenRefs = [];
for (const [, { value, index }] of apexTokens.tokens)
  for (const ref of value.matchAll(VAR_REF)) {
    tokenRefs.push(ref[1]);
    if (!empreinte.tokens.has(ref[1]) && !apexTokens.tokens.has(ref[1]) && empreinte.ok)
      report(TOKENS, apexTokens.text, index, 'unknown-token', `${ref[1]} n'existe ni dans Empreinte ni dans ${TOKENS}.`);
  }

// La couche Apex ne contient que ses trois fichiers
for (const file of walk(DS_DIR)) {
  if (DS_FILES.has(file) || file.endsWith('.spec.ts')) continue;
  report(file, null, 0, 'ds-file', `${DS_DIR} ne contient que tokens.css, layout.css et index.ts : la couche Apex ne dessine aucun composant (plus de preset PrimeNG).`);
}

// Feuilles de style égarées dans le dépôt
const apps = existsSync(abs('apps')) ? readdirSync(abs('apps')).filter((app) => existsSync(abs(`apps/${app}/src`))) : [];
const allowedStylesheets = new Set([TOKENS, LAYOUT, ...apps.map((app) => `apps/${app}/src/styles.css`)]);
for (const file of SOURCE_ROOTS.flatMap((root) => walk(root))) {
  if (/\.(css|scss|sass|less)$/.test(file) && !allowedStylesheets.has(file))
    report(file, null, 0, 'stylesheet', `Feuille de style interdite : l'apparence vient des composants Empreinte, la mise en page des classes .ds-* de ${LAYOUT}.`);
}

const context = { layoutClasses: layout.classes, empreinte, usedClasses: new Set(), references: [] };
for (const app of apps) {
  checkAppProject(app);
  checkGlobalStyles(app);
  for (const file of walk(`apps/${app}/src`)) {
    const isTest = /\.spec\.ts$|(?:^|\/)test-setup\.ts$/.test(file);
    if (file.endsWith('.html')) checkTemplate(file, read(file), context);
    else if (file.endsWith('.ts') && isTest) {
      const source = read(file);
      checkPrimeNgTs(file, source, scanTs(source)); // les tests aussi doivent quitter PrimeNG
    } else if (file.endsWith('.ts')) checkComponentTs(file, read(file), context);
  }
}

// Tokens référencés dans les applications mais jamais déclarés
for (const ref of context.references) {
  if (empreinte.ok && !empreinte.tokens.has(ref.name) && !apexTokens.tokens.has(ref.name) && !layout.locals.has(ref.name))
    report(ref.file, ref.text, ref.index, 'unknown-token', `${ref.name} n'existe ni dans Empreinte ni dans ${TOKENS}.`);
}

/* ------------------------------------------------------------------------ */
/* Rapport                                                                   */
/* ------------------------------------------------------------------------ */

if (SHOW_UNUSED) {
  const referenced = new Set([...layout.references, ...tokenRefs, ...context.references.map((ref) => ref.name)]);
  const unusedTokens = [...apexTokens.tokens.keys()].filter((name) =>
    name.startsWith('--ds-breakpoint-') ? !layout.citedBreakpoints.has(name) && !exportedBreakpoints.has(name) : !referenced.has(name),
  );
  const unusedClasses = [...layout.classes].filter((name) => !context.usedClasses.has(name)).sort();
  console.log(`\nTokens --ds-* jamais référencés (${unusedTokens.length}) :`);
  for (const name of unusedTokens) console.log(`  ${name}`);
  console.log(`\nClasses .ds-* jamais utilisées dans les applications (${unusedClasses.length}) :`);
  for (const name of unusedClasses) console.log(`  .${name}`);
  console.log('');
}

if (violations.length === 0) {
  console.log('✔ Design system : aucune violation.');
  process.exit(0);
}

violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
for (const v of violations) console.error(`✖ ${v.file}:${v.line}  [${v.rule}]  ${v.message}`);
const byRule = new Map();
for (const v of violations) byRule.set(v.rule, (byRule.get(v.rule) ?? 0) + 1);
console.error(
  `\nDesign system : ${violations.length} violation(s) — ${[...byRule].map(([rule, n]) => `${rule} ${n}`).join(', ')}.\n` +
    `Interface → ${SKILL_UI} · Couche de mise en page → ${SKILL_DS} · Composants → ${CATALOGUE}`,
);
process.exit(1);
