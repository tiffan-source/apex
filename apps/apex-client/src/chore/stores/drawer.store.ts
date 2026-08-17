import { computed, inject } from "@angular/core";
import { NavigationEnd, Router } from "@angular/router";
import { patchState, signalStore, withComputed, withMethods, withState } from "@ngrx/signals";
import { toSignal } from "@angular/core/rxjs-interop"
import { filter } from "rxjs";

export type DrawerState = {
  chat : {
    isOpen: boolean;
  }
  objectiveEdition : {
    isOpen: boolean;
  }
};

const initialState: DrawerState = {
  chat: {
    isOpen: false
  },
  objectiveEdition: {
    isOpen: false
  }
};

export const DrawerStore = signalStore(
  withState<DrawerState>(initialState),
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
    openChatDrawer() {
      patchState(state, { chat: { isOpen: true } });
    },
    closeChatDrawer() {
      patchState(state, { chat: { isOpen: false } });
    },
    openObjectiveEditionDrawer() {
      patchState(state, { objectiveEdition: { isOpen: true } });
    },
    closeObjectiveEditionDrawer() {
      patchState(state, { objectiveEdition: { isOpen: false } });
    },
  }))
);
