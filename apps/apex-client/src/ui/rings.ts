import { ChangeDetectionStrategy, Component, computed, input, numberAttribute } from '@angular/core';
import type { Lumiere } from './types';

/** Un anneau : ce qui est fait sur le total, dans la couleur d'un objectif (sinon le vermillon). */
export interface Anneau {
  done: number;
  total: number;
  lumiere?: Lumiere;
}

const COULEURS: Readonly<Record<Lumiere, string>> = {
  ciel: 'var(--ciel-vif)',
  aube: 'var(--aube-vif)',
  soleil: 'var(--soleil-vif)',
  fjord: 'var(--fjord-vif)',
};

/**
 * <ax-rings [rings]="…" label="19 pas faits sur 30"> : des anneaux concentriques qui se tracent à l'ouverture,
 * du plus grand au plus petit. Le centre reçoit le contenu projeté.
 */
@Component({
  selector: 'ax-rings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ax-rings', role: 'img', '[attr.aria-label]': 'label()', '[style.--size.px]': 'size()' },
  styles: `
    :host { position: relative; display: inline-grid; place-items: center; flex: none; width: var(--size); height: var(--size); }
    svg { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); overflow: visible; }
    circle { fill: none; }
    .track { stroke: var(--ax-rings-track, var(--creux)); }
    .arc { stroke-linecap: round; animation: tracer 1400ms var(--courbe) both; animation-delay: var(--d); }
    .center { position: relative; display: grid; place-items: center; text-align: center; }
    @keyframes tracer { from { stroke-dasharray: 0 9999; } }
    @media (prefers-reduced-motion: reduce) { .arc { animation: none; } }
  `,
  template: `
    <svg [attr.viewBox]="'0 0 ' + size() + ' ' + size()" aria-hidden="true">
      @for (arc of arcs(); track $index) {
        <circle class="track" [attr.cx]="half()" [attr.cy]="half()" [attr.r]="arc.r" [attr.stroke-width]="stroke()" />
        @if (arc.length > 0) {
          <circle
            class="arc"
            [attr.cx]="half()"
            [attr.cy]="half()"
            [attr.r]="arc.r"
            [attr.stroke-width]="stroke()"
            [style.stroke]="arc.color"
            [style.stroke-dasharray]="arc.length + ' ' + arc.circumference"
            [style.--d]="arc.delay"
          />
        }
      }
    </svg>
    <div class="center"><ng-content /></div>
  `,
})
export class AxRings {
  readonly rings = input.required<readonly Anneau[]>();
  readonly label = input.required<string>();
  readonly size = input(240, { transform: numberAttribute });
  readonly stroke = input(14, { transform: numberAttribute });

  protected readonly half = computed(() => this.size() / 2);
  protected readonly arcs = computed(() => {
    const gap = this.stroke() + 6;
    return this.rings().map((ring, index) => {
      const r = this.half() - this.stroke() / 2 - index * gap;
      const circumference = 2 * Math.PI * r;
      const part = ring.total > 0 ? Math.min(1, ring.done / ring.total) : 0;
      return {
        r,
        circumference,
        length: circumference * part,
        color: ring.lumiere ? COULEURS[ring.lumiere] : 'var(--sceau)',
        delay: `${300 + index * 150}ms`,
      };
    });
  });
}
