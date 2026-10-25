import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Route } from '@angular/router';
import { motsAEviter } from '@empreinte-studio/angular/core';
import { voiceIssues } from '../chore/constants/messages.constante';
import { routes } from './app.routes';

/*
 * Le test de voix transverse (cahier de migration, § 6). Tout ce que les écrans de src/app peuvent montrer
 * ou faire entendre passe dans motsAEviter() d'Empreinte et dans voiceIssues() d'Apex, qui voit en plus les
 * mots accentués, « erreur » et les emoji : le texte des gabarits, leurs attributs lisibles (aria-label,
 * libelle, titre, placeholder…), les chaînes des composants et les titres des routes. Il lit les sources
 * (node:fs) : il ne dépend d'aucun état. Les tests de chaque écran vérifient, eux, le texte rendu dans
 * chacun de ses états.
 */

const APP_DIR = import.meta.dirname;

/** Les attributs qu'une personne lit ou entend (lecteur d'écran, infobulle, champ vide). */
const READABLE_ATTRIBUTES = [
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-placeholder',
  'aria-valuetext',
  'libelle',
  'titre',
  'legende',
  'aide',
  'texteVide',
  'placeholder',
  'title',
  'alt',
];
const ATTRIBUTE_NAMES = READABLE_ATTRIBUTES.map((name) => name.replace(/[-.]/g, '\\$&')).join('|');
/** `libelle="Réglages"` (et pas `[libelle]=…` ni `attr.aria-label=…`). */
const STATIC_ATTRIBUTE = new RegExp(`(?<![\\w.\\[(-])(?:${ATTRIBUTE_NAMES})\\s*=\\s*"([^"]*)"`, 'g');
/** `[attr.aria-label]="'Modifier « ' + pas.titre + ' »'"` : les chaînes de l'expression. */
const BOUND_ATTRIBUTE = new RegExp(`\\[(?:attr\\.)?(?:${ATTRIBUTE_NAMES})\\]\\s*=\\s*"([^"]*)"`, 'g');
/** Une balise entière, y compris quand une valeur d'attribut contient « > ». */
const TAG = /<(?:[^>"']|"[^"]*"|'[^']*')*>/g;

type Found = { file: string; text: string };

/** Les fichiers d'un dossier et de ses sous-dossiers, à l'extension donnée. */
function filesUnder(dir: string, extension: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(path, extension);
    return entry.name.endsWith(extension) ? [path] : [];
  });
}

/** Les chaînes littérales d'une expression Angular (`ouvert ? 'Fermer' : 'Ouvrir'`). */
function expressionStrings(expression: string): string[] {
  return [...expression.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)].map((match) => match[1] ?? match[2]);
}

/** Un bloc de contrôle suivi de sa condition entre parenthèses. */
const BLOCK_WITH_CONDITION = /@(?:else\s+if|if|for|switch|case|defer)\s*\(/;

/** Retire `@if (…) {`, `@for (…) {`, `} @else {`, `@let x = …;` : il ne reste que le texte. */
function withoutControlFlow(text: string): string {
  let out = text.replace(/@let\s[^;]*;/g, ' ');
  for (let start = out.search(BLOCK_WITH_CONDITION); start !== -1; start = out.search(BLOCK_WITH_CONDITION)) {
    // La condition peut contenir des parenthèses : jusqu'à celle qui ferme la première.
    let index = out.indexOf('(', start);
    let depth = 0;
    do {
      if (out[index] === '(') depth++;
      else if (out[index] === ')') depth--;
      index++;
    } while (depth > 0 && index < out.length);
    out = `${out.slice(0, start)} ${out.slice(index)}`;
  }
  return out.replace(/@(?:else|default|empty|placeholder|loading)\b/g, ' ').replace(/[{}]/g, ' ');
}

const ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  laquo: '«',
  raquo: '»',
  hellip: '…',
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&(\w+);/g, (entity, name: string) => ENTITIES[name] ?? entity);
}

