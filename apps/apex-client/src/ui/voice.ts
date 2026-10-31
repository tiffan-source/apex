/*
 * La voix d'Apex : compter, dire une progression par ce qui est fait, repérer les mots à éviter.
 * Reprend le comportement des fonctions de voix d'Empreinte (tutoiement, jamais d'échec ni de pourcentage).
 */

/** Une unité comptée : singulier, pluriel, et son genre pour les accords (« fait » / « faite »). */
export interface Unite {
  singulier: string;
  pluriel: string;
  feminin: boolean;
}

export const UNITES = {
  pas: { singulier: 'pas', pluriel: 'pas', feminin: false },
  etape: { singulier: 'étape', pluriel: 'étapes', feminin: true },
  tache: { singulier: 'tâche', pluriel: 'tâches', feminin: true },
  empreinte: { singulier: 'empreinte', pluriel: 'empreintes', feminin: true },
} as const satisfies Record<string, Unite>;

export type NomUnite = keyof typeof UNITES;

/** Ce qui est fait, ce qui est en cours (0 ou 1), ce qui vient ensuite (sans celui en cours). */
export interface Progression {
  faits: number;
  enCours?: number | boolean;
  aVenir: number;
}

export interface OptionsLegende {
  unite?: NomUnite | Unite;
  nomEnCours?: string;
  accompli?: string;
}

/** « 0 tâche », « 1 tâche », « 3 tâches » ; donner le pluriel des mots invariables (`compter(2, 'pas', 'pas')`). */
export function compter(n: number, singulier: string, pluriel = `${singulier}s`): string {
  return `${n} ${n > 1 ? pluriel : singulier}`;
}

function unite(u: NomUnite | Unite | undefined): Unite {
  if (!u) return UNITES.pas;
  return typeof u === 'string' ? UNITES[u] : u;
}

function fait(n: number, u: Unite): string {
  return (u.feminin ? 'faite' : 'fait') + (n > 1 ? 's' : '');
}

function premier(u: Unite): string {
  return `${u.feminin ? 'Première' : 'Premier'} ${u.singulier}`;
}

function enCoursDe(p: Progression): number {
  return p.enCours === true ? 1 : p.enCours ? Math.min(1, Number(p.enCours)) : 0;
}

/**
 * La légende d'une progression, qui commence toujours par ce qui est fait :
 * « 4 pas faits · 3 à venir », « Premier pas en cours · 5 à venir », « 2 étapes faites · Endurance en cours ».
 */
export function legendeProgression(p: Progression, options: OptionsLegende = {}): string {
  const u = unite(options.unite);
  const faits = p.faits;
  const enCours = enCoursDe(p);
  const aVenir = p.aVenir;
  const accompli = options.accompli ?? 'étape accomplie';

  if (faits === 0 && enCours === 0 && aVenir === 0) return '';

  if (enCours && options.nomEnCours) {
    if (faits > 0) return `${compter(faits, u.singulier, u.pluriel)} ${fait(faits, u)} · ${options.nomEnCours} en cours`;
    return aVenir > 0
      ? `${options.nomEnCours} en cours · ${compter(aVenir, u.singulier, u.pluriel)} à venir`
      : `${options.nomEnCours} en cours`;
  }

  if (faits > 0) {
    const reste = enCours + aVenir;
    const tete = `${compter(faits, u.singulier, u.pluriel)} ${fait(faits, u)}`;
    return reste > 0 ? `${tete} · ${reste} à venir` : `${tete} · ${accompli}`;
  }

  if (enCours) return aVenir > 0 ? `${premier(u)} en cours · ${aVenir} à venir` : `${premier(u)} en cours`;
  return `${compter(aVenir, u.singulier, u.pluriel)} à venir`;
}

/** Le nom accessible d'une progression : « 4 pas faits, 1 en cours, 2 à venir ». */
export function descriptionProgression(p: Progression, nom: NomUnite | Unite = 'pas'): string {
  const u = unite(nom);
  const faits = p.faits;
  const enCours = enCoursDe(p);
  const aVenir = p.aVenir;
  if (faits === 0 && enCours === 0 && aVenir === 0) return '';
  if (faits > 0 && enCours === 0 && aVenir === 0) return `${compter(faits, u.singulier, u.pluriel)} ${fait(faits, u)}, tout est fait`;
  const parts: string[] = [];
  if (faits > 0) parts.push(`${compter(faits, u.singulier, u.pluriel)} ${fait(faits, u)}`);
  if (enCours) parts.push(faits > 0 ? '1 en cours' : `${premier(u)} en cours`);
  if (aVenir > 0) parts.push(parts.length ? `${aVenir} à venir` : `${compter(aVenir, u.singulier, u.pluriel)} à venir`);
  return parts.join(', ');
}

/** Un mot hors de la voix, et ce qu'on dit à la place. */
export interface MotAEviter {
  mot: string;
  plutot: string;
}

/* Frontières de mot Unicode : \b ne voit pas une lettre accentuée (« échec », « raté »). */
export const LEXIQUE: readonly { motif: RegExp; mot: string; plutot: string }[] = [
  { motif: /(?<!\p{L})(échec|échou)/iu, mot: 'échec', plutot: 'Dis ce qui est fait, puis ce qui vient.' },
  { motif: /(?<!\p{L})rat(é|ée|és|ées)(?!\p{L})/iu, mot: 'raté', plutot: 'On le replace ?' },
  { motif: /(?<!\p{L})manqu(é|ée|és|ées)(?!\p{L})/iu, mot: 'manqué', plutot: 'On le replace ?' },
  { motif: /(?<!\p{L})en retard(?!\p{L})/iu, mot: 'en retard', plutot: 'T’attend depuis mardi' },
  { motif: /(?<!\p{L})perdu(e|s|es)?(?!\p{L})/iu, mot: 'perdu', plutot: 'En pause' },
  { motif: /(?<!\p{L})supprim/iu, mot: 'supprimer', plutot: 'Laisser filer' },
  { motif: /(?<!\p{L})il te reste(?!\p{L})/iu, mot: 'il te reste', plutot: '4 pas faits · 3 à venir' },
  { motif: /\d+\s*%/u, mot: 'pourcentage', plutot: '4 pas faits · 3 à venir' },
  { motif: /!/u, mot: "point d'exclamation", plutot: 'Une phrase calme, avec un point.' },
  { motif: /(?<!\p{L})ne lâche rien(?!\p{L})/iu, mot: 'ne lâche rien', plutot: 'Un pas à la fois.' },
];

/** Les mots d'un texte qui sortent de la voix d'Apex (vide : le texte parle juste). */
export function motsAEviter(texte: string): MotAEviter[] {
  return LEXIQUE.filter(({ motif }) => motif.test(texte)).map(({ mot, plutot }) => ({ mot, plutot }));
}
