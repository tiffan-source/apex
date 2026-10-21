import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, viewChild } from '@angular/core';
import { isActive, type IsActiveMatchOptions, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { EBouton } from '@empreinte-studio/angular/bouton';
import { type PreferenceTheme, Theme } from '@empreinte-studio/angular/core';
import { type ElementMenu, EMenu } from '@empreinte-studio/angular/menu';
import {
  ECoque,
  ECoqueContenu,
  ECoquePrincipal,
  ELienNav,
  EMarque,
  ENav,
  ENavBas,
  ENavListe,
} from '@empreinte-studio/angular/navigation';
import { ENote, ENoteActions } from '@empreinte-studio/angular/note';
import { AnnoncesStore } from '../../chore/stores/annonces.store';
import { ObjectiveStore } from '../../chore/stores/objective.store';
import { SessionStore } from '../../chore/stores/session.store';

/** Les choix du menu « Réglages » (cahier, § 8). */
export const THEME_CHOICES: readonly { readonly valeur: PreferenceTheme; readonly libelle: string }[] = [
  { valeur: 'jour', libelle: 'Thème Jour' },
  { valeur: 'nuit', libelle: 'Thème Nuit' },
  { valeur: 'systeme', libelle: "Comme l'appareil" },
];

/** Ce qui suit le libellé de l'entrée retenue, pour qu'elle se lise (e-menu ne marque pas son choix). */
export const CHOSEN_SUFFIX = ' · choisi';

/** Ce qui est dit aux lecteurs d'écran quand le thème change (rien ne s'affiche). */
export const THEME_ANNOUNCEMENTS: Readonly<Record<PreferenceTheme, string>> = {
  jour: 'Thème Jour choisi.',
  nuit: 'Thème Nuit choisi.',
  systeme: 'Le thème suit ton appareil.',
};

/** Comparaison des chemins seulement : ni les paramètres de requête ni le fragment ne changent l'entrée courante. */
const PATHS_ONLY: Partial<IsActiveMatchOptions> = { queryParams: 'ignored', matrixParams: 'ignored', fragment: 'ignored' };

/**
 * La coque d'Apex : la navigation (Objectifs, Matrice ; en bas, la personne et ses réglages) et la page.
 * Elle affiche en haut du contenu ce qui n'a pas marché (AnnoncesStore.signaler), dans une note d'Akari.
 * ObjectiveStore est fourni ici : tous les écrans de la coque partagent les mêmes objectifs.
 */
@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ECoque,
    ECoquePrincipal,
    ECoqueContenu,
    ENav,
    ENavListe,
    ENavBas,
    ELienNav,
    EMarque,
    EMenu,
    ENote,
    ENoteActions,
    EBouton,
  ],
  templateUrl: './shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ObjectiveStore],
})
export class Shell {
  protected readonly annonces = inject(AnnoncesStore);
  private readonly session = inject(SessionStore);
  private readonly theme = inject(Theme);
  private readonly router = inject(Router);

  private readonly content = viewChild.required<ElementRef<HTMLElement>>('contenu');

  /*
   * « Objectifs » est l'entrée courante sur l'accueil (« / », exactement : sinon elle le serait partout)
   * et sur les pages d'un objectif (/objectifs/…), comme dans les maquettes Arête et Akari.
   * routerLinkActive ne sait pas dire « / exactement, ou sous /objectifs » : on lit le routeur.
   * La corne d'Empreinte n'est dessinée que pour aria-current="page".
   */
  private readonly onHome = isActive('/', this.router, { ...PATHS_ONLY, paths: 'exact' });
  private readonly inObjectives = isActive('/objectifs', this.router, { ...PATHS_ONLY, paths: 'subset' });
  protected readonly objectivesCurrent = computed(() => (this.onHome() || this.inObjectives() ? 'page' : null));

  /** Le nom de la personne, sinon son adresse. */
  protected readonly identity = computed(() => {
    const user = this.session.currentUser();
    return (user?.name ?? '').trim() || (user?.email ?? '').trim();
  });

  /** La première lettre du nom, sinon de l'adresse. */
  protected readonly initial = computed(() => ([...this.identity()][0] ?? '').toLocaleUpperCase('fr'));

  /** Les entrées du menu « Réglages » ; celle qui est retenue porte une coche et « · choisi ». */
  protected readonly settings = computed<ElementMenu<PreferenceTheme>[]>(() => {
    const chosen = this.theme.preference();
    return THEME_CHOICES.map(({ valeur, libelle }) =>
      valeur === chosen ? { valeur, libelle: libelle + CHOSEN_SUFFIX, icone: 'coche' } : { valeur, libelle },
    );
  });

  protected chooseTheme(preference: PreferenceTheme): void {
    this.theme.definir(preference);
    this.annonces.annoncer(THEME_ANNOUNCEMENTS[preference]);
  }

  /**
   * Le lien d'évitement : le routeur ajoute #contenu à l'adresse de la page (pas à « / », à cause de
   * <base href="/">) mais ne déplace pas le focus. On le donne ici à la page.
   */
  protected goToContent(): void {
    this.content().nativeElement.focus();
  }

  /**
   * « Compris » : la note disparaît avec le bouton qui avait le focus. Sans rien faire, le focus
   * tomberait sur le document et la tabulation repartirait du début : on le pose sur le contenu,
   * sans faire défiler la page.
   */
  protected understood(): void {
    this.annonces.compris();
    this.content().nativeElement.focus({ preventScroll: true });
  }
}
