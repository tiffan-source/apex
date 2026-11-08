import { inject } from "@angular/core";
import { signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { errorCodeOf, isUnknownOutcome } from "../../api/api-error";
import { failureReport, type FailedAction } from "../../constants/messages.constante";
import { AnnoncesStore } from "../annonces.store";
import { SessionStore } from "../session.store";
import { isTemporaryId } from "./map-optimistique-id";
import { WriteQueue } from "./write-queue";

/*
 * L'écriture optimiste (GLOSSARY.md) : un geste prend effet à l'écran tout de suite, puis ses commandes partent
 * dans la file d'écritures, l'une après l'autre. Chacune est acceptée (l'élément prend ce que l'API rend) ou
 * revient en arrière seule (ADR 0001 : pas de relecture après un geste accepté).
 *
 * Ce module tient tout le cycle, pour chaque geste du store :
 *  - sans session, rien ne change ni ne part ;
 *  - un geste qui vise un élément pas encore enregistré (id temporaire) ne change rien et ne part pas : aucun
 *    geste ne vise un élément qui porte un id temporaire ;
 *  - un 404 retire de l'écran ce qui n'existe plus (`forget`), sans retour en arrière ni relecture ;
 *  - un refus fait revenir la commande en arrière, et une seule note dit le refus du geste ;
 *  - sans réponse claire (pas de réponse, 5xx), l'API a pu faire le travail : l'arbre est relu, une fois par geste ;
 *  - un geste dont toutes les commandes sont acceptées s'annonce.
 *
 * L'issue revient à la fonctionnalité du store qui a lancé le geste, jamais à l'écran : le store décide de la suite.
 */

/** Une commande d'un geste : ce qui part vers l'API, et ce que l'écran en fait. */
export type WriteCommand<T = unknown> = {
  /** Appelée dans la file d'écritures, à son tour. */
  send: () => Promise<T>;
  /** L'API accepte : l'élément prend ce qu'elle rend. */
  accept?: (saved: T) => void;
  /**
   * L'API refuse : ce que la commande a changé revient en arrière. Rend faux si rien n'est revenu à l'écran (son
   * parent est parti entre-temps) : il n'y a alors rien à dire.
   */
  rollBack?: (code: string | undefined) => boolean | void;
  /**
   * L'API ne connaît plus l'élément visé ou son parent (404) : retire de l'écran ce qui n'existe plus, et rend vrai.
   * Rend faux pour un code qui ne la concerne pas (il est traité comme un refus).
   */
  forget?: (code: string) => boolean;
};

/** Un geste de la personne. */
export type Gesture = {
  /** Le geste, pour la phrase qui dit son refus (`failureReport`). */
  action: FailedAction;
  /** Les éléments que le geste vise ou traverse (lui, son parent, l'étape où va un pas…) : tous enregistrés. */
  targets: readonly (string | null | undefined)[];
  /** L'effet du geste à l'écran, tout de suite. */
  apply?: () => void;
  /** Ses commandes, dans l'ordre ; au moins une. */
  commands: readonly WriteCommand<any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  /** Ce qui s'annonce quand toutes ses commandes sont acceptées. */
  success?: string;
};

/** L'issue d'un geste, pour le store qui l'a lancé. */
export type WriteOutcome =
  /** Toutes ses commandes sont acceptées ; `saved` : ce que l'API a rendu pour chacune. */
  | { status: 'accepted'; saved: unknown[] }
  /** Au moins une commande n'est pas passée ; `code` : le code de la première. */
  | { status: 'refused'; code: string | undefined }
  /** Rien n'est parti : personne n'est connecté, ou un élément visé n'est pas encore enregistré. */
  | { status: 'skipped' };

/**
 * Donne au store `_write(geste)`, privé : le cycle entier d'une écriture optimiste. À placer après la
 * fonctionnalité qui fournit `loadObjectives`.
 */
export function withOptimisticWrites() {
  return signalStoreFeature(
    { methods: type<{ loadObjectives: () => unknown }>() },
    withMethods((
      store,
      writes = inject(WriteQueue),
      session = inject(SessionStore),
      annonces = inject(AnnoncesStore),
    ) => ({
      async _write(gesture: Gesture): Promise<WriteOutcome> {
        if (!session.isAuthenticated()) {
          console.warn('Geste ignoré : personne n’est connecté.');
          return { status: 'skipped' };
        }
        if (gesture.targets.some(isTemporaryId)) {
          console.warn('Geste ignoré : il vise un élément pas encore enregistré.');
          return { status: 'skipped' };
        }
        gesture.apply?.();

        // Les commandes entrent dans la file tout de suite, dans l'ordre : un geste fait juste après passe derrière.
        const results = await Promise.all(
          gesture.commands.map((command) =>
            writes.run(command.send).then(
              (saved) => {
                command.accept?.(saved);
                return { accepted: true as const, saved };
              },
              (error: unknown) => {
                console.error(error);
                const code = errorCodeOf(error);
                const forgotten = command.forget?.(code ?? '') ?? false;
                // Ce qui n'existe plus quitte l'écran ; le reste revient en arrière, s'il a encore où revenir.
                const shown = forgotten || command.rollBack?.(code) !== false;
                // La même phrase n'est dite qu'une fois (AnnoncesStore) : une seule note pour le geste.
                if (shown) annonces.signaler(failureReport(gesture.action, code));
                return { accepted: false as const, code, reread: !forgotten && isUnknownOutcome(error) };
              },
            ),
          ),
        );

        if (results.some((result) => !result.accepted && result.reread)) store.loadObjectives();
        const firstRefusal = results.find((result) => !result.accepted);
        if (firstRefusal && !firstRefusal.accepted) return { status: 'refused', code: firstRefusal.code };
        if (gesture.success) annonces.annoncer(gesture.success);
        return { status: 'accepted', saved: results.map((result) => (result.accepted ? result.saved : undefined)) };
      },
    })),
  );
}
