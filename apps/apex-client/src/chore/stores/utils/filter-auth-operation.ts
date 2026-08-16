import { Signal } from "@angular/core";
import { filter, map, OperatorFunction, pipe } from "rxjs";

export function withOwnerId<T>(
  currentUserId: Signal<string | null>,
  onMissingOwner: () => void = () => console.warn('Action annulée : utilisateur non authentifié')
): OperatorFunction<T, T & { ownerId: string }> {
  return pipe(
    map((data) => ({ ...data, ownerId: currentUserId() })),
    filter((data): data is T & { ownerId: string } => {
      if (data.ownerId === null) {
        onMissingOwner();
        return false;
      }
      return true;
    })
  );
}
