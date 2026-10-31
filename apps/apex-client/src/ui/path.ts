import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, output } from '@angular/core';
import { AxIcon } from './icon';
import type { EtapeArete } from './types';

/** Ce que le chemin dit d'une étape, pour un lecteur d'écran. */
const ETATS: Readonly<Record<EtapeArete['etat'], string>> = {
  faite: 'faite',
  'en-cours': 'en cours',
  'a-venir': 'à venir',
};

/**
 * <ax-path> : le chemin d'un objectif, de la première étape au sommet. Faite : un rond d'encre coché ; en
 * cours : le rond vermillon qui luit ; à venir : un rond vide. Avec `interactive`, chaque étape est un bouton
 * qui annonce (choose) avec l'objet reçu dans `steps`.
 */
@Component({
  selector: 'ax-path',
  imports: [AxIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ax-path', '[class.vertical]': 'vertical()' },
  templateUrl: './path.html',
  styleUrl: './path.css',
})
export class AxPath<S extends EtapeArete = EtapeArete> {
  readonly steps = input.required<readonly S[]>();
  /** Le nom du sommet (l'objectif) et ce qu'on en dit dessous (l'horizon). */
  readonly summit = input('Sommet');
  readonly summitDetail = input<string | undefined>(undefined);
  readonly interactive = input(false, { transform: booleanAttribute });
  readonly vertical = input(false, { transform: booleanAttribute });
  /** L'étape ouverte à côté du chemin. */
  readonly selected = input<S | null | undefined>(undefined);
  readonly label = input('Le chemin');

  readonly choose = output<S>();

  /** Jusqu'où le trait d'encre va : jusqu'à l'étape en cours, ou jusqu'à la dernière faite. */
  protected readonly reached = computed(() => {
    const steps = this.steps();
    const current = steps.findIndex((step) => step.etat === 'en-cours');
    if (current >= 0) return current;
    let last = -1;
    steps.forEach((step, index) => {
      if (step.etat === 'faite') last = index;
    });
    return last;
  });

  protected readonly summary = computed(() => {
    const steps = this.steps();
    const faites = steps.filter((s) => s.etat === 'faite').length;
    const enCours = steps.filter((s) => s.etat === 'en-cours').length;
    return `${this.label()} : ${steps.length} étapes, ${faites} faites, ${enCours} en cours, ${steps.length - faites - enCours} à venir`;
  });

  protected stateLabel(step: S): string {
    return ETATS[step.etat];
  }
}
