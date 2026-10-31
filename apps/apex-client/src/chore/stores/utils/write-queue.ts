import { Injectable, inject } from "@angular/core";
import { ApiError } from "../../api/api-error";
import { SessionStore } from "../session.store";

/**
 * La file des écritures d'ObjectiveStore.
 *
 * - Les écritures partent une par une, dans l'ordre des gestes : les cas d'usage du domaine relisent puis
 *   réenregistrent un objectif entier, deux écritures simultanées pourraient s'écraser en base.
 * - Aucune réponse n'est perdue : chaque geste reçoit la sienne (id définitif, retour en arrière, annonce).
 * - Un geste fait sur un élément optimiste (id temporaire) part avec l'id définitif : sa création passe
 *   avant lui dans la file, et link() retient la correspondance que resolve() retrouve.
 * - Le chargement des objectifs (loadObjectives) y prend place lui aussi : il lit la base après les écritures
 *   déjà parties. Un geste fait pendant qu'il attend n'est écrit qu'après sa lecture : une création garde son
 *   élément optimiste (keepOptimistic), et un rechargement voit par `enqueued` qu'un geste est passé derrière
 *   lui, et relit la base au lieu de l'effacer de l'écran.
 * - Une écriture part pour la personne qui a fait le geste : si une autre s'est connectée entre-temps (dans
 *   un autre onglet), elle ne part pas (UNAUTHENTICATED, « Ta session a pris fin »), plutôt que d'aller dans
 *   le compte de cette autre personne.
 */
@Injectable({ providedIn: 'root' })
export class WriteQueue {
  private readonly session = inject(SessionStore);
  private tail: Promise<unknown> = Promise.resolve();
  private readonly realIds = new Map<string, string>();
  private count = 0;

  /** Le nombre d'écritures (et de lectures) mises dans la file depuis le début : il change à chaque run(). */
  get enqueued(): number {
    return this.count;
  }

  /** Lance l'écriture après les précédentes, qu'elles aient abouti ou non, si la personne du geste est encore là. */
  run<T>(write: () => Promise<T>): Promise<T> {
    this.count++;
    const owner = this.session.currentUserId();
    const result = this.tail.then(() => {
      if (this.session.currentUserId() !== owner) {
        throw new ApiError('UNAUTHENTICATED', 401, 'The signed-in person changed before this write was sent.');
      }
      return write();
    });
    this.tail = result.catch(() => undefined);
    return result;
  }

  /** Retient l'id définitif d'un élément créé avec un id temporaire. */
  link(temporaryId: string, realId: string): void {
    this.realIds.set(temporaryId, realId);
  }

  /** L'id définitif d'un élément s'il est connu, sinon l'id tel quel. */
  resolve(id: string): string {
    return this.realIds.get(id) ?? id;
  }
}
