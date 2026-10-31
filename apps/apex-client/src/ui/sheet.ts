import { ChangeDetectionStrategy, Component, Directive, Injectable, booleanAttribute, inject, input, numberAttribute } from '@angular/core';
import { Dialog, DialogRef, type DialogConfig } from '@angular/cdk/dialog';
import type { ComponentType } from '@angular/cdk/portal';
import { AxIcon } from './icon';
import { idUnique } from './field';

export interface OptionsFeuille<D> {
  /** Injectées avec DIALOG_DATA. */
  donnees?: D;
  /** Échap et le fond ne ferment plus la feuille. */
  sansFermetureExterieure?: boolean;
  /** Nom accessible, quand la feuille n'a pas d'ax-sheet titrée. */
  libelle?: string;
  /** Réglages du CDK ajoutés en dernier (un injecteur, par exemple). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cdk?: Partial<DialogConfig<D, any>>;
}

/**
 * Ouvrir une feuille : un dialogue modal centré (CDK Dialog), qui monte depuis le bas.
 * Passer `cdk: { injector }` pour que le composant ouvert atteigne les stores fournis par la coque.
 */
@Injectable({ providedIn: 'root' })
export class Feuilles {
  private readonly dialog = inject(Dialog);

  ouvrir<C, D = unknown, R = unknown>(composant: ComponentType<C>, options: OptionsFeuille<D> = {}): DialogRef<R, C> {
    return this.dialog.open<R, D, C>(composant, {
      data: options.donnees,
      panelClass: 'ax-sheet-panel',
      backdropClass: 'ax-sheet-backdrop',
      ariaLabel: options.libelle,
      disableClose: options.sansFermetureExterieure ?? false,
      autoFocus: 'first-heading',
      restoreFocus: true,
      ...(options.cdk as Partial<DialogConfig<D, DialogRef<R, C>>>),
    });
  }
}

/** La rangée d'actions d'une feuille. */
@Directive({ selector: '[axSheetActions]', host: { class: 'ax-sheet-actions' } })
export class AxSheetActions {}

/**
 * <ax-sheet title="Modifier le pas"> : la mise en page d'une feuille, dans le gabarit du composant ouvert.
 * Le titre reçoit le focus à l'ouverture et nomme le dialogue.
 */
@Component({
  selector: 'ax-sheet',
  imports: [AxIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ax-sheet', '[style.--ax-sheet-width.px]': 'width()' },
  styles: `
    :host {
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 24px;
      width: min(var(--ax-sheet-width), calc(100vw - 32px));
      max-height: calc(100dvh - 32px);
      overflow-y: auto;
      padding: 28px 28px 24px;
      border-radius: var(--r-xl);
      background: var(--panneau);
      color: var(--encre);
      box-shadow: var(--ombre-3), inset 0 0 0 1px var(--bord);
      animation: monter 320ms var(--courbe) both;
    }
    header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    h2 { margin: 0; font-size: 26px; line-height: 32px; font-weight: 600; letter-spacing: -0.025em; outline: none; }
    .body { display: flex; flex-direction: column; gap: 16px; }
    @keyframes monter { from { opacity: 0; transform: translateY(24px) scale(0.98); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { :host { animation: none; } }
    @media (max-width: 760px) { :host { padding: 22px 18px 18px; } }
  `,
  template: `
    <header>
      <h2 tabindex="-1" [id]="titleId">{{ title() }}</h2>
      @if (closable()) {
        <button class="btn btn--ghost btn--sm btn--round" type="button" aria-label="Fermer" (click)="ref?.close()">
          <ax-icon name="fermer" [size]="18" />
        </button>
      }
    </header>
    <div class="body"><ng-content /></div>
    <ng-content select="[axSheetActions]" />
  `,
})
export class AxSheet {
  readonly title = input.required<string>();
  readonly closable = input(true, { transform: booleanAttribute });
  readonly width = input(560, { transform: numberAttribute });

  protected readonly ref = inject(DialogRef, { optional: true });
  protected readonly titleId = idUnique('ax-feuille-titre');

  constructor() {
    const container = this.ref?.containerInstance as { _ariaLabelledByQueue?: string[] } | undefined;
    if (container && !this.ref?.config.ariaLabel) container._ariaLabelledByQueue?.push(this.titleId);
  }
}
