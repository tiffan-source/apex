import { computed, inject } from "@angular/core";
import { ActivatedRoute, NavigationEnd, Router } from "@angular/router";
import { patchState, signalStore, withComputed, withMethods, withState } from "@ngrx/signals";
import { toSignal } from "@angular/core/rxjs-interop"
import { filter } from "rxjs";

export type ChatDrawerState = {
  isOpen: boolean;
};

const initialState: ChatDrawerState = {
  isOpen: false,
};

export const ChatDrawerStore = signalStore(
  withState<ChatDrawerState>(initialState),
  withComputed(() => {
    const router = inject(Router);

    const navigation = toSignal(
      router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ),
      { initialValue: null }
    );

    return {
      canBeActivated: computed(() => {
        // Make the computed depend on navigation
        navigation();

        const segments = router.url.split("/").filter(Boolean);

        return (
          segments.length === 2 &&
          segments[0] === "objective" &&
          segments[1].length > 0
        );
      }),
    };
  }),

  withMethods((state) => ({
    openDrawer() {
      patchState(state, { isOpen: true });
    },
    closeDrawer() {
      patchState(state, { isOpen: false });
    }
  }))
);
