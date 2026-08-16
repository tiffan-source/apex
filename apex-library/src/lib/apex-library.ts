export enum EisenhowerCategory {
  DO = 'Faire',
  SCHEDULE = 'Planifier',
  DELEGATE = 'Déléguer',
  DELETE = 'Supprimer',
}

export class ApexLibsMetier {
  public static getEisenhowerCategory(input: {
    importance: number;
    urgency: number;
  }): EisenhowerCategory {
    if (input.importance >= 3 && input.urgency >= 3) {
      return EisenhowerCategory.DO;
    }

    if (input.importance >= 3 && input.urgency < 3) {
      return EisenhowerCategory.SCHEDULE;
    }

    if (input.importance < 3 && input.urgency >= 3) {
      return EisenhowerCategory.DELEGATE;
    }

    return EisenhowerCategory.DELETE;
  }
}
