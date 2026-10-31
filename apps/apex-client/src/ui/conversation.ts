import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  Directive,
  ElementRef,
  TemplateRef,
  afterRenderEffect,
  booleanAttribute,
  computed,
  contentChild,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { AxIcon } from './icon';
import { idUnique } from './field';

/** Un bouton sous une réplique. */
export interface ActionReplique {
  id: string;
  libelle: string;
}

/** Une réplique du fil : d'Akari ou de la personne. `enAttente` : envoyée, pas encore enregistrée. */
export interface Replique {
  id: string;
  auteur: 'assistant' | 'personne';
  texte: string;
  qui?: string;
  actions?: readonly ActionReplique[];
  enAttente?: boolean;
}

/** Le bouton choisi, et sa réplique. */
export interface ActionChoisie<R extends Replique = Replique> {
  replique: R;
  action: ActionReplique;
}

/** Le gabarit du contenu d'une réplique (pour rendre du Markdown) : `let-r` est la réplique. */
@Directive({ selector: 'ng-template[axReplyContent]' })
export class AxReplyContent<R extends Replique> {
  readonly axReplyContent = input<readonly R[]>([]);
  readonly template = inject<TemplateRef<{ $implicit: R }>>(TemplateRef);

  /* eslint-disable @typescript-eslint/no-unused-vars -- signature imposée par Angular */
  static ngTemplateContextGuard<R extends Replique>(
    _directive: AxReplyContent<R>,
    context: unknown,
  ): context is { $implicit: R } {
    return true;
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}

/** Distance au pied du fil sous laquelle on suit encore les nouvelles répliques. */
const SUIVI_PX = 96;

/**
 * <ax-conversation> : le fil avec Akari, la ligne d'état et la zone de réponse. Présentationnelle : elle
 * annonce (send) et (action), l'écran décide. Le fil défile seul (hauteur à donner à l'hôte), s'ouvre sur ses
 * dernières répliques et les suit tant que la personne en lit la fin. Entrée envoie, Maj+Entrée va à la ligne.
 */
@Component({
  selector: 'ax-conversation',
  imports: [NgTemplateOutlet, CdkTextareaAutosize, AxIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ax-conversation' },
  templateUrl: './conversation.html',
  styleUrl: './conversation.css',
})
export class AxConversation<R extends Replique = Replique> {
  readonly replies = input<readonly R[]>([]);
  /** Ce que fait Akari (« Akari réfléchit… »), sous la dernière réplique. */
  readonly status = input('');
  /** L'envoi est possible ; sinon, on écrit quand même, mais l'envoi attend. */
  readonly ready = input(true, { transform: booleanAttribute });
  readonly draft = model('');
  readonly assistant = input('Akari');
  readonly person = input('Toi');
  readonly label = input('Conversation avec Akari');
  readonly inputLabel = input('Réponds à Akari');
  readonly placeholder = input('Réponds à Akari…');
  /** Des débuts de réponse, proposés sous la zone de réponse. */
  readonly suggestions = input<readonly string[]>([]);

  readonly send = output<string>();
  readonly action = output<ActionChoisie<R>>();

  protected readonly content = contentChild(AxReplyContent<R>);
  private readonly thread = viewChild.required<ElementRef<HTMLElement>>('thread');
  private readonly textarea = viewChild.required<ElementRef<HTMLTextAreaElement>>('textarea');
  private readonly document = inject(DOCUMENT);

  protected readonly threadId = idUnique('ax-fil');
  protected readonly statusId = idUnique('ax-statut');
  /** La personne lit plus haut : on lui propose de revenir aux dernières répliques. */
  protected readonly away = signal(false);
  protected readonly canSend = computed(() => this.ready() && this.draft().trim().length > 0);

  private seen = 0;
  private lastId: string | undefined;
  /** Un bouton de réplique vient d'être choisi : s'il disparaît, le focus revient à la zone de réponse. */
  private refocus = false;

  constructor() {
    afterRenderEffect({
      write: () => {
        const replies = this.replies();
        const last = replies.at(-1)?.id;
        const fil = this.thread().nativeElement;
        const opening = this.seen === 0 && replies.length > 0;
        const grew = replies.length !== this.seen || last !== this.lastId;
        this.seen = replies.length;
        this.lastId = last;
        this.keepFocus();
        if (!grew) return;
        if (opening || !this.away()) fil.scrollTop = fil.scrollHeight;
      },
    });
  }

  protected name(reply: R): string {
    return reply.qui ?? (reply.auteur === 'assistant' ? this.assistant() : this.person());
  }

  protected onScroll(): void {
    const fil = this.thread().nativeElement;
    this.away.set(fil.scrollHeight - fil.scrollTop - fil.clientHeight > SUIVI_PX);
  }

  /** Revenir aux dernières répliques. */
  allerALaFin(): void {
    const fil = this.thread().nativeElement;
    fil.scrollTo({ top: fil.scrollHeight, behavior: 'smooth' });
    this.away.set(false);
  }

  /** Donner le focus à la zone de réponse. */
  focaliser(): void {
    this.textarea().nativeElement.focus();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    this.submit();
  }

  protected submit(): void {
    const text = this.draft().trim();
    if (!text || !this.ready()) return;
    this.send.emit(text);
    this.draft.set('');
    this.away.set(false);
  }

  protected suggest(text: string): void {
    if (this.ready()) {
      this.send.emit(text);
      this.away.set(false);
    } else {
      this.draft.set(text);
      this.focaliser();
    }
  }

  protected choose(reply: R, action: ActionReplique): void {
    this.refocus = true;
    this.action.emit({ replique: reply, action });
  }

  /** Un bouton de réplique qui disparaît après un clic emporte le focus : il revient à la zone de réponse. */
  private keepFocus(): void {
    if (!this.refocus) return;
    this.refocus = false;
    const active = this.document.activeElement;
    if (!active || active === this.document.body || !active.isConnected) this.focaliser();
  }
}
