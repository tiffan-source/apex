#!/usr/bin/env node
/*
 * Contrôle automatique du design system
 * ============================================================================
 *
 * Garantit que :
 *  - les applications (apps/<app>/src) n'écrivent aucun style hors du design
 *    system : pas de fichier CSS, pas de style inline, pas de valeur brute,
 *    pas de classe inventée, pas de token inexistant, pas de thème parallèle ;
 *  - le design system (libs/design-tokens) respecte ses propres règles :
 *    valeurs brutes réservées aux primitifs, hiérarchie des niveaux respectée,
 *    mode sombre limité aux tokens sémantiques, preset PrimeNG et classes .ds-*
 *    construits uniquement sur des tokens ;
 *  - les couples texte / fond respectent le contraste WCAG AA (4,5:1) en mode
 *    clair ET en mode sombre.
 *
 * Usage :
 *   node tools/design-system/check.mjs            contrôle complet
 *   node tools/design-system/check.mjs --unused   liste aussi les tokens et
 *                                                 classes .ds-* inutilisés
 *   npx nx lint design-tokens                     même contrôle, via Nx (CI)
 *
 * Code de sortie : 1 s'il existe au moins une violation, 0 sinon.
 * Règles détaillées : .claude/skills/frontend-ui et
 * .claude/skills/design-system-evolution.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DS_DIR = 'libs/design-tokens/src';
const TOKENS = `${DS_DIR}/tokens.css`;
const LAYOUT = `${DS_DIR}/layout.css`;
const PRESET = `${DS_DIR}/primeng-preset.ts`;
const SHOW_UNUSED = process.argv.includes('--unused');

// Dossiers où aucune feuille de style ne doit apparaître (hors exceptions ci-dessous)
const SOURCE_ROOTS = ['apps', 'libs', 'apex-library', 'worklfows'];
const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  '.angular',
  '.nx',
  'coverage',
]);

// Balises PrimeNG dont la largeur ne peut être réglée que par [style] (overlays)
const OVERLAY_TAGS = new Set([
  'p-dialog',
  'p-drawer',
  'p-popover',
  'p-confirmdialog',
  'p-confirmpopup',
]);

/*
 * Couples texte / fond contrôlés en clair et en sombre.
 * À compléter à chaque nouveau rôle de texte ou de fond (voir skill design-system-evolution).
 */
const CONTRAST_PAIRS = [
  ['--ds-color-text', '--ds-color-bg'],
  ['--ds-color-text', '--ds-color-surface'],
  ['--ds-color-text-muted', '--ds-color-bg'],
  ['--ds-color-text-muted', '--ds-color-surface'],
  ['--ds-color-text-muted', '--ds-color-surface-hover'],
  ['--ds-color-link', '--ds-color-bg'],
  ['--ds-color-link', '--ds-color-surface'],
  ['--ds-color-primary', '--ds-color-bg'],
  ['--ds-color-primary', '--ds-color-surface'],
  ['--ds-color-primary', '--ds-color-primary-soft'],
  ['--ds-color-primary-contrast', '--ds-color-primary'],
  ['--ds-color-accent', '--ds-color-accent-soft'],
  ['--ds-color-success', '--ds-color-success-soft'],
  ['--ds-color-warning', '--ds-color-warning-soft'],
  ['--ds-color-danger', '--ds-color-danger-soft'],
  ['--ds-color-danger', '--ds-color-surface'],
  ['--ds-color-info', '--ds-color-info-soft'],
  ['--ds-color-highlight', '--ds-color-highlight-soft'],
];
const MIN_CONTRAST = 4.5;

// Palettes primitives référencées dynamiquement par le preset (palette('green')…)
const PALETTE_TOKEN =
  /^--ds-color-(gray|green|violet|teal|orange|yellow|red|fuchsia|pink|sky)-\d+$/;

