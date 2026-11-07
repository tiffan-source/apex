import { VOIX_EFFACEMENT } from '@empreinte-studio/angular/core';

/*
 * Les mots de l'effacement propres à Apex : ce qu'une étape ou un objectif emporte avec lui (ses pas, ses étapes, la
 * conversation avec Akari). Les mots communs (« Effacer », « Remettre », « Ça ne se récupère pas. ») viennent de la
 * voix d'Empreinte (VOIX_EFFACEMENT). On efface, on ne « supprime » jamais.
 *
 * Effacer a trois poids, comme dans la maquette « Effacer » :
 * - un pas part tout de suite, et sa trace laisse le temps de le remettre ;
 * - une étape part après une validation sur place, qui dit ce qu'elle emporte ;
 * - un objectif part depuis le pied de la feuille qui le modifie, quand on a réécrit son nom.
 */

/** Ce qu'on compte dans ce qui part : tous les pas, dont ceux qui sont faits. */
export type ErasedTasks = {
  readonly done: number;
  readonly total: number;
};

export const STAGE_ERASURE = {
  /** Le geste discret, au pied de l'étape ouverte. */
  ask: "Effacer l'étape",
  question: 'Effacer cette étape de ton plan ?',
  confirm: "Effacer l'étape",
  keep: "Garder l'étape",
} as const;

export const OBJECTIVE_ERASURE = {
  /** La sortie discrète, au pied de la feuille « Modifier l'objectif ». */
  exitQuestion: "Cet objectif n'a plus sa place ?",
  ask: "Effacer l'objectif",
  question: 'Effacer cet objectif ?',
  confirm: "Effacer l'objectif",
  keep: "Garder l'objectif",
} as const;

/** « fait » ou « faits ». */
const done = (count: number) => (count >= 2 ? 'faits' : 'fait');

/**
 * Ce que l'effacement d'une étape emporte, pour sa validation :
 * « Elle emporte ses 7 pas, dont 4 faits. Ton arête passe de 6 à 5 étapes. Ça ne se récupère pas. »
 *
 * `stageCount` est le nombre d'étapes de l'arête, celle qui part comprise.
 */
export function stageErasureText(tasks: ErasedTasks, stageCount: number): string {
  const sentences: string[] = [];
  if (tasks.total === 1) {
    sentences.push(tasks.done === 1 ? 'Elle emporte son pas, déjà fait.' : 'Elle emporte son pas.');
  } else if (tasks.total >= 2) {
    sentences.push(
      tasks.done > 0
        ? `Elle emporte ses ${tasks.total} pas, dont ${tasks.done} ${done(tasks.done)}.`
        : `Elle emporte ses ${tasks.total} pas.`,
    );
  }
  const left = Math.max(0, stageCount - 1);
  sentences.push(
    left === 0
      ? "Ton arête n'aura plus d'étape."
      : `Ton arête passe de ${stageCount} à ${left} ${left >= 2 ? 'étapes' : 'étape'}.`,
  );
  sentences.push(VOIX_EFFACEMENT.sansRetour);
  return sentences.join(' ');
}

/**
 * Ce que l'effacement d'un objectif emporte, pour sa feuille de confirmation :
 * « Ses 6 étapes, ses 21 pas dont 9 faits et ta conversation avec Akari partent avec lui. Ça ne se récupère pas. »
 */
export function objectiveErasureText(stageCount: number, tasks: ErasedTasks): string {
  const parts: string[] = [];
  if (stageCount === 1) parts.push('son étape');
  else if (stageCount >= 2) parts.push(`ses ${stageCount} étapes`);
  if (tasks.total === 1) parts.push('son pas');
  else if (tasks.total >= 2) {
    parts.push(tasks.done > 0 ? `ses ${tasks.total} pas dont ${tasks.done} ${done(tasks.done)}` : `ses ${tasks.total} pas`);
  }
  parts.push('ta conversation avec Akari');

  const listed = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}`;
  const verb = parts.length === 1 ? 'part' : 'partent';
  return `${listed.charAt(0).toUpperCase()}${listed.slice(1)} ${verb} avec lui. ${VOIX_EFFACEMENT.sansRetour}`;
}
