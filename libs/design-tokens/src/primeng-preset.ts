import Lara from '@primeuix/themes/lara';
import { definePreset } from '@primeuix/themes';

/*
 * Preset PrimeNG construit à partir des design tokens (tokens.css).
 *
 * Objectif : les applications n'écrivent pas de CSS pour habiller les composants.
 * Toute l'apparence (couleurs, tailles, arrondis, espacements, typographie) est
 * décidée ici, en pointant vers des variables --ds-*. Changer un token change
 * donc les composants PrimeNG de toutes les applications qui utilisent ce preset.
 *
 * Pour une variante ponctuelle (ex. une pastille d'une autre couleur), utiliser
 * l'entrée [dt] du composant avec des tokens, jamais une feuille de style.
 *
 * Modifier ce fichier : skill .claude/skills/design-system-evolution (recettes B, C, E).
 */

const scale = [
  '50',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
  '950',
] as const;

// Construit { 50: 'var(--ds-color-<nom>-50)', … } pour une palette de tokens
const palette = (name: string) =>
  Object.fromEntries(
    scale.map((step) => [step, `var(--ds-color-${name}-${step})`]),
  );

const surface = { 0: 'var(--ds-color-gray-0)', ...palette('gray') };

const primaryInteraction = {
  color: 'var(--ds-color-primary)',
  contrastColor: 'var(--ds-color-primary-contrast)',
  hoverColor: 'var(--ds-color-primary-hover)',
  activeColor: 'var(--ds-color-primary-active)',
};

/*
 * Rôles des sévérités PrimeNG → tokens sémantiques.
 * Les tokens changent d'eux-mêmes en mode sombre : les mêmes références
 * servent donc pour les deux schémas de couleurs.
 */
const severities = {
  primary: {
    color: 'var(--ds-color-primary)',
    soft: 'var(--ds-color-primary-soft)',
  },
  secondary: {
    color: 'var(--ds-color-text-muted)',
    soft: 'var(--ds-color-surface-hover)',
  },
  success: {
    color: 'var(--ds-color-success)',
    soft: 'var(--ds-color-success-soft)',
  },
  info: { color: 'var(--ds-color-info)', soft: 'var(--ds-color-info-soft)' },
  warn: {
    color: 'var(--ds-color-warning)',
    soft: 'var(--ds-color-warning-soft)',
  },
  danger: {
    color: 'var(--ds-color-danger)',
    soft: 'var(--ds-color-danger-soft)',
  },
  contrast: {
    color: 'var(--ds-color-text-inverse)',
    soft: 'var(--ds-color-text)',
  },
} as const;

type Severity = keyof typeof severities;

// Pastilles (tag, badge) : fond doux + texte coloré
const softFill = (keys: Severity[]) =>
  Object.fromEntries(
    keys.map((key) => [
      key,
      { background: severities[key].soft, color: severities[key].color },
    ]),
  );

// Messages (alertes) : même principe, avec les états du bouton de fermeture
const messageTone = (severity: Severity) => ({
  background: severities[severity].soft,
  borderColor: 'transparent',
  color: severities[severity].color,
  shadow: 'none',
  closeButton: {
    hoverBackground: 'var(--ds-color-surface-hover)',
    focusRing: { color: 'var(--ds-color-focus-ring)', shadow: 'none' },
  },
  outlined: {
    color: severities[severity].color,
    borderColor: severities[severity].color,
  },
  simple: { color: severities[severity].color },
});

const tagColors = softFill([
  'primary',
  'secondary',
  'success',
  'info',
  'warn',
  'danger',
  'contrast',
]);

const messageColors = {
  info: messageTone('info'),
  success: messageTone('success'),
  warn: messageTone('warn'),
  error: messageTone('danger'),
  secondary: messageTone('secondary'),
};