const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/i;
const COLOR_FN = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/i;
const LENGTH = /(?<![\w.-])-?(?:\d+\.?\d*|\.\d+)(?:px|rem|em|pt)\b/i;
const VAR_REF = /var\(\s*(--ds-[\w-]+)/g;
// Couleurs CSS nommées courantes, refusées dans les applications (valeur exacte d'une chaîne ou d'un attribut)
const NAMED_COLOR =
  /^(?:white|black|red|green|blue|gray|grey|orange|yellow|purple|pink|brown|navy|maroon|olive|lime|aqua|cyan|magenta|silver|gold|indigo|violet|crimson|tomato)$/i;
const TOKEN_NAME = /^--ds-[a-z0-9]+(?:-[a-z0-9]+)*$/;

/* ------------------------------------------------------------------------ */
/* Outils                                                                    */
/* ------------------------------------------------------------------------ */

const violations = [];
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const lineAt = (text, index) => text.slice(0, index).split('\n').length;
const blank = (match) => match.replace(/[^\n]/g, ' ');
const stripCssComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, blank);
const stripHtmlComments = (text) => text.replace(/<!--[\s\S]*?-->/g, blank);

function report(file, text, index, rule, message) {
  violations.push({
    file,
    line: text === null ? 0 : lineAt(text, index),
    rule,
    message,
  });
}

