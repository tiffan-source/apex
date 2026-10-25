import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  type Data,
  isActive,
  type IsActiveMatchOptions,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';
import { EBouton } from '@empreinte-studio/angular/bouton';
import { type PreferenceTheme, Theme } from '@empreinte-studio/angular/core';
import { type ElementMenu, EMenu } from '@empreinte-studio/angular/menu';
import { ELienNav, EMarque } from '@empreinte-studio/angular/navigation';
import { ENote, ENoteActions } from '@empreinte-studio/angular/note';
import { AnnoncesStore } from '../../chore/stores/annonces.store';
import { ObjectiveStore } from '../../chore/stores/objective.store';
import { AkariWritesStore } from '../../chore/stores/akari-writes.store';
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
 * ObjectiveStore est fourni ici : tous les écrans de la coque partagent les mêmes objectifs. AkariWritesStore
 * aussi : ce qu'Akari ajoute recharge ces objectifs, même après le départ de l'écran Akari.
 */
@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ELienNav,
    EMarque,
    EMenu,
    ENote,
    ENoteActions,
    EBouton,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ObjectiveStore, AkariWritesStore],
})
export class Shell {
  protected readonly annonces = inject(AnnoncesStore);
  private readonly session = inject(SessionStore);
  private readonly theme = inject(Theme);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  private readonly content = viewChild.required<ElementRef<HTMLElement>>('contenu');

  /** Le chemin de la page affichée (sans requête ni fragment) ; null avant la première navigation. */
  private shownPath: string | null = null;

  /**
   * La page affichée tient dans la fenêtre (data.fitsWindow de sa route : Akari). Au-dessus de 1100px, la coque
   * lui passe la hauteur de l'écran, moins ses marges et la note d'Akari (shell.css).
   */
  protected readonly fitsWindow = signal(false);

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        this.fitsWindow.set(this.shownRouteData()['fitsWindow'] === true);
        this.pageShown(event.urlAfterRedirects);
      });
  }

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

  /** Les données de la route affichée : la plus profonde. */
  private shownRouteData(): Data {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;
    return route.data;
  }

  /**
   * Une nouvelle page : le lien ou le bouton qui y a mené (« Ouvrir », un fil d'Ariane, « Je m'y engage »…) est
   * parti avec l'ancienne, et le focus serait tombé sur le document : la tabulation repartirait du début, et rien
   * ne dirait aux lecteurs d'écran que la page a changé. Le focus va au contenu, sans faire défiler (le routeur
   * remonte la page, withInMemoryScrolling). Pas à la première page (le chargement, la connexion), ni quand
   * seuls la requête ou le fragment changent ; et jamais quand le focus est encore sur un élément de la page
   * (une entrée de la navigation, qui reste).
   */
  private pageShown(url: string): void {
    const path = url.split(/[?#]/, 1)[0];
    const previous = this.shownPath;
    this.shownPath = path;
    if (previous === null || previous === path) return;
    afterNextRender(
      {
        write: () => {
          const active = this.document.activeElement;
          if (active && active !== this.document.body && active.isConnected) return;
          this.content().nativeElement.focus({ preventScroll: true });
        },
      },
      { injector: this.injector },
    );
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
