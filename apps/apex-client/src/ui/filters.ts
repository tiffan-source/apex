import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import type { Lumiere, OptionFiltre } from './types';

const COULEURS: Readonly<Record<Lumiere, string>> = {
  ciel: 'var(--ciel-vif)',
  aube: 'var(--aube-vif)',
  soleil: 'var(--soleil-vif)',
  fjord: 'var(--fjord-vif)',
};

/**
 * <ax-filters label="Filtrer par objectif" [options] [(selection)]> : une rangée de pilules, une seule active.
 * `null` vaut « Tous » (le premier filtre, sauf si `allLabel` est null).
 */
@Component({
  selector: 'ax-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ax-filters', role: 'group', '[attr.aria-label]': 'label()' },
  styles: `
    :host { display: flex; flex-wrap: wrap; gap: 6px; }
    button {
      appearance: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      max-width: 100%;
      min-height: 36px;
      padding: 0 14px;
      border: 0;
      border-radius: 999px;
      background: var(--panneau);
      box-shadow: inset 0 0 0 1px var(--trame);
      color: var(--encre-douce);
      font: 500 13px/18px var(--sans);
      cursor: pointer;
      transition: background-color 160ms, color 160ms;
    }
    button:hover { color: var(--encre); box-shadow: inset 0 0 0 1px var(--trame-forte); }
    button[aria-pressed='true'] { background: var(--encre); color: var(--fond); box-shadow: none; }
    .text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `,
  template: `
    @if (allLabel() !== null) {
      <button type="button" [attr.aria-pressed]="selection() === null" (click)="selection.set(null)">{{ allLabel() }}</button>
    }
    @for (option of options(); track $index) {
      <button
        type="button"
        [attr.aria-pressed]="selection() === option.valeur"
        [attr.title]="option.libelle"
        (click)="selection.set(option.valeur)"
      >
        @if (option.lumiere) {
          <span class="dot" [style.background]="colorOf(option.lumiere)"></span>
        }
        <span class="text">{{ option.libelle }}</span>
      </button>
    }
  `,
})
export class AxFilters<V> {
  readonly options = input.required<readonly OptionFiltre<V>[]>();
  readonly selection = model<V | null>(null);
  readonly allLabel = input<string | null>('Tous');
  readonly label = input.required<string>();

  protected colorOf(lumiere: Lumiere): string {
    return COULEURS[lumiere];
  }
}