function walk(dir, files = []) {
  if (!existsSync(join(ROOT, dir))) return files;
  for (const entry of readdirSync(join(ROOT, dir))) {
    if (IGNORED_DIRS.has(entry)) continue;
    const rel = `${dir}/${entry}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, files);
    else files.push(rel);
  }
  return files;
}

/** Retourne le code sans commentaires (positions conservées) et ses littéraux de chaîne. */
function scanTs(source) {
  const strings = [];
  let code = '';
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];
    if (char === '/' && next === '/') {
      const end = source.indexOf('\n', i);
      const stop = end < 0 ? source.length : end;
      code += blank(source.slice(i, stop));
      i = stop;
      continue;
    }
    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end < 0 ? source.length : end + 2;
      code += blank(source.slice(i, stop));
      i = stop;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      let j = i + 1;
      while (j < source.length && source[j] !== char)
        j += source[j] === '\\' ? 2 : 1;
      strings.push({ value: source.slice(i + 1, j), index: i });
      code += source.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    code += char;
    i++;
  }
  return { code, strings };
}

function rawValueKind(value, { allowLengths = false } = {}) {
  if (HEX.test(value)) return 'couleur hexadécimale';
  if (COLOR_FN.test(value)) return 'fonction de couleur';
  if (!allowLengths && LENGTH.test(value)) return 'longueur (px/rem/em)';
  return null;
}

/* ------------------------------------------------------------------------ */
/* 1. Tokens                                                                 */
/* ------------------------------------------------------------------------ */

const LEVEL_RANK = { primitive: 0, semantic: 1, dark: 1, component: 2 };

function parseTokens() {
  const raw = read(TOKENS);
  const text = stripCssComments(raw);
  const semanticStart = raw.indexOf('2. SÉMANTIQUES');
  const componentStart = raw.indexOf('3. COMPOSANTS');
  if (semanticStart < 0 || componentStart < 0) {
    report(
      TOKENS,
      null,
      0,
      'tokens-structure',
      'Les sections « 2. SÉMANTIQUES » et « 3. COMPOSANTS » doivent rester présentes.',
    );
  }

  let darkStart = text.search(
    /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/,
  );
  let darkEnd = -1;
  if (darkStart >= 0) {
    let depth = 0;
    for (let i = text.indexOf('{', darkStart); i < text.length; i++) {
      if (text[i] === '{') depth++;
      if (text[i] === '}' && --depth === 0) {
        darkEnd = i;
        break;
      }
    }
  } else {
    darkStart = Infinity;
  }

  const declarations = [];
  for (const match of text.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) {
    const index = match.index;
    let level = 'semantic';
    if (index < semanticStart) level = 'primitive';
    else if (index > darkStart && index < darkEnd) level = 'dark';
    else if (index > componentStart) level = 'component';
    declarations.push({ name: match[1], value: match[2].replace(/\s+/g, ' ').trim(), index, level });
  }
  return { raw, text, declarations };
}

function checkTokens({ text, declarations }) {
  const light = new Map();
  const levels = new Map();
  const seenDark = new Set();

  for (const decl of declarations) {
    if (!TOKEN_NAME.test(decl.name)) {
      report(
        TOKENS,
        text,
        decl.index,
        'token-name',
        `${decl.name} : nom invalide (attendu --ds-<kebab-case>).`,
      );
    }
    if (decl.level === 'dark') {
      if (seenDark.has(decl.name))
        report(
          TOKENS,
          text,
          decl.index,
          'duplicate-token',
          `${decl.name} est redéfini deux fois en mode sombre.`,
        );
      seenDark.add(decl.name);
      continue;
    }
    if (light.has(decl.name))
      report(
        TOKENS,
        text,
        decl.index,
        'duplicate-token',
        `${decl.name} est déclaré deux fois.`,
      );
    light.set(decl.name, decl.value);
    levels.set(decl.name, decl.level);
  }

  for (const decl of declarations) {
    // Valeurs brutes : réservées aux primitifs (%, vw, vh et nombres sans unité restent permis)
    if (decl.level !== 'primitive') {
      const kind = rawValueKind(decl.value);
      if (kind) {
        report(
          TOKENS,
          text,
          decl.index,
          'tokens-raw-value',
          `${decl.name} : ${kind} hors des primitifs — créer ou référencer un token primitif.`,
        );
      }
    }
    // Le mode sombre ne redéfinit que des tokens sémantiques existants
    if (decl.level === 'dark' && levels.get(decl.name) !== 'semantic') {
      report(
        TOKENS,
        text,
        decl.index,
        'dark-override',
        `${decl.name} : le mode sombre ne peut redéfinir que des tokens sémantiques déclarés en mode clair.`,
      );
    }
    // Un niveau ne référence jamais un niveau plus spécifique (primitif → sémantique → composant)
    for (const ref of decl.value.matchAll(VAR_REF)) {
      const refLevel = levels.get(ref[1]);
      if (refLevel && LEVEL_RANK[refLevel] > LEVEL_RANK[decl.level]) {
        report(
          TOKENS,
          text,
          decl.index,
          'level-inversion',
          `${decl.name} (${decl.level}) référence ${ref[1]} (${refLevel}) : un niveau ne dépend que des niveaux inférieurs.`,
        );
      }
    }
  }

  const dark = new Map(light);
  for (const decl of declarations)
    if (decl.level === 'dark') dark.set(decl.name, decl.value);
  return { light, dark, levels };
}

/* --- Contraste ------------------------------------------------------------ */

function substitute(value, map, depth = 0) {
  if (depth > 20) return value;
  return value.replace(/var\(\s*(--ds-[\w-]+)\s*\)/g, (_, name) =>
    map.has(name) ? substitute(map.get(name), map, depth + 1) : 'UNRESOLVED',
  );
}

function parseColor(value) {
  const color = value.trim();
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const digits =
      hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return [0, 2, 4].map((offset) =>
      parseInt(digits.slice(offset, offset + 2), 16),
    );
  }
  const mix = color.match(
    /^color-mix\(\s*in\s+srgb\s*,\s*(.+?)\s+(\d+(?:\.\d+)?)%\s*,\s*(.+)\)$/i,
  );
  if (mix) {
    const first = parseColor(mix[1]);
    const second = parseColor(mix[3]);
    const ratio = Number(mix[2]) / 100;
    if (!first || !second) return null;
    return first.map((channel, i) => channel * ratio + second[i] * (1 - ratio));
  }
  return null;
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

function checkContrast(text, declarations, schemes) {
  for (const [mode, map] of Object.entries(schemes)) {
    for (const [fgName, bgName] of CONTRAST_PAIRS) {
      const decl =
        declarations.find(
          (d) =>
            d.name === fgName &&
            (mode === 'sombre' ? d.level === 'dark' : d.level !== 'dark'),
        ) ?? declarations.find((d) => d.name === fgName);
      const index = decl ? decl.index : 0;
      if (!map.has(fgName) || !map.has(bgName)) {
        report(
          TOKENS,
          text,
          index,
          'contrast-pair',
          `Couple de contraste inconnu : ${fgName} / ${bgName} (mettre à jour CONTRAST_PAIRS dans tools/design-system/check.mjs).`,
        );
        continue;
      }
      const fg = parseColor(substitute(map.get(fgName), map));
      const bg = parseColor(substitute(map.get(bgName), map));
      if (!fg || !bg) {
        report(
          TOKENS,
          text,
          index,
          'contrast-unresolved',
          `Impossible de calculer le contraste ${fgName} / ${bgName} en mode ${mode} (valeurs attendues : #hex ou color-mix(in srgb, …)).`,
        );
        continue;
      }
      const ratio = contrast(fg, bg);
      if (ratio < MIN_CONTRAST) {
        report(
          TOKENS,
          text,
          index,
          'contrast',
          `Contraste insuffisant en mode ${mode} : ${fgName} sur ${bgName} = ${ratio.toFixed(2)}:1 (minimum ${MIN_CONTRAST}:1).`,
        );
      }
    }
  }
}