/** Ce qu'un gabarit montre ou fait entendre : texte visible, chaînes des interpolations, attributs lisibles. */
function templateTexts(html: string): string[] {
  const source = html.replace(/<!--[\s\S]*?-->/g, ' ');
  const texts: string[] = [];
  for (const tag of source.match(TAG) ?? []) {
    for (const [, value] of tag.matchAll(STATIC_ATTRIBUTE)) texts.push(value);
    for (const [, expression] of tag.matchAll(BOUND_ATTRIBUTE)) texts.push(...expressionStrings(expression));
  }
  for (const segment of source.split(TAG)) {
    const visible = segment.replace(/\{\{([\s\S]*?)\}\}/g, (_, expression: string) => {
      texts.push(...expressionStrings(expression));
      return ' ';
    });
    texts.push(...withoutControlFlow(visible).split('\n'));
  }
  return texts.map((text) => decodeEntities(text).replace(/\s+/g, ' ').trim()).filter((text) => /\p{L}|\d|!/u.test(text));
}

/** Après ces mots, une barre oblique ouvre une expression régulière, pas une division. */
const BEFORE_REGEX = /(?:^|[(,=:[!&|?{};+\-*%<>~^]|\breturn|\btypeof|\bcase|\bin|\bof|\bnew|\bdelete|\bvoid|\bthrow)\s*$/;
/** Les chaînes qui ne sont pas du texte : chemin d'un import, sélecteur, gabarit, feuille de style, message pour la console. */
const NOT_TEXT_BEFORE = /(?:\bfrom|\bimport\s*\(|\bselector\s*:|\btemplateUrl\s*:|\bstyleUrls?\s*:|\bstyleUrls\s*:\s*\[[^\]]*)\s*$/;

/**
 * Les chaînes littérales d'un fichier TypeScript ('…', "…" et `…`, dont les ${…} deviennent des espaces),
 * sans les commentaires ni les expressions régulières, et sans les chaînes qui ne s'affichent jamais.
 */
function codeStrings(source: string): string[] {
  const strings: string[] = [];
  const keep = (text: string, start: number) => {
    const before = source.slice(Math.max(0, start - 40), start);
    const line = source.slice(source.lastIndexOf('\n', start) + 1, start);
    if (!NOT_TEXT_BEFORE.test(before) && !/\bconsole\.\w+\(/.test(line)) strings.push(text);
  };

  /** Lit le code à partir de `index` jusqu'à une accolade fermante de plus (fin d'un ${…}), ou la fin. */
  const scan = (index: number, untilBrace: boolean): number => {
    let depth = 0;
    while (index < source.length) {
      const char = source[index];
      const next = source[index + 1];
      if (char === '/' && next === '/') {
        index = source.indexOf('\n', index);
        if (index === -1) return source.length;
        continue;
      }
      if (char === '/' && next === '*') {
        index = source.indexOf('*/', index + 2) + 2;
        if (index === 1) return source.length;
        continue;
      }
      if (char === "'" || char === '"') {
        let end = index + 1;
        while (end < source.length && source[end] !== char) end += source[end] === '\\' ? 2 : 1;
        keep(source.slice(index + 1, end).replace(/\\(.)/g, '$1'), index);
        index = end + 1;
        continue;
      }
      if (char === '`') {
        let text = '';
        let end = index + 1;
        while (end < source.length && source[end] !== '`') {
          if (source[end] === '\\') {
            text += source[end + 1];
            end += 2;
          } else if (source[end] === '$' && source[end + 1] === '{') {
            text += ' ';
            end = scan(end + 2, true);
          } else {
            text += source[end++];
          }
        }
        keep(text, index);
        index = end + 1;
        continue;
      }
      if (char === '/' && BEFORE_REGEX.test(source.slice(Math.max(0, index - 10), index))) {
        // Une expression régulière : jusqu'à la barre oblique qui la ferme, hors d'une classe [ ].
        let end = index + 1;
        let inClass = false;
        while (end < source.length && (inClass || source[end] !== '/')) {
          if (source[end] === '\\') end++;
          else if (source[end] === '[') inClass = true;
          else if (source[end] === ']') inClass = false;
          end++;
        }
        index = end + 1;
        continue;
      }
      if (untilBrace) {
        if (char === '{') depth++;
        else if (char === '}') {
          if (depth === 0) return index + 1;
          depth--;
        }
      }
      index++;
    }
    return index;
  };

  scan(0, false);
  return strings.map((text) => text.replace(/\s+/g, ' ').trim()).filter((text) => /\p{L}|!/u.test(text));
}

/** Les titres de toutes les routes, enfants compris. */
function routeTitles(list: Route[]): string[] {
  return list.flatMap((route) => [
    ...(typeof route.title === 'string' ? [route.title] : []),
    ...routeTitles(route.children ?? []),
  ]);
}

/** Les mots hors de la voix, vus par Empreinte (motsAEviter) et par Apex (voiceIssues). */
function issuesOf({ file, text }: Found): string[] {
  const issues = [
    ...motsAEviter(text).map(({ mot }) => `motsAEviter : ${mot}`),
    ...voiceIssues(text).map((mot) => `voiceIssues : ${mot}`),
  ];
  return issues.map((issue) => `${file} : « ${text} » → ${issue}`);
}

describe('la voix de tout src/app', () => {
  const templates = filesUnder(APP_DIR, '.html');
  const components = filesUnder(APP_DIR, '.ts').filter((path) => !path.endsWith('.spec.ts'));
  const found: Found[] = [
    ...templates.flatMap((path) =>
      templateTexts(readFileSync(path, 'utf8')).map((text) => ({ file: relative(APP_DIR, path), text })),
    ),
    ...components.flatMap((path) =>
      codeStrings(readFileSync(path, 'utf8')).map((text) => ({ file: relative(APP_DIR, path), text })),
    ),
    ...routeTitles(routes).map((text) => ({ file: 'app.routes.ts (title)', text })),
  ];
  const texts = found.map(({ text }) => text);

  it('lit tous les gabarits et tous les composants', () => {
    expect(templates.length).toBeGreaterThanOrEqual(12);
    expect(components.length).toBeGreaterThanOrEqual(20);
    // Un texte de chaque sorte, pour être sûr que l'extraction ne laisse rien filer
    const samples = [
      'Mes objectifs', // texte d'un gabarit
      'Aller au contenu', // texte de la coque
      "Légende de l'arête", // aria-label
      'Réponds à Akari…', // placeholder
      'Déplacer «', // chaîne d'un [libelle] lié
      "Je m'y engage", // bouton sceau du nouvel objectif
      'Objectifs · Apex', // titre de route
    ];
    expect(samples.filter((sample) => !texts.includes(sample))).toEqual([]);
    expect(routeTitles(routes).length).toBeGreaterThanOrEqual(6);
  });

  it('parle dans la voix d’Empreinte : motsAEviter() et voiceIssues() ne trouvent rien', () => {
    expect(found.flatMap(issuesOf)).toEqual([]);
  });
});

describe('l’extraction des textes', () => {
  it('voit le texte, les interpolations et les attributs lisibles d’un gabarit, pas les conditions', () => {
    const texts = templateTexts(`
      <!-- Un commentaire : supprimer ceci -->
      @if (!pret() && total > 3) {
        <p class="corps">Une erreur est survenue&nbsp;!</p>
      } @else {
        <button eBouton aria-label="Supprimer" [attr.title]="'Raté, ' + nom">{{ ouvert ? 'Fermer' : 'Tâche manquée' }}</button>
      }
      @let reste = total - faits;
      <e-champ libelle="Ton adresse" [aide]="n > 1 ? 'Il te reste 40 %' : ''" (click)="choisir('perdu')" />
    `);
    expect(texts).toEqual(
      expect.arrayContaining(['Une erreur est survenue !', 'Supprimer', 'Raté,', 'Fermer', 'Tâche manquée', 'Ton adresse', 'Il te reste 40 %']),
    );
    expect(texts.join(' ')).not.toMatch(/supprimer ceci|pret|total|reste =|perdu/);
    expect(texts.flatMap((text) => voiceIssues(text))).toEqual(
      expect.arrayContaining(['erreur', "point d'exclamation", 'supprimer', 'raté', 'manqué', 'il te reste', 'pourcentage']),
    );
  });

  it('voit les chaînes d’un composant, pas les imports, les sélecteurs, les commentaires ni les expressions régulières', () => {
    const strings = codeStrings(`
      import { X } from '@empreinte-studio/angular';
      // Supprimer : un commentaire
      @Component({ selector: 'app-x', templateUrl: './x.html' })
      export class X {
        readonly motif = /l'erreur "!"/u;
        readonly texte = \`Un \${compter(n, 'pas', 'pas')} de plus !\`;
        readonly phrase = "Je n'ai pas pu enregistrer ce pas.";
        lire() { console.error('Erreur technique'); return a / b / c; }
      }
    `);
    expect(strings).toEqual(expect.arrayContaining(["Je n'ai pas pu enregistrer ce pas.", 'pas', 'Un de plus !']));
    expect(strings.join(' ')).not.toMatch(/empreinte-studio|app-x|x\.html|Supprimer|l'erreur|Erreur technique/);
  });
});
