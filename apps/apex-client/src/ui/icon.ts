import { ChangeDetectionStrategy, Component, computed, input, numberAttribute } from '@angular/core';

/*
 * Les icônes d'Apex : un trait arrondi de 1,75px sur une grille de 24px, la couleur du texte.
 * Une entrée est une liste de tracés ; un tracé préfixé de « plein: » est rempli.
 */
export const ICONES: Readonly<Record<string, readonly string[]>> = {
  objectifs: ['M3 19 12 6l9 13z', 'M8.5 14h7'],
  matrice: ['M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z', 'M12 4v16M4 12h16'],
  akari: ['plein:M12 6.5 17.5 12 12 17.5 6.5 12z'],
  plus: ['M12 5v14M5 12h14'],
  modifier: ['M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z', 'M13.5 6.5l4 4'],
  fermer: ['M6 6l12 12M18 6 6 18'],
  coche: ['m5 12 5 5L20 7'],
  envoyer: ['M12 19V5M6 11l6-6 6 6'],
  fleche: ['M5 12h14M13 6l6 6-6 6'],
  retour: ['M15 6l-6 6 6 6'],
  'chevron-bas': ['M6 9l6 6 6-6'],
  'chevron-haut': ['M6 15l6-6 6 6'],
  'chevron-droite': ['M9 6l6 6-6 6'],
  'chevron-gauche': ['M15 6l-6 6 6 6'],
  reglages: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1'],
  deplacer: ['plein:M9 4.4a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2zM15 4.4a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2zM9 10.4a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2zM15 10.4a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2zM9 16.4a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2zM15 16.4a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2z'],
  actions: ['plein:M5 10.4a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2zM12 10.4a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2zM19 10.4a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2z'],
  sommet: ['M5 21V4M5 4h11l-2 4 2 4H5'],
  calendrier: ['M5 6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z', 'M5 10h14M9 2.5V6M15 2.5V6'],
  jour: ['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'],
  nuit: ['M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z'],
  appareil: ['M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', 'M9 21h6M12 17v4'],
  information: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11v5M12 8h.01'],
  empreinte: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'm8 12 3 3 5-6'],
  objectif: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z', 'plein:M12 13.6a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2z'],
};

interface Trace {
  d: string;
  plein: boolean;
}

/**
 * <ax-icon name="plus" /> : décorative par défaut ; avec `label`, elle devient une image nommée.
 */
@Component({
  selector: 'ax-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ax-icon' },
  styles: `
    :host { display: inline-flex; flex: none; line-height: 0; }
    svg { fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; }
    .plein { fill: currentColor; stroke: none; }
  `,
  template: `
    <svg
      viewBox="0 0 24 24"
      focusable="false"
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.role]="label() ? 'img' : null"
      [attr.aria-label]="label() || null"
      [attr.aria-hidden]="label() ? null : 'true'"
    >
      @for (trace of traces(); track $index) {
        <path [attr.d]="trace.d" [class.plein]="trace.plein"></path>
      }
    </svg>
  `,
})
export class AxIcon {
  readonly name = input.required<string>();
  readonly size = input(20, { transform: numberAttribute });
  readonly label = input<string | undefined>(undefined);

  protected readonly traces = computed<Trace[]>(() =>
    (ICONES[this.name()] ?? []).map((d) =>
      d.startsWith('plein:') ? { d: d.slice('plein:'.length), plein: true } : { d, plein: false },
    ),
  );
}
