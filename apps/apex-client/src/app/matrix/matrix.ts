import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  Injector,
  LOCALE_ID,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { formatDate } from '@angular/common';
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
import type { MatrixTaskViewModel } from '../../chore/models/matrix.viewmodel';

/** Longueur maximale d'un titre d'objectif dans la rangée de filtres (lisible sur un téléphone). */
export const SHORT_TITLE_MAX = 24;

/**
 * Au toucher, un pas ne se saisit qu'après un appui d'un moment (en millisecondes) : sans ce délai, le doigt
 * qui glisse sur la liste pour faire défiler la page déplacerait le pas (le CDK démarre le glisser au premier
 * mouvement et bloque le défilement). À la souris, rien ne change. e-matrice n'expose pas ce réglage : il passe
 * par la configuration du glisser-déposer du CDK, que ses pas lisent.
 */
export const MATRIX_DRAG_CONFIG: DragDropConfig = { dragStartDelay: { touch: 300, mouse: 0 } };

/**
 * Le titre court d'un objectif, pour un filtre : coupé au dernier mot entier qui tient, suivi de « … ».
 * Un bouton d'Empreinte ne passe pas à la ligne : un titre long déborderait sur un téléphone.
 */
export function shortTitle(title: string, max = SHORT_TITLE_MAX): string {
  const text = title.trim().replace(/\s+/g, ' ');
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const head = lastSpace >= max / 2 ? cut.slice(0, lastSpace) : cut;
  return `${head.replace(/[\s,;:·.-]+$/, '')}…`;
}

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
})
export class Matrix {
  private readonly store = inject(ObjectiveStore);
  private readonly locale = inject(LOCALE_ID);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  /** « Lundi 19 octobre » : la date du jour, à l'ouverture de la page. */
  protected readonly today = capitalize(formatDate(new Date(), 'EEEE d MMMM', this.locale));

  /** L'objectif racine choisi dans les filtres, ou null pour « Tous les objectifs ». */
  protected readonly filter = signal<string | null>(null);

  /** Un filtre par objectif racine, au titre court. */
  protected readonly filterOptions = computed<OptionFiltre<string>[]>(() =>
    this.store.objectiveOptions().map(({ valeur, libelle }) => ({ valeur, libelle: shortTitle(libelle) })),
  );

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
   * Les pas sont connus : le chargement a abouti, ou des pas sont déjà là. Avant (premier chargement, ou
   * chargement qui n'a pas abouti, que la coque signale), l'écran ne prétend pas qu'il y a « 0 pas ».
   */
  protected readonly loaded = computed(() => this.store.isFulfilled() || this.hasTasks());

  /** « 14 pas » : tous les pas affichés, faits compris. */
  protected readonly taskCount = computed(() => {
    const matrix = this.matrix();
    return compter(QUADRANTS.reduce((total, quadrant) => total + matrix[quadrant].length, 0), 'pas', 'pas');
  });

  /** Aucun pas du tout, une fois les objectifs chargés : on invite à en poser depuis les objectifs. */
  protected readonly isEmpty = computed(() => this.store.isFulfilled() && !this.hasTasks());

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

  /** « Licence · Statistiques » : l'objectif, puis l'étape s'il y en a une. */
  protected taskDetail(task: MatrixTaskViewModel): string {
    return [task.rootObjectiveTitle, task.stageTitle].filter((part) => !!part).join(' · ');
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

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('fr') + text.slice(1);
}