/* ------------------------------------------------------------------------ */
/* 2. Mise en page (layout.css)                                              */
/* ------------------------------------------------------------------------ */

function checkLayout(breakpoints) {
  const raw = read(LAYOUT);
  const text = stripCssComments(raw);
  const classes = new Set(
    [...text.matchAll(/\.(ds-[\w-]+)/g)].map((m) => m[1]),
  );
  const locals = new Set(
    [...text.matchAll(/(--ds-[\w-]+)\s*:/g)].map((m) => m[1]),
  );

  for (const rule of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = rule[1].trim();
    const bodyIndex = rule.index + rule[1].length + 1;

    for (const part of selector.split(',')) {
      const partClasses = [...part.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
      if (partClasses.length && !partClasses[0].startsWith('ds-')) {
        report(
          LAYOUT,
          text,
          rule.index,
          'layout-selector',
          `Sélecteur « ${part.trim()} » : toute règle doit partir d'une classe .ds-* (une classe .p-* n'est permise que sous une classe .ds-*).`,
        );
      }
      for (const name of partClasses.slice(1)) {
        if (!name.startsWith('ds-') && !name.startsWith('p-')) {
          report(
            LAYOUT,
            text,
            rule.index,
            'layout-selector',
            `Classe .${name} : seules les classes .ds-* (et .p-* sous une .ds-*) sont permises.`,
          );
        }
      }
    }

    let offset = 0;
    for (const declaration of rule[2].split(';')) {
      const value = declaration.slice(declaration.indexOf(':') + 1);
      const index = bodyIndex + offset;
      offset += declaration.length + 1;
      if (!declaration.includes(':')) continue;
      const kind = rawValueKind(value);
      if (kind)
        report(
          LAYOUT,
          text,
          index,
          'layout-raw-value',
          `« ${declaration.trim()} » : ${kind} — utiliser un token var(--ds-*).`,
        );
      if (/!important/.test(value))
        report(
          LAYOUT,
          text,
          index,
          'important',
          `« ${declaration.trim()} » : !important interdit.`,
        );
    }
  }

  // Media queries : valeur exacte d'un breakpoint, annoncée par un commentaire /* --ds-breakpoint-xx */
  for (const media of text.matchAll(/@media[^{]*/g)) {
    const lines = raw.slice(0, media.index).trimEnd().split('\n');
    const previous = lines[lines.length - 1] ?? '';
    const named = previous.match(/--ds-breakpoint-([\w-]+)/);
    for (const length of media[0].matchAll(/(\d+)px/g)) {
      const expected = named
        ? breakpoints.get(`--ds-breakpoint-${named[1]}`)
        : null;
      if (!named) {
        report(
          LAYOUT,
          text,
          media.index,
          'media-comment',
          `Media query sans commentaire /* --ds-breakpoint-xx */ juste au-dessus.`,
        );
      } else if (expected !== `${length[1]}px`) {
        report(
          LAYOUT,
          text,
          media.index,
          'media-breakpoint',
          `${length[1]}px ne correspond pas à --ds-breakpoint-${named[1]} (${expected ?? 'inexistant'}).`,
        );
      }
    }
  }

  return { text, classes, locals };
}

/* ------------------------------------------------------------------------ */
/* 3. Preset PrimeNG                                                         */
/* ------------------------------------------------------------------------ */

function checkPreset() {
  const source = read(PRESET);
  const { strings } = scanTs(source);
  for (const { value, index } of strings) {
    const kind = rawValueKind(value);
    if (kind)
      report(
        PRESET,
        source,
        index,
        'preset-raw-value',
        `« ${value} » : ${kind} — le preset ne référence que des tokens var(--ds-*).`,
      );
  }
  return { source, strings };
}

/* ------------------------------------------------------------------------ */
/* 4. Applications                                                           */
/* ------------------------------------------------------------------------ */

function checkClassList(file, text, index, value, layoutClasses, attribute) {
  if (/\{\{|\}\}/.test(value)) {
    report(
      file,
      text,
      index,
      'dynamic-class',
      `${attribute}="${value.trim()}" : classe dynamique interdite — utiliser [class.ds-…] ou l'entrée [icon] du composant.`,
    );
    return;
  }
  for (const name of value.split(/\s+/).filter(Boolean)) {
    if (/^pi(?:-[\w-]+)?$/.test(name)) continue;
    if (!name.startsWith('ds-')) {
      report(
        file,
        text,
        index,
        'unknown-class',
        `Classe « ${name} » : seules les classes .ds-* du design system et les icônes pi/pi-* sont permises.`,
      );
    } else if (!layoutClasses.has(name)) {
      report(
        file,
        text,
        index,
        'unknown-class',
        `Classe « ${name} » inexistante dans ${LAYOUT}.`,
      );
    }
  }
}

function checkTemplate(
  file,
  full,
  layoutClasses,
  breakpointValues,
  start = 0,
  end = full.length,
) {
  const text = stripHtmlComments(full.slice(0, end)).padEnd(full.length, ' ');
  const attributePattern = /([^\s<>"'=/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  attributePattern.lastIndex = start;
  let match;
  while ((match = attributePattern.exec(text)) && match.index < end) {
    const name = match[1];
    const value = match[2] ?? match[3] ?? '';
    const index = match.index;
    const lower = name.toLowerCase();

    if (lower === 'style' || lower === '[attr.style]') {
      report(
        file,
        full,
        index,
        'inline-style',
        `Attribut ${name} interdit — utiliser un composant PrimeNG, [dt] avec des tokens ou une classe .ds-*.`,
      );
      continue;
    }
    if (lower === '[ngstyle]') {
      report(
        file,
        full,
        index,
        'inline-style',
        `[ngStyle] interdit — utiliser [dt] avec des tokens ou une classe .ds-*.`,
      );
      continue;
    }
    if (
      lower === '[ngclass]' ||
      lower === '[class]' ||
      lower === '[classname]'
    ) {
      report(
        file,
        full,
        index,
        'dynamic-class',
        `${name} interdit — utiliser [class.ds-…]="condition".`,
      );
      continue;
    }
    if (lower.startsWith('[style')) {
      const tagStart = text.lastIndexOf('<', index);
      const tag = text
        .slice(tagStart + 1)
        .match(/^[\w-]+/)?.[0]
        ?.toLowerCase();
      if (!OVERLAY_TAGS.has(tag)) {
        report(
          file,
          full,
          index,
          'style-binding',
          `${name} sur <${tag}> : liaison de style réservée à la largeur des overlays (${[...OVERLAY_TAGS].join(', ')}).`,
        );
      } else {
        const kind = rawValueKind(value);
        if (kind)
          report(
            file,
            full,
            index,
            'raw-value',
            `${name}="${value}" : ${kind} — utiliser var(--ds-*) (seuls %, vw et vh sont permis en brut).`,
          );
      }
      continue;
    }
    if (lower === '[breakpoints]') {
      for (const key of value.matchAll(/['"](\d+px)['"]\s*:/g)) {
        if (!breakpointValues.has(key[1])) {
          report(
            file,
            full,
            index,
            'breakpoint',
            `Point de rupture ${key[1]} : utiliser la valeur d'un --ds-breakpoint-* (${[...breakpointValues].join(', ')}).`,
          );
        }
      }
      const kind = rawValueKind(value.replace(/['"]\d+px['"]\s*:/g, ''));
      if (kind)
        report(
          file,
          full,
          index,
          'raw-value',
          `[breakpoints] : ${kind} — utiliser var(--ds-*).`,
        );
      continue;
    }
    if (lower === 'class' || lower === 'styleclass') {
      checkClassList(file, full, index, value, layoutClasses, name);
      continue;
    }
    const classBinding = name.match(/^\[class\.([^\]]+)\]$/);
    if (classBinding) {
      checkClassList(file, full, index, classBinding[1], layoutClasses, name);
      continue;
    }
    if (/href|routerlink|fragment/.test(lower)) continue;
    const kind =
      rawValueKind(value, { allowLengths: !lower.startsWith('[dt') }) ??
      (NAMED_COLOR.test(value.trim().replace(/^'(.*)'$/, '$1'))
        ? 'couleur nommée'
        : null);
    if (kind)
      report(
        file,
        full,
        index,
        'raw-value',
        `${name}="${value.trim()}" : ${kind} — utiliser un token var(--ds-*) ou une sévérité/variante PrimeNG.`,
      );
  }

  for (const forbidden of text
    .slice(start, end)
    .matchAll(/::ng-deep|!important/g)) {
    report(
      file,
      full,
      start + forbidden.index,
      'forbidden',
      `${forbidden[0]} interdit.`,
    );
  }
}

function checkComponentTs(file, source, layoutClasses, breakpointValues) {
  const { code, strings } = scanTs(source);

  for (const match of code.matchAll(/\b(styleUrls?|styles)\s*:/g)) {
    report(
      file,
      source,
      match.index,
      'component-styles',
      `${match[1]} interdit dans un composant : l'apparence vient du preset PrimeNG, la mise en page des classes .ds-*.`,
    );
  }
  for (const match of code.matchAll(
    /\bdefinePreset\s*\(|from\s+['"](?:@primeuix\/themes|primeng\/themes)[^'"]*['"]/g,
  )) {
    report(
      file,
      source,
      match.index,
      'theme-in-app',
      `Thème ou preset défini dans l'application — utiliser DesignSystemPreset de @org/design-tokens (évolutions : skill design-system-evolution).`,
    );
  }
  if (/providePrimeNG\s*\(/.test(code) && !/DesignSystemPreset/.test(code)) {
    report(
      file,
      source,
      code.search(/providePrimeNG\s*\(/),
      'theme-in-app',
      `providePrimeNG doit utiliser DesignSystemPreset et designSystemThemeOptions de @org/design-tokens.`,
    );
  }
  for (const match of code.matchAll(
    /\.style\s*(?:\.|\[)|setAttribute\(\s*['"]style['"]|::ng-deep|!important/g,
  )) {
    report(
      file,
      source,
      match.index,
      'dom-style',
      `« ${match[0]} » : ne pas styler par le code — utiliser PrimeNG, [dt] ou une classe .ds-*.`,
    );
  }

  for (const { value, index } of strings) {
    const kind =
      rawValueKind(value) ??
      (NAMED_COLOR.test(value.trim()) ? 'couleur nommée' : null);
    if (kind)
      report(
        file,
        source,
        index,
        'raw-value',
        `« ${value} » : ${kind} — utiliser un token var(--ds-*) (ex. dans un objet [dt]).`,
      );
  }

  // Template inline éventuel
  const inline = code.match(/\btemplate\s*:\s*`/);
  if (inline) {
    const start = inline.index + inline[0].length;
    const end = source.indexOf('`', start);
    checkTemplate(
      file,
      source,
      layoutClasses,
      breakpointValues,
      start,
      end < 0 ? source.length : end,
    );
  }
  return strings;
}

function checkAppConfig(app) {
  const projectFile = `apps/${app}/project.json`;
  if (!existsSync(join(ROOT, projectFile))) return;
  const source = read(projectFile);
  const project = JSON.parse(source);
  for (const [targetName, target] of Object.entries(project.targets ?? {})) {
    const styles = target.options?.styles;
    if (!Array.isArray(styles)) continue;
    const files = styles.map((entry) =>
      typeof entry === 'string' ? entry : entry.input,
    );
    if (files[0] !== TOKENS || files[1] !== LAYOUT) {
      report(
        projectFile,
        source,
        source.indexOf('"styles"'),
        'app-styles-order',
        `Cible « ${targetName} » : les styles doivent commencer par ${TOKENS} puis ${LAYOUT}.`,
      );
    }
  }
}

/* ------------------------------------------------------------------------ */
/* Exécution                                                                 */
/* ------------------------------------------------------------------------ */

const tokens = parseTokens();
const { light, dark, levels } = checkTokens(tokens);
checkContrast(tokens.text, tokens.declarations, { clair: light, sombre: dark });

const breakpoints = new Map(
  [...light].filter(([name]) => name.startsWith('--ds-breakpoint-')),
);
const breakpointValues = new Set(breakpoints.values());
const layout = checkLayout(breakpoints);
const preset = checkPreset();

const references = []; // { name, file, text, index }
const collectRefs = (file, text, value, baseIndex) => {
  for (const ref of value.matchAll(VAR_REF))
    references.push({ name: ref[1], file, text, index: baseIndex + ref.index });
};
collectRefs(TOKENS, tokens.text, tokens.text, 0);
collectRefs(LAYOUT, layout.text, layout.text, 0);
for (const { value, index } of preset.strings)
  collectRefs(PRESET, preset.source, value, index + 1);

// Feuilles de style égarées dans le dépôt
const allowedStylesheets = new Set([TOKENS, LAYOUT]);
const apps = existsSync(join(ROOT, 'apps'))
  ? readdirSync(join(ROOT, 'apps')).filter((app) =>
      existsSync(join(ROOT, 'apps', app, 'src')),
    )
  : [];
for (const app of apps) allowedStylesheets.add(`apps/${app}/src/styles.css`);
for (const file of SOURCE_ROOTS.flatMap((root) => walk(root))) {
  if (/\.(css|scss|sass|less)$/.test(file) && !allowedStylesheets.has(file)) {
    report(
      file,
      null,
      0,
      'stylesheet',
      `Feuille de style interdite : l'apparence vient du preset PrimeNG, la mise en page de ${LAYOUT}.`,
    );
  }
}

const usedClasses = new Set();
for (const app of apps) {
  checkAppConfig(app);

  const globalStyles = `apps/${app}/src/styles.css`;
  if (existsSync(join(ROOT, globalStyles))) {
    const text = stripCssComments(read(globalStyles));
    text.split('\n').forEach((line, i) => {
      if (line.trim() && !line.trim().startsWith('@import')) {
        violations.push({
          file: globalStyles,
          line: i + 1,
          rule: 'global-styles',
          message: `Seuls des @import sont permis ici : « ${line.trim()} ».`,
        });
      }
    });
  }

  for (const file of walk(`apps/${app}/src`)) {
    if (file.endsWith('.spec.ts')) continue;
    if (file.endsWith('.html')) {
      const source = read(file);
      checkTemplate(file, source, layout.classes, breakpointValues);
      collectRefs(file, source, stripHtmlComments(source), 0);
      for (const match of source.matchAll(/\bds-[\w-]+/g))
        usedClasses.add(match[0]);
    } else if (file.endsWith('.ts')) {
      const source = read(file);
      const strings = checkComponentTs(
        file,
        source,
        layout.classes,
        breakpointValues,
      );
      for (const { value, index } of strings) {
        collectRefs(file, source, value, index + 1);
        for (const match of value.matchAll(/\bds-[\w-]+/g))
          usedClasses.add(match[0]);
      }
    }
  }
}

// Tokens référencés mais jamais déclarés (fautes de frappe, tokens inventés)
const defined = new Set([...light.keys(), ...layout.locals]);
for (const ref of references) {
  if (ref.name.endsWith('-')) continue; // référence dynamique : var(--ds-color-${nom}-${palier})
  if (!defined.has(ref.name)) {
    report(
      ref.file,
      ref.text,
      ref.index,
      'unknown-token',
      `${ref.name} n'existe pas dans ${TOKENS} — vérifier le nom ou l'ajouter au design system.`,
    );
  }
}

/* ------------------------------------------------------------------------ */
/* Rapport                                                                   */
/* ------------------------------------------------------------------------ */

if (SHOW_UNUSED) {
  const referenced = new Set(references.map((ref) => ref.name));
  const unusedTokens = [...levels.keys()].filter(
    (name) =>
      !referenced.has(name) &&
      !PALETTE_TOKEN.test(name) &&
      !name.startsWith('--ds-breakpoint-'),
  );
  const unusedClasses = [...layout.classes].filter(
    (name) => !usedClasses.has(name),
  );
  console.log(`\nTokens jamais référencés (${unusedTokens.length}) :`);
  for (const name of unusedTokens)
    console.log(`  ${name} (${levels.get(name)})`);
  console.log(
    `\nClasses .ds-* jamais utilisées dans les applications (${unusedClasses.length}) :`,
  );
  for (const name of unusedClasses) console.log(`  .${name}`);
  console.log('');
}

if (violations.length === 0) {
  console.log('✔ Design system : aucune violation.');
  process.exit(0);
}

violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
for (const v of violations)
  console.error(`✖ ${v.file}:${v.line}  [${v.rule}]  ${v.message}`);
console.error(
  `\nDesign system : ${violations.length} violation(s).\n` +
    'Interface → .claude/skills/frontend-ui/SKILL.md · Design system → .claude/skills/design-system-evolution/SKILL.md',
);
process.exit(1);