const contentScheme = {
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
  highlight: {
    background: 'var(--ds-color-primary-soft)',
    focusBackground: 'var(--ds-color-primary-soft)',
    color: 'var(--ds-color-primary)',
    focusColor: 'var(--ds-color-primary-hover)',
  },
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
    // Les palettes internes de PrimeNG pointent vers les nôtres : aucun composant
    // ne peut afficher une couleur étrangère au design system.
    emerald: palette('green'),
    green: palette('green'),
    teal: palette('teal'),
    sky: palette('sky'),
    blue: palette('sky'),
    violet: palette('violet'),
    purple: palette('violet'),
    fuchsia: palette('fuchsia'),
    pink: palette('pink'),
    rose: palette('pink'),
    red: palette('red'),
    orange: palette('orange'),
    amber: palette('orange'),
    yellow: palette('yellow'),
    slate: palette('gray'),
    gray: palette('gray'),
    zinc: palette('gray'),
    neutral: palette('gray'),
    stone: palette('gray'),
  },
  semantic: {
    primary: palette('green'),
    transitionDuration: 'var(--ds-duration-fast)',
    disabledOpacity: 'var(--ds-opacity-disabled)',
    focusRing: {
      width: 'var(--ds-focus-ring-width)',
      style: 'solid',
      color: 'var(--ds-color-focus-ring)',
      offset: 'var(--ds-focus-ring-offset)',
    },
    colorScheme: {
      light: contentScheme,
      dark: contentScheme,
    },
  },
  components: {
    avatar: {
      // Pastille d'icône : couleur de marque par défaut, [dt] pour les variantes
      root: {
        width: 'var(--ds-icon-box-size)',
        height: 'var(--ds-icon-box-size)',
        fontSize: 'var(--ds-font-size-xl)',
        background: 'var(--ds-color-accent-soft)',
        color: 'var(--ds-color-accent)',
        borderRadius: 'var(--ds-icon-box-radius)',
      },
      icon: { size: 'var(--ds-font-size-xl)' },
      lg: {
        width: 'var(--ds-size-14)',
        height: 'var(--ds-size-14)',
        fontSize: 'var(--ds-font-size-3xl)',
        icon: { size: 'var(--ds-font-size-3xl)' },
      },
    },
    badge: {
      root: {
        borderRadius: 'var(--ds-radius-full)',
        padding: '0 var(--ds-space-2)',
        fontSize: 'var(--ds-text-caption-size)',
        fontWeight: 'var(--ds-font-weight-semibold)',
        minWidth: 'var(--ds-space-6)',
        height: 'var(--ds-space-5)',
      },
      colorScheme: { light: tagColors, dark: tagColors },
    },
    button: {
      root: {
        label: { fontWeight: 'var(--ds-font-weight-semibold)' },
        borderRadius: 'var(--ds-radius-md)',
      },
    },
    card: {
      root: {
        background: 'var(--ds-color-surface)',
        borderRadius: 'var(--ds-card-radius)',
        shadow: 'var(--ds-card-shadow)',
      },
      body: {
        padding: 'var(--ds-card-padding)',
        gap: 'var(--ds-space-3)',
      },
      caption: { gap: 'var(--ds-space-1)' },
      title: {
        fontSize: 'var(--ds-text-heading-size)',
        fontWeight: 'var(--ds-font-weight-semibold)',
      },
      subtitle: { color: 'var(--ds-color-text-muted)' },
    },
    dataview: {
      root: {
        borderWidth: '0',
        borderRadius: 'var(--ds-card-radius)',
      },
      content: {
        background: 'transparent',
        borderRadius: 'var(--ds-card-radius)',
      },
    },
    dialog: {
      title: {
        fontSize: 'var(--ds-font-size-xl)',
        fontWeight: 'var(--ds-font-weight-semibold)',
      },
      footer: { gap: 'var(--ds-space-2)' },
    },
    divider: {
      vertical: {
        margin: '0 var(--ds-space-1)',
        padding: 'var(--ds-space-1) 0',
      },
    },
    drawer: {
      title: {
        fontSize: 'var(--ds-font-size-xl)',
        fontWeight: 'var(--ds-font-weight-semibold)',
      },
    },
    message: {
      text: {
        fontSize: 'var(--ds-text-small-size)',
        fontWeight: 'var(--ds-font-weight-medium)',
      },
      content: {
        padding: 'var(--ds-space-3) var(--ds-space-4)',
        gap: 'var(--ds-space-2)',
      },
      colorScheme: { light: messageColors, dark: messageColors },
    },
    progressbar: {
      root: {
        height: 'var(--ds-progress-height)',
        borderRadius: 'var(--ds-radius-full)',
      },
    },
    tag: {
      root: {
        fontSize: 'var(--ds-text-caption-size)',
        fontWeight: 'var(--ds-font-weight-semibold)',
        padding: 'var(--ds-space-0-5) var(--ds-space-2)',
        gap: 'var(--ds-space-1)',
        borderRadius: 'var(--ds-radius-sm)',
        roundedBorderRadius: 'var(--ds-radius-full)',
      },
      icon: { size: 'var(--ds-text-caption-size)' },
      colorScheme: { light: tagColors, dark: tagColors },
    },
    toolbar: {
      // Sert de barre de navigation flottante (dock)
      root: {
        background: 'var(--ds-color-surface)',
        borderColor: 'var(--ds-color-border)',
        borderRadius: 'var(--ds-dock-radius)',
        gap: 'var(--ds-space-1)',
        padding: 'var(--ds-dock-padding)',
      },
      colorScheme: {
        light: { root: { background: 'var(--ds-color-surface)' } },
        dark: { root: { background: 'var(--ds-color-surface)' } },
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

/*
 * Variantes de pastille d'icône (p-avatar) à passer dans [dt].
 * Ex. : <p-avatar icon="pi pi-check" [dt]="avatarTone.success" />
 */
const avatarToneOf = (color: string, soft: string) => ({
  root: { background: soft, color },
});

export const avatarTone = {
  accent: avatarToneOf('var(--ds-color-accent)', 'var(--ds-color-accent-soft)'),
  success: avatarToneOf(
    'var(--ds-color-success)',
    'var(--ds-color-success-soft)',
  ),
  warning: avatarToneOf(
    'var(--ds-color-warning)',
    'var(--ds-color-warning-soft)',
  ),
  danger: avatarToneOf('var(--ds-color-danger)', 'var(--ds-color-danger-soft)'),
  highlight: avatarToneOf(
    'var(--ds-color-highlight)',
    'var(--ds-color-highlight-soft)',
  ),
} as const;

export type AvatarTone = keyof typeof avatarTone;
