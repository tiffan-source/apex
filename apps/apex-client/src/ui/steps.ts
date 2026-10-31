import { ChangeDetectionStrategy, Component, computed, input, numberAttribute } from '@angular/core';
import { descriptionProgression, type NomUnite } from './voice';

/**
 * <ax-steps [done]="1" [inProgress]="true" [upcoming]="2" /> : une pilule par étape (ou par pas) — encre pour
 * ce qui est fait, vermillon pour l'étape en cours, creux pour la suite. Nommée par sa progression.
 */
@Component({
  selector: 'ax-steps',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'steps', role: 'img', '[attr.aria-label]': 'description()' },
  template: `
    @for (state of cells(); track $index) {
      <span [class]="state"></span>
    }
  `,
})
export class AxSteps {
  readonly done = input(0, { transform: numberAttribute });
  readonly inProgress = input(false);
  readonly upcoming = input(0, { transform: numberAttribute });
  readonly unit = input<NomUnite>('etape');

  protected readonly cells = computed(() => [
    ...Array.from({ length: this.done() }, () => 'done'),
    ...(this.inProgress() ? ['now'] : []),
    ...Array.from({ length: this.upcoming() }, () => ''),
  ]);

  protected readonly description = computed(() =>
    descriptionProgression({ faits: this.done(), enCours: this.inProgress(), aVenir: this.upcoming() }, this.unit()),
  );
}
