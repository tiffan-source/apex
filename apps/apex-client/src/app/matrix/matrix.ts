import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CDK_DRAG_CONFIG, type DragDropConfig } from '@angular/cdk/drag-drop';
import { RouterLink } from '@angular/router';
import { EBouton } from '@empreinte-studio/angular/bouton';
import { ECase } from '@empreinte-studio/angular/case';
import { compter } from '@empreinte-studio/angular/core';
import { EFiltres, type OptionFiltre } from '@empreinte-studio/angular/filtres';
import {
  EMatrice,
  EMatriceElement,
  QUADRANTS,
  TITRES_QUADRANTS,
  type DeplacementMatrice,
  type Quadrant,
} from '@empreinte-studio/angular/matrice';
import { EMenu, type EntreeMenu } from '@empreinte-studio/angular/menu';
import { ObjectiveStore } from '../../chore/stores/objective.store';
import { AnnoncesStore } from '../../chore/stores/annonces.store';
import type { MatrixTaskViewModel } from '../../chore/models/matrix.viewmodel';
import { FILTER_TITLE_MAX, distinctShortTitles } from '../../chore/mapper/title.mapper';
import { toDateInputValue } from '../../chore/mapper/date-input.mapper';
import { formatToday, injectToday } from '../../chore/clock/today';

/** Le nom du filtre qui garde tous les objectifs (e-filtres, et l'annonce d'un choix). */
export const ALL_OBJECTIVES = 'Tous les objectifs';

/**
 * Au toucher, un pas ne se saisit qu'après un appui d'un moment (en millisecondes) : sans ce délai, le doigt
 * qui glisse sur la liste pour faire défiler la page déplacerait le pas (le CDK démarre le glisser au premier
 * mouvement et bloque le défilement). À la souris, rien ne change. e-matrice n'expose pas ce réglage : il passe
 * par la configuration du glisser-déposer du CDK, que ses pas lisent.
 */
export const MATRIX_DRAG_CONFIG: DragDropConfig = { dragStartDelay: { touch: 300, mouse: 0 } };

/** Les quadrants vers lesquels un pas peut aller : les trois autres. */
function moveTargetsFrom(quadrant: Quadrant): readonly EntreeMenu<Quadrant>[] {
  return QUADRANTS.filter((target) => target !== quadrant).map((target) => ({
    valeur: target,
    libelle: TITRES_QUADRANTS[target],
  }));
}

/**
 * La matrice d'Eisenhower (route /matrice) : tous les pas, faits compris, rangés dans les quatre
 * quadrants d'Empreinte. On coche un pas sur place, on le déplace en le glissant ou, au clavier,
 * par le menu « Déplacer vers… ». Le filtre par objectif ne vit que dans la page.
 */
