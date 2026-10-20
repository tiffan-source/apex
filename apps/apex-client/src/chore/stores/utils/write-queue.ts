import { Injectable } from "@angular/core";

/**
 * La file des écritures d'ObjectiveStore.
 *
 * - Les écritures partent une par une, dans l'ordre des gestes : les cas d'usage du domaine relisent puis
 *   réenregistrent un objectif entier, deux écritures simultanées pourraient s'écraser en base.
 * - Aucune réponse n'est perdue : chaque geste reçoit la sienne (id définitif, retour en arrière, annonce).
 * - Un geste fait sur un élément optimiste (id temporaire) part avec l'id définitif : sa création passe
 *   avant lui dans la file, et link() retient la correspondance que resolve() retrouve.
 */
@Injectable({ providedIn: 'root' })
export class WriteQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private readonly realIds = new Map<string, string>();

  /** Lance l'écriture après les précédentes, qu'elles aient abouti ou non. */
  run<T>(write: () => Promise<T>): Promise<T> {
    const result = this.tail.then(() => write());
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
