/**
 * @org/design-tokens — la mise en page d'Apex, posée sur Empreinte.
 *
 * L'essentiel est en CSS : tokens.css (tokens --ds-*) et layout.css (classes
 * .ds-*), chargés par le tableau "styles" de apps/<app>/project.json après
 * @empreinte-studio/tokens/empreinte.css. L'apparence vient des composants
 * d'Empreinte (@empreinte-studio/angular) : ce module n'exporte plus de preset.
 *
 * Il expose seulement les points de rupture, pour BreakpointObserver du CDK.
 * Ils doivent rester égaux aux --ds-breakpoint-* de tokens.css : le contrôle
 * `npx nx lint design-tokens` le vérifie.
 */

/** Points de rupture d'Apex, en pixels (égaux aux --ds-breakpoint-* de tokens.css). */
export const DS_BREAKPOINTS = {
  /** Mobile : la coque d'Empreinte passe la navigation en haut. */
  sm: 760,
  /** Les grilles de 2 ou 3 colonnes égales passent à une colonne. */
  md: 900,
  /** Les panneaux asymétriques (2fr/1fr, 7fr/6fr) passent à une colonne. */
  lg: 1100,
} as const;

export type DsBreakpoint = keyof typeof DS_BREAKPOINTS;

const upTo = (width: number) => `(max-width: ${width}px)`;

/**
 * Requêtes média « jusqu'à » chaque point de rupture, prêtes pour
 * BreakpointObserver : `observe(DS_MEDIA.sm)` est vrai sur mobile.
 */
export const DS_MEDIA: Readonly<Record<DsBreakpoint, string>> = {
  sm: upTo(DS_BREAKPOINTS.sm),
  md: upTo(DS_BREAKPOINTS.md),
  lg: upTo(DS_BREAKPOINTS.lg),
};
