import type { WorkflowActivity, WorkflowActivityStep } from "../../../chore/api/api.models";

/*
 * Ce que fait Akari pendant un tour, tel que l'écran le dit : une phrase par code de l'API pour la ligne d'état
 * et une pour le journal. Ces codes ne disent rien de la machine du workflow, ni de l'IA, ni de ses outils.
 */

/** Ce que fait Akari pendant un tour, dit dans la ligne d'état (voix d'Empreinte, sans jargon). */
export const AKARI_STATUS = {
  "saving-message": "Akari note ton message…",
  thinking: "Akari réfléchit…",
  "checking-permission": "Akari vérifie s'il lui faut ton accord…",
  // La ligne d'état dit « Akari attend ton accord. » tant qu'il l'attend : cette phrase vaut pour le court
  // moment où la réponse de la personne est partie et où le serveur ne l'a pas encore rendue.
  "awaiting-permission": "Akari reçoit ta réponse…",
  reading: "Akari regarde ton objectif…",
  writing: "Akari ajoute ce que tu as accepté…",
  reviewing: "Akari fait le point…",
  "saving-reply": "Akari écrit sa réponse…",
} as const satisfies Record<WorkflowActivityStep, string>;

/** L'état par défaut, pour une étape du workflow sans phrase à elle. */
export const AKARI_THINKING = AKARI_STATUS.thinking;

/** Après ce délai sur un même appel à l'IA, la ligne d'état dit qu'Akari y est encore. */
export const AKARI_LONG_WAIT_MS = 15_000;
/** Après ce délai, elle dit que c'est inhabituel. */
export const AKARI_VERY_LONG_WAIT_MS = 45_000;

export const AKARI_STILL_THINKING = "Akari réfléchit encore…";
export const AKARI_TAKING_LONGER = "C'est plus long que d'habitude. Akari réfléchit encore…";

/**
 * Ce qu'Akari a déjà fait pendant un tour : le journal, écrit par lui au-dessus de la ligne d'état. Une ligne dit
 * qu'une étape a eu lieu, pas ce qu'elle a donné : une écriture peut être refusée par le serveur. Le résultat se
 * lit dans la réponse d'Akari et sur l'arête.
 */
export const AKARI_JOURNAL = {
  "saving-message": "J'ai noté ton message.",
  thinking: "J'ai réfléchi à ta demande.",
  "checking-permission": "J'ai vérifié s'il me fallait ton accord.",
  "awaiting-permission": "J'ai demandé ton accord.",
  reading: "J'ai regardé ton objectif.",
  writing: "J'ai pris en compte ton accord.",
  reviewing: "J'ai fait le point.",
  "saving-reply": "J'ai écrit ma réponse.",
} as const satisfies Record<WorkflowActivityStep, string>;

/** Les dernières lignes du journal : un long tour ne repousse pas la conversation hors de l'écran. */
export const AKARI_JOURNAL_LINES = 5;

/**
 * La ligne d'état d'un tour en cours. Les appels à l'IA sont les seules étapes qui durent : quand l'attente
 * s'allonge, la phrase le dit, pour qu'une longue réflexion ne ressemble pas à un écran figé.
 */
export function akariStatusLine(activity: WorkflowActivity | null): string {
  if (!activity) return AKARI_THINKING;
  const { step, elapsedMs, round } = activity;

  if (step === "thinking" || step === "reviewing") {
    if (elapsedMs >= AKARI_VERY_LONG_WAIT_MS) return AKARI_TAKING_LONGER;
    if (elapsedMs >= AKARI_LONG_WAIT_MS) return AKARI_STILL_THINKING;
  }
  if (step === "reviewing" && round > 1) return `Akari fait le point, ${round}e tour…`;

  return (AKARI_STATUS as Record<string, string>)[step] ?? AKARI_THINKING;
}

/** Les lignes du journal d'un tour en cours. Un code inconnu de ce client n'y paraît pas. */
export function akariJournal(activity: WorkflowActivity | null): string[] {
  return (activity?.done ?? [])
    .map((step) => (AKARI_JOURNAL as Record<string, string>)[step])
    .filter(Boolean)
    .slice(-AKARI_JOURNAL_LINES);
}