@Component({
  selector: 'app-matrix',
  imports: [RouterLink, EBouton, ECase, EFiltres, EMatrice, EMatriceElement, EMenu],
  providers: [{ provide: CDK_DRAG_CONFIG, useValue: MATRIX_DRAG_CONFIG }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './matrix.html',
  styleUrl: './matrix.css',
})
export class Matrix {
  private readonly store = inject(ObjectiveStore);
  private readonly annonces = inject(AnnoncesStore);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  /** « Lundi 19 octobre » : la date du jour, qui change à minuit, comme sur l'écran Objectifs. */
  private readonly today = injectToday();
  protected readonly todayLabel = computed(() => formatToday(this.today()));
  protected readonly todayIso = computed(() => toDateInputValue(this.today()));

  protected readonly allObjectives = ALL_OBJECTIVES;

  /** L'objectif racine choisi dans les filtres, ou null pour « Tous les objectifs ». */
  protected readonly filter = signal<string | null>(null);

  /**
   * Un filtre par objectif racine, au titre court. Ce titre est le seul nom du bouton (e-filtres n'a pas de nom
   * accessible par option) : deux objectifs au début identique gardent des noms différents.
   */
  protected readonly filterOptions = computed<OptionFiltre<string>[]>(() => {
    const options = this.store.objectiveOptions();
    const labels = distinctShortTitles(
      options.map((option) => option.libelle),
      FILTER_TITLE_MAX,
    );
    return options.map(({ valeur }, index) => ({ valeur, libelle: labels[index] }));
  });

  /** Un seul objectif (ou aucun) : filtrer ne changerait rien, la rangée n'est pas montrée. */
  protected readonly showFilters = computed(() => this.filterOptions().length > 1);

  /** Le filtre appliqué : retombe sur « Tous les objectifs » si l'objectif choisi n'existe plus. */
  protected readonly activeFilter = computed(() => {
    const id = this.filter();
    return id !== null && this.filterOptions().some((option) => option.valeur === id) ? id : null;
  });

  /** Les pas de chaque quadrant, filtrés. */
  protected readonly matrix = computed(() => this.store.matrixFor(this.activeFilter()));

  /** Au moins un pas, tous objectifs confondus. */
  private readonly hasTasks = computed(() => {
    const matrix = this.store.matrix();
    return QUADRANTS.some((quadrant) => matrix[quadrant].length > 0);
  });

  /**
   * Les pas sont connus : les objectifs sont chargés (objectivesLoaded), ou des pas sont déjà là. Avant
   * (premier chargement, ou chargement qui n'a pas abouti, que la coque signale), l'écran ne prétend pas
   * qu'il y a « 0 pas ».
   */
  protected readonly loaded = computed(() => this.store.objectivesLoaded() || this.hasTasks());

  /** « 14 pas » : tous les pas affichés, faits compris. */
  protected readonly taskCount = computed(() => {
    const matrix = this.matrix();
    return compter(QUADRANTS.reduce((total, quadrant) => total + matrix[quadrant].length, 0), 'pas', 'pas');
  });

  /** Aucun pas du tout, une fois les objectifs chargés : on invite à en poser depuis les objectifs. */
  protected readonly isEmpty = computed(() => this.store.objectivesLoaded() && !this.hasTasks());

  /** Le premier chargement est en cours : l'écran le dit, au lieu de quatre quadrants à « 0 pas ». */
  protected readonly loading = computed(() => !this.loaded() && !this.store.error());

  /**
   * Le chargement n'a pas abouti, et la note de la coque a été lue (« Compris ») : l'écran dit encore quoi
   * faire. Tant que la note est là, elle suffit (une note à la fois).
   */
  protected readonly loadFailedHint = computed(
    () => !this.loaded() && !!this.store.error() && !this.annonces.aUnSignalement(),
  );

  /** La clé d'un pas pour e-matrice : son id (le store recrée les objets à chaque mise à jour). */
  protected readonly trackById = (task: MatrixTaskViewModel) => task.id;

  /** Ce que compte chaque quadrant (« 4 pas ») ; un tuple, pas un tableau littéral du gabarit. */
  protected readonly taskUnit = ['pas', 'pas'] as const;

  /** Pour chaque quadrant, les trois autres, proposés par « Déplacer vers… ». */
  protected readonly moveTargets: Readonly<Record<Quadrant, readonly EntreeMenu<Quadrant>[]>> = {
    maintenant: moveTargetsFrom('maintenant'),
    planifier: moveTargetsFrom('planifier'),
    confier: moveTargetsFrom('confier'),
    'laisser-filer': moveTargetsFrom('laisser-filer'),
  };

  /** L'id de la case d'un pas (le label la vise, et le focus y revient après un déplacement au clavier). */
  protected checkboxId(task: MatrixTaskViewModel): string {
    return `matrix-task-${task.id}`;
  }

  /** « Licence · étape Statistiques » : l'objectif, puis l'étape s'il y en a une (maquette « Matrice »). */
  protected taskDetail(task: MatrixTaskViewModel): string {
    return [task.rootObjectiveTitle, task.stageTitle ? `étape ${task.stageTitle}` : ''].filter((part) => !!part).join(' · ');
  }

  /**
   * Un filtre choisi : la matrice et le compte du repère changent, ce que le bouton enfoncé ne dit pas aux
   * lecteurs d'écran. On leur annonce l'objectif, en entier, et ce qui reste dans la matrice.
   */
  protected chooseFilter(id: string | null): void {
    if (id === this.activeFilter()) return;
    this.filter.set(id);
    const name =
      id === null ? ALL_OBJECTIVES : (this.store.objectiveOptions().find((option) => option.valeur === id)?.libelle ?? ALL_OBJECTIVES);
    this.annonces.annoncer(`${name} · ${this.taskCount()}`);
  }

  /** Coche ou décoche un pas : mise à jour optimiste du store, retour en arrière s'il n'est pas enregistré. */
  protected toggle(task: MatrixTaskViewModel, done: boolean): void {
    this.store.updateTaskDone({ taskId: task.id, done });
  }

  /** Un pas glissé vers un autre quadrant (l'ordre dans un quadrant n'est pas enregistré). */
  protected move(deplacement: DeplacementMatrice<MatrixTaskViewModel>): void {
    if (deplacement.de === deplacement.vers) return;
    this.store.moveTaskToQuadrant(deplacement.element.id, deplacement.vers);
  }

  /**
   * Un pas envoyé vers un quadrant par le menu « Déplacer vers… ». Le menu rend le focus à son bouton, mais
   * la ligne du pas est aussitôt recréée dans son nouveau quadrant : le focus tomberait sur la page. Il revient
   * donc sur la case du pas, à sa nouvelle place, pour que le clavier reprenne là où il était.
   */
  protected moveTo(task: MatrixTaskViewModel, quadrant: Quadrant): void {
    const id = this.checkboxId(task);
    this.store.moveTaskToQuadrant(task.id, quadrant);
    afterNextRender({ write: () => this.document.getElementById(id)?.focus() }, { injector: this.injector });
  }
}
