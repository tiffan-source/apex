import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  booleanAttribute,
  computed,
  contentChild,
  inject,
  input,
} from '@angular/core';
import { FORM_FIELD, type ValidationError } from '@angular/forms/signals';

let suivant = 0;
/** Un id unique dans la page : `ax-champ-3`. */
export function idUnique(prefixe: string): string {
  suivant += 1;
  return `${prefixe}-${suivant}`;
}

/** Le message d'une erreur de validation, dans la voix d'Apex : la solution, jamais un reproche. */
export function ecrireErreur(erreur: ValidationError): string {
  if (erreur.message) return erreur.message;
  const e = erreur as ValidationError & Record<string, unknown>;
  switch (erreur.kind) {
    case 'required':
      return 'Écris quelque chose ici pour continuer.';
    case 'email':
      return 'Cette adresse semble incomplète. Ajoute la fin, par exemple @gmail.com.';
    case 'minLength':
      return `Encore un peu : au moins ${e['minLength']} caractères.`;
    case 'maxLength':
      return `C'est un peu long : ${e['maxLength']} caractères au plus.`;
    case 'min':
      return `Choisis une valeur d'au moins ${e['min']}.`;
    case 'max':
      return `Choisis une valeur de ${e['max']} au plus.`;
    case 'pattern':
      return "Le format n'est pas encore le bon. Vérifie ce que tu as écrit.";
    case 'parse':
      return "Cette valeur n'est pas lisible. Vérifie ce que tu as écrit.";
    default:
      return 'Vérifie ce que tu as écrit.';
  }
}

/** Ce qu'un champ lit de son contrôle : l'id où pointe le libellé, l'erreur de Signal Forms, l'état forcé. */
export abstract class AxFieldControl {
  abstract readonly controlId: () => string;
  abstract readonly autoMessage: () => string;
  abstract readonly forcedInvalid: () => boolean;
}

/** La première erreur de Signal Forms d'un contrôle, une fois touché. */
export function autoMessageOf(formField: { state(): { touched(): boolean; errors(): readonly ValidationError[] } } | null) {
  return () => {
    const state = formField?.state();
    if (!state || !state.touched()) return '';
    const erreur = state.errors()[0];
    return erreur ? ecrireErreur(erreur) : '';
  };
}

/**
 * Le contrôle natif d'un champ (`input[axControl]`, `textarea[axControl]`) : il reçoit son id, sa
 * description et son état invalide du champ qui l'entoure, et lit l'erreur de Signal Forms.
 */
@Directive({
  selector: 'input[axControl], textarea[axControl]',
  providers: [{ provide: AxFieldControl, useExisting: AxControl }],
  host: {
    class: 'input',
    '[id]': 'id()',
    '[attr.aria-describedby]': 'field?.describedBy() || null',
    '[attr.aria-invalid]': 'field?.invalid() || forceInvalid() ? "true" : null',
  },
})
export class AxControl implements AxFieldControl {
  readonly id = input(idUnique('ax-controle'));
  /** Forcer l'état invalide (validation maison). */
  readonly forceInvalid = input(false, { transform: booleanAttribute });

  private readonly formField = inject(FORM_FIELD, { optional: true, self: true });
  protected readonly field = inject(AxField, { optional: true });

  readonly controlId = () => this.id();
  readonly forcedInvalid = () => this.forceInvalid();
  readonly autoMessage = computed(autoMessageOf(this.formField));
}

/**
 * <ax-field label="Ton objectif" hint="…" [error]="…" optional> : libellé toujours visible, contrôle,
 * aide, message. Le message s'écrit en encre, avec un losange : jamais en rouge.
 */
@Component({
  selector: 'ax-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ax-field' },
  styles: `
    :host { display: grid; gap: 8px; min-width: 0; }
    label { display: flex; align-items: baseline; gap: 8px; font-size: 13px; line-height: 18px; font-weight: 600; }
    .optional { font-weight: 400; color: var(--encre-douce); }
    .hint { margin: 0; font-size: 13px; line-height: 18px; color: var(--encre-douce); }
    .message { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 13px; line-height: 18px; font-weight: 500; }
    .message::before { content: ''; flex: none; width: 7px; height: 7px; border-radius: 1px; background: var(--encre); transform: rotate(45deg); }
    .message:empty { display: none; }
  `,
  template: `
    <label [id]="labelId" [attr.for]="control()?.controlId()">
      {{ label() }}
      @if (optional()) {
        <span class="optional">facultatif</span>
      }
    </label>
    <ng-content />
    @if (hint()) {
      <p class="hint" [id]="hintId">{{ hint() }}</p>
    }
    <p class="message" aria-live="polite" [id]="messageId">{{ message() }}</p>
  `,
})
export class AxField {
  readonly label = input.required<string>();
  readonly hint = input<string | undefined>(undefined);
  readonly error = input<string | null | undefined>(undefined);
  readonly optional = input(false, { transform: booleanAttribute });

  protected readonly control = contentChild(AxFieldControl);
  readonly labelId = idUnique('ax-libelle');
  protected readonly hintId = idUnique('ax-aide');
  protected readonly messageId = idUnique('ax-message');

  readonly message = computed(() => this.error() || this.control()?.autoMessage() || '');
  readonly invalid = computed(() => !!this.message() || !!this.control()?.forcedInvalid());
  readonly describedBy = computed(() =>
    [this.hint() ? this.hintId : '', this.message() ? this.messageId : ''].filter(Boolean).join(' '),
  );
}
