import { ChangeDetectionStrategy, Component, booleanAttribute, computed, inject, input, model, output } from '@angular/core';
import { FORM_FIELD, type FormValueControl } from '@angular/forms/signals';
import { AxField, AxFieldControl, autoMessageOf, idUnique } from './field';
import type { OptionSelection } from './types';

/**
 * <ax-select [options] [(value)]> : une liste déroulante native, qui garde la valeur typée de chaque option
 * (un nombre reste un nombre). Se branche sur Signal Forms par [formField] ; dans un ax-field, le libellé,
 * l'aide et le message vont sur la liste elle-même.
 */
@Component({
  selector: 'ax-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: AxFieldControl, useExisting: AxSelect }],
  host: { class: 'ax-select' },
  styles: `:host { display: block; min-width: 0; }`,
  template: `
    <select
      class="input"
      [id]="selectId()"
      [disabled]="disabled()"
      [attr.aria-label]="field ? null : label() || null"
      [attr.aria-describedby]="field?.describedBy() || null"
      [attr.aria-invalid]="field?.invalid() ? 'true' : null"
      (change)="choose($any($event.target).selectedIndex)"
      (blur)="touch.emit()"
    >
      @if (index() < 0) {
        <option value="" selected disabled>{{ placeholder() }}</option>
      }
      @for (option of options(); track $index) {
        <option [selected]="$index === index()" [disabled]="option.desactivee">{{ option.libelle }}</option>
      }
    </select>
  `,
})
export class AxSelect<T> implements FormValueControl<T | null>, AxFieldControl {
  readonly options = input.required<readonly OptionSelection<T>[]>();
  readonly value = model<T | null>(null);
  readonly placeholder = input('Choisir');
  /** Nom accessible hors d'un ax-field. */
  readonly label = input<string | undefined>(undefined);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly id = input<string | undefined>(undefined);
  readonly compare = input<(a: T, b: T) => boolean>(Object.is);

  private readonly formField = inject(FORM_FIELD, { optional: true, self: true });
  protected readonly field = inject(AxField, { optional: true });
  private readonly generatedId = idUnique('ax-liste');

  protected readonly selectId = computed(() => this.id() ?? this.generatedId);
  protected readonly index = computed(() => {
    const value = this.value();
    if (value === null || value === undefined) return -1;
    return this.options().findIndex((option) => this.compare()(option.valeur, value));
  });

  readonly controlId = () => this.selectId();
  readonly forcedInvalid = () => false;
  readonly autoMessage = computed(autoMessageOf(this.formField));

  protected choose(selectedIndex: number): void {
    const offset = this.index() < 0 ? 1 : 0;
    const option = this.options()[selectedIndex - offset];
    if (option) this.value.set(option.valeur);
  }

  /** Signal Forms marque le champ touché à la sortie de la liste. */
  readonly touch = output<void>();
}
