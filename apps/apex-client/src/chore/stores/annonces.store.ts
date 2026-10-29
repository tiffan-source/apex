import { computed, inject } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

/*
 * Ce qui remplace les toasts (cahier de migration, § 7). Rien ne surgit dans Empreinte :
 *  - annoncer(texte) : une réussite, dite aux lecteurs d'écran par le LiveAnnouncer du CDK
 *    (politesse « polite »), sans rien afficher ;
 *  - signaler(texte) : quelque chose n'a pas marché. Le texte reste dans l'état jusqu'à
 *    compris() ; la coque l'affiche dans un aside[eNote] signé Akari, avec un bouton « Compris »,
 *    et il est annoncé tout de suite (politesse « assertive »).
 */

export type AnnoncesState = {
  /** Le signalement en cours, affiché par la coque, ou null. */
  signalement: string | null;
};

const initialState: AnnoncesState = {
  signalement: null,
};

export const AnnoncesStore = signalStore(
  { providedIn: 'root' },
  withState<AnnoncesState>(initialState),
  withComputed(({ signalement }) => ({
    /** Vrai quand la coque doit afficher la note. */
    aUnSignalement: computed(() => signalement() !== null),
  })),
  withMethods((store, liveAnnouncer = inject(LiveAnnouncer)) => ({
    /** Une réussite : annoncée aux lecteurs d'écran, rien n'est affiché. */
    annoncer(texte: string): void {
      const phrase = texte.trim();
      if (!phrase) return;
      void liveAnnouncer.announce(phrase, 'polite');
    },
    /**
     * Quelque chose n'a pas marché : gardé pour la coque et annoncé sans attendre. La même phrase, encore
     * affichée, n'est pas réannoncée (sans connexion, plusieurs gestes de la file échouent à la suite).
     */
    signaler(texte: string): void {
      const phrase = texte.trim();
      if (!phrase || store.signalement() === phrase) return;
      patchState(store, { signalement: phrase });
      void liveAnnouncer.announce(phrase, 'assertive');
    },
    /** La personne a lu le signalement : la note disparaît. */
    compris(): void {
      patchState(store, { signalement: null });
    },
    /** Le souci signalé est levé (le serveur répond de nouveau…) : sa note disparaît, si c'est encore elle. */
    retirer(texte: string): void {
      if (store.signalement() === texte.trim()) patchState(store, { signalement: null });
    },
  })),
);
