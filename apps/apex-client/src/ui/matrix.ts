import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  TemplateRef,
  booleanAttribute,
  computed,
  contentChild,
  inject,
  input,
  output,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CdkDrag, CdkDragPlaceholder, CdkDropList, CdkDropListGroup, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { compter } from './voice';
import { idUnique } from './field';
import { QUADRANTS, TITRES_QUADRANTS, type DeplacementMatrice, type Quadrant } from './types';

/** Le contexte d'un élément : l'élément, son quadrant, et s'il est posé sur le panneau d'encre. */
export interface ContexteElementMatrice<T> {
  $implicit: T;
  quadrant: Quadrant;
  nuit: boolean;
}

/** Le gabarit d'un élément de la matrice. L'entrée ne sert qu'à typer `let-…`. */
@Directive({ selector: 'ng-template[axMatrixItem]' })
export class AxMatrixItem<T> {
  readonly axMatrixItem = input<Readonly<Record<Quadrant, readonly T[]>> | readonly T[]>();
  readonly template = inject<TemplateRef<ContexteElementMatrice<T>>>(TemplateRef);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature imposée par Angular
  static ngTemplateContextGuard<T>(_directive: AxMatrixItem<T>, context: unknown): context is ContexteElementMatrice<T> {
    return true;
  }
}

export interface AxesMatrice {
  urgent: string;
  pasUrgent: string;
  important: string;
  secondaire: string;
}

/**
 * <ax-matrix> : la matrice d'Eisenhower en quatre panneaux. Elle ne garde rien : un glisser-déposer annonce
 * (move). Le quadrant courant (« Maintenant ») est le panneau d'encre. Le glisser-déposer ne se fait pas au
 * clavier : chaque élément doit offrir un « Déplacer vers… ».
 */
@Component({
  selector: 'ax-matrix',
  imports: [NgTemplateOutlet, CdkDropListGroup, CdkDropList, CdkDrag, CdkDragPlaceholder],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ax-matrix' },
  templateUrl: './matrix.html',
  styleUrl: './matrix.css',
})
export class AxMatrix<T> {
  readonly quadrants = input.required<Readonly<Record<Quadrant, readonly T[]>>>();
  readonly track = input<(element: T) => unknown>((element) => element);
  readonly current = input<Quadrant | null>('maintenant');
  readonly titles = input<Readonly<Record<Quadrant, string>>>(TITRES_QUADRANTS);
  readonly axes = input<AxesMatrice>({ urgent: 'Urgent', pasUrgent: 'Pas urgent', important: 'Important', secondaire: 'Secondaire' });
  readonly unit = input<readonly [string, string]>(['tâche', 'tâches']);
  readonly label = input("Matrice d'Eisenhower");
  /** Une phrase au pied d'un quadrant (« Tu peux le laisser filer. »). */
  readonly notes = input<Readonly<Partial<Record<Quadrant, string>>>>({});
  readonly draggable = input(true, { transform: booleanAttribute });

  readonly move = output<DeplacementMatrice<T>>();

  protected readonly item = contentChild(AxMatrixItem<T>);
  protected readonly order = QUADRANTS;
  protected readonly ids = Object.fromEntries(QUADRANTS.map((q) => [q, idUnique(`ax-quadrant-${q}`)])) as Record<Quadrant, string>;

  protected readonly counts = computed(() => {
    const [singulier, pluriel] = this.unit();
    return Object.fromEntries(
      QUADRANTS.map((q) => [q, compter(this.quadrants()[q].length, singulier, pluriel)]),
    ) as Record<Quadrant, string>;
  });

  protected drop(event: CdkDragDrop<Quadrant, Quadrant, T>): void {
    const de = event.previousContainer.data;
    const vers = event.container.data;
    if (de === vers && event.previousIndex === event.currentIndex) return;
    this.move.emit({ element: event.item.data, de, vers, index: event.currentIndex });
  }
}
