/** Une réplique de la conversation avec Akari, prête pour l'écran. */
export type MessageViewModel = {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

/**
 * Ce qu'Akari demande la permission de faire, tiré de l'outil en attente du workflow :
 * ajouter une étape (sous-objectif), ajouter un pas (tâche), ou une autre action.
 */
export type PermissionRequestViewModel =
  | {
      kind: 'stage';
      /** Le nom de l'étape proposée. */
      title: string;
      /** L'objectif (ou l'étape) sous lequel elle serait rangée. */
      parentId: string | null;
    }
  | {
      kind: 'task';
      /** L'intitulé du pas proposé. */
      title: string;
      /** L'étape (ou l'objectif) qui recevrait le pas. */
      objectiveId: string | null;
    }
  | { kind: 'other' };
