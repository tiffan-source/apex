import Lara from '@primeuix/themes/lara';
import { definePreset } from '@primeuix/themes';

/*
 * Preset PrimeNG branché sur les design tokens (tokens.css).
 * PrimeNG ne contient plus aucune couleur, arrondi ou espacement propre :
 * tout pointe vers une variable --ds-*. Changer un token change donc aussi
 * les composants PrimeNG, dans toutes les applications qui utilisent ce preset.
 */

const scale = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const;

// Construit { 50: 'var(--ds-color-<nom>-50)', … } pour une palette de tokens
const palette = (name: string) =>
  Object.fromEntries(scale.map((step) => [step, `var(--ds-color-${name}-${step})`]));

const surface = { 0: 'var(--ds-color-gray-0)', ...palette('gray') };

const primaryInteraction = {
  color: 'var(--ds-color-primary)',
  contrastColor: 'var(--ds-color-primary-contrast)',
  hoverColor: 'var(--ds-color-primary-hover)',
  activeColor: 'var(--ds-color-primary-active)',
};

export const DesignSystemPreset = definePreset(Lara, {
  primitive: {
    borderRadius: {
      none: 'var(--ds-radius-none)',
      xs: 'var(--ds-radius-xs)',
      sm: 'var(--ds-radius-sm)',
      md: 'var(--ds-radius-md)',
      lg: 'var(--ds-radius-lg)',
      xl: 'var(--ds-radius-xl)',
    },
  },
  semantic: {
    primary: palette('green'),
    transitionDuration: 'var(--ds-duration-fast)',
    focusRing: {
      width: 'var(--ds-focus-ring-width)',
      style: 'solid',
      color: 'var(--ds-color-focus-ring)',
      offset: 'var(--ds-focus-ring-offset)',
    },
    colorScheme: {
      light: {
        surface,
        primary: primaryInteraction,
        content: {
          background: 'var(--ds-color-surface)',
          hoverBackground: 'var(--ds-color-surface-hover)',
          borderColor: 'var(--ds-color-border)',
          color: 'var(--ds-color-text)',
        },
        text: {
          color: 'var(--ds-color-text)',
          mutedColor: 'var(--ds-color-text-muted)',
        },
      },
      dark: {
        surface,
        primary: primaryInteraction,
        content: {
          background: 'var(--ds-color-surface)',
          hoverBackground: 'var(--ds-color-surface-hover)',
          borderColor: 'var(--ds-color-border)',
          color: 'var(--ds-color-text)',
        },
        text: {
          color: 'var(--ds-color-text)',
          mutedColor: 'var(--ds-color-text-muted)',
        },
      },
    },
  },
  components: {
    card: {
      root: {
        borderRadius: 'var(--ds-card-radius)',
        shadow: 'var(--ds-card-shadow)',
      },
      body: {
        padding: 'var(--ds-card-padding)',
      },
    },
    progressbar: {
      root: {
        height: 'var(--ds-progress-height)',
      },
    },
  },
});

/*
 * Le mode sombre des tokens suit prefers-color-scheme : PrimeNG doit suivre
 * le même signal, sinon les deux thèmes se désynchronisent.
 */
export const designSystemThemeOptions = {
  darkModeSelector: 'system',
} as const;
