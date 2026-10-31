import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, output } from '@angular/core';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import type { ConnectedPosition } from '@angular/cdk/overlay';
import { AxIcon } from './icon';
import type { ElementMenu, EntreeMenu } from './types';

export type VarianteMenu = 'ghost' | 'line' | 'on-nuit';

/**
 * <ax-menu label="Réglages" icon="reglages" [items]="…" (choose)="…"> : un bouton qui déplie un menu
 * d'actions (CDK Menu : flèches, Échap, retour du focus). Le menu se replie après un choix.
 */
@Component({
  selector: 'ax-menu',
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItem, AxIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ax-menu' },
  styles: `
    :host { display: inline-flex; }
    .panel {
      display: flex;
      flex-direction: column;
      min-width: 220px;
      padding: 6px;
      border-radius: 18px;
      background: var(--panneau);
      color: var(--encre);
      box-shadow: var(--ombre-3), inset 0 0 0 1px var(--bord);
      animation: ouvrir 180ms var(--courbe) both;
    }
    .item {
      appearance: none;
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 40px;
      padding: 0 12px;
      border: 0;
      border-radius: 12px;
      background: transparent;
      color: inherit;
      font: 500 14px/20px var(--sans);
      text-align: left;
      cursor: pointer;
    }
    .item:hover, .item:focus-visible { background: var(--creux); outline: none; }
    .item[aria-disabled='true'] { opacity: 0.45; cursor: default; }
    .item.doux { color: var(--encre-douce); }
    .separator { height: 1px; margin: 6px 8px; background: var(--bord); }
    @keyframes ouvrir { from { opacity: 0; transform: translateY(-4px) scale(0.98); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .panel { animation: none; } }
  `,
  template: `
    <button
      type="button"
      [class]="buttonClass()"
      [cdkMenuTriggerFor]="panel"
      [cdkMenuPosition]="positions"
      [attr.aria-label]="text() ? null : label()"
    >
      @if (icon()) {
        <ax-icon [name]="icon()!" [size]="small() ? 16 : 18" />
      }
      @if (text()) {
        {{ text() }}
      }
    </button>
    <ng-template #panel>
      <div class="panel" cdkMenu [attr.aria-label]="label()">
        @for (entry of items(); track $index) {
          @if (isSeparator(entry)) {
            <div class="separator" role="separator"></div>
          } @else {
            <button
              class="item"
              type="button"
              cdkMenuItem
              [class.doux]="entry.doux"
              [cdkMenuItemDisabled]="!!entry.desactive"
              (cdkMenuItemTriggered)="choose.emit(entry.valeur)"
            >
              @if (entry.icone) {
                <ax-icon [name]="entry.icone" [size]="18" />
              }
              {{ entry.libelle }}
            </button>
          }
        }
      </div>
    </ng-template>
  `,
})
export class AxMenu<V> {
  readonly items = input.required<readonly EntreeMenu<V>[]>();
  readonly label = input.required<string>();
  readonly text = input<string | undefined>(undefined);
  readonly icon = input<string | null>('actions');
  readonly variant = input<VarianteMenu>('ghost');
  readonly small = input(false, { transform: booleanAttribute });

  readonly choose = output<V>();

  protected readonly positions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
  ];

  protected readonly buttonClass = computed(() =>
    ['btn', `btn--${this.variant()}`, this.small() ? 'btn--sm' : '', this.text() ? '' : 'btn--round']
      .filter(Boolean)
      .join(' '),
  );

  protected isSeparator(entry: EntreeMenu<V>): entry is { separateur: true } {
    return 'separateur' in entry;
  }

  /** Pour les tests et l'écran : l'action d'un élément. */
  protected asItem(entry: EntreeMenu<V>): ElementMenu<V> {
    return entry as ElementMenu<V>;
  }
}
