import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  EArete,
  EBouton,
  EFilAriane,
  EIcone,
  ENote,
  ENoteActions,
  ESaisie,
  ETailleAuto,
  PreferencesMouvement,
  compter,
} from '@empreinte-studio/angular';
import { ObjectiveStore } from '../../../chore/stores/objective.store';
import { AnnoncesStore } from '../../../chore/stores/annonces.store';
import { CRUMB_TITLE_MAX, shortTitle } from '../../../chore/mapper/title.mapper';
import { SessionStore } from '../../../chore/stores/session.store';
import { ChatStore } from './chat.store';
import { PermissionRequestViewModel } from './chat.models';
import { MarkdownPipe } from './markdown.pipe';
import { STAGE_STATE_TITLES, stageName } from '../stage-labels';

/** Une invitation d'Akari : sa phrase, son bouton, et le message envoyé quand on l'accepte. */
export type AkariInvitation = {
  phrase: string;
  action: string;
  message: string;
};

/** Akari ouvre une conversation vide sur l'objectif. */
export function objectiveInvitation(objectiveTitle: string): AkariInvitation {
  return {
    phrase: `Je peux te proposer des étapes pour « ${objectiveTitle} ». On commence ?`,
    action: 'Propose-moi des étapes',
    message: `Propose-moi des étapes pour « ${objectiveTitle} ».`,
  };
}

/** Akari propose des pas pour l'étape d'où l'on vient (?etape=<id>). */
export function stageInvitation(stageTitle: string): AkariInvitation {
  return {
    phrase: `Je peux te proposer des pas pour l'étape « ${stageTitle} ».`,
    action: 'Propose-moi des pas',
    message: `Propose-moi des pas pour l'étape « ${stageTitle} ».`,
  };
}

/**
 * La demande d'accord d'Akari avant d'ajouter une étape ou un pas, dans la voix d'Empreinte.
 * `stageTitleOf` retrouve le nom de l'étape qui recevrait un pas.
 */
export function permissionPrompt(
  request: PermissionRequestViewModel,
  stageTitleOf: (id: string) => string | undefined = () => undefined,
): string {
  switch (request.kind) {
    case 'stage':
      return request.title
        ? `Je te propose d'ajouter l'étape « ${request.title} ». On l'ajoute ?`
        : "Je te propose d'ajouter une étape. On l'ajoute ?";
    case 'task': {
      const task = request.title ? `le pas « ${request.title} »` : 'un pas';
      const stage = request.objectiveId ? stageTitleOf(request.objectiveId) : undefined;
      return stage
        ? `Je te propose d'ajouter ${task} à l'étape « ${stage} ». On l'ajoute ?`
        : `Je te propose d'ajouter ${task}. On l'ajoute ?`;
    }
    default:
      return "J'ai besoin de ton accord pour continuer. On y va ?";
  }
}

/**
 * Akari pour un objectif (/objectifs/:id/akari) : la conversation avec Akari à gauche, l'arête de
 * l'objectif à droite, qui se remplit quand la personne accepte une étape ou un pas. La tête de
 * l'arête est le seul sceau de l'écran.
 */
@Component({
  selector: 'app-akari',
  imports: [
    RouterLink,
    EArete,
    EBouton,
    EFilAriane,
    EIcone,
    ENote,
    ENoteActions,
    ESaisie,
    ETailleAuto,
    MarkdownPipe,
  ],
  templateUrl: './akari.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ChatStore],
})
export class Akari {
  /** L'objectif (paramètre de route :id). */
  readonly id = input.required<string>();
  /** L'étape pour laquelle préparer une demande de pas (?etape=<id>). */
  readonly etape = input<string | undefined>();

  protected readonly chat = inject(ChatStore);
  private readonly objectives = inject(ObjectiveStore);
  private readonly annonces = inject(AnnoncesStore);
  private readonly session = inject(SessionStore);
  private readonly mouvement = inject(PreferencesMouvement);
  private readonly document = inject(DOCUMENT);

  /** Un objectif racine connu : une étape n'a pas de conversation à elle. */
  private readonly known = computed(() => this.objectives.objectiveOptions().some((option) => option.valeur === this.id()));

  protected readonly detail = computed(() => (this.known() ? this.objectives.objectiveDetail(this.id()) : undefined));

  /** Le titre de l'objectif dans le fil d'Ariane, coupé comme sur l'arête. */
  protected readonly crumb = computed(() => shortTitle(this.detail()?.objective.title ?? '', CRUMB_TITLE_MAX));

  /** Les objectifs sont chargés (objectivesLoaded), et celui-ci n'en fait pas partie. */
  protected readonly notFound = computed(() => this.objectives.objectivesLoaded() && !this.known());

  /**
   * Le chargement de l'objectif est en cours. Après un chargement qui n'a pas abouti, la coque affiche déjà
   * le signalement : l'écran ne prétend pas chercher encore.
   */
  protected readonly searching = computed(() => !this.detail() && !this.notFound() && !this.objectives.error());

  /** La coque affiche un signalement (une note d'Akari) : l'écran ne le répète pas. */
  protected readonly hasReport = this.annonces.aUnSignalement;

  /** L'étape venue de ?etape=<id>, si elle appartient à cet objectif. */
  private readonly stage = computed(() => {
    const stageId = this.etape();
    return stageId ? this.detail()?.stages.find((stage) => stage.id === stageId) : undefined;
  });

  /** « Jusqu'en mai · 4 étapes · 13 pas » */
  protected readonly summary = computed(() => {
    const detail = this.detail();
    if (!detail) return '';
    const stages = detail.stages.length;
    const tasks = detail.taskCount.total;
    return [
      detail.objective.horizon,
      stages ? compter(stages, 'étape') : '',
      tasks ? compter(tasks, 'pas', 'pas') : '',
    ]
      .filter(Boolean)
      .join(' · ');
  });

  /** Les étapes de la colonne de droite : numéro, nom, nombre de pas, état. */
  protected readonly stageRows = computed(() =>
    (this.detail()?.stages ?? []).map((stage) => ({
      id: stage.id,
      index: stage.index,
      title: stageName(stage.title),
      taskCount: compter(stage.tasks.length, 'pas', 'pas'),
      state: [STAGE_STATE_TITLES[stage.state], stage.horizon].filter(Boolean).join(' · '),
    })),
  );

  /** « 2 pas sans étape », ou vide. */
  protected readonly looseTasks = computed(() => {
    const count = this.detail()?.tasksWithoutStage.length ?? 0;
    return count ? `${compter(count, 'pas', 'pas')} sans étape` : '';
  });

  /** La personne signe de son prénom, ou « Toi ». */
  protected readonly personName = computed(() => this.session.currentUser()?.name?.trim().split(/\s+/)[0] || 'Toi');

  /**
   * Akari écoute : le workflow attend un nouveau message, et l'historique est là. Avant, un message envoyé
   * serait effacé par l'historique qui arrive.
   */
  protected readonly ready = computed(() => this.chat.historyLoaded() && this.chat.canSendMessage());

  /** Ce qu'écrit la personne. */
  protected readonly draft = signal('');
  protected readonly canSend = computed(() => this.ready() && this.draft().trim().length > 0);

  /** La personne a parlé depuis son arrivée (sur cet objectif, pour cette étape) : l'invitation s'efface. */
  private readonly spoke = linkedSignal({
    source: () => `${this.id()}|${this.etape() ?? ''}`,
    computation: () => false,
  });

  /**
   * L'invitation d'Akari en fin de conversation, quand il est prêt à écouter :
   * des pas pour l'étape demandée (?etape), sinon des étapes si la conversation est vide.
   */
  protected readonly invitation = computed<AkariInvitation | null>(() => {
    const detail = this.detail();
    if (!detail || !this.ready() || this.spoke()) return null;
    const stage = this.stage();
    if (stage) return stageInvitation(stageName(stage.title));
    return this.chat.messages().length === 0 ? objectiveInvitation(detail.objective.title) : null;
  });

  /** La demande d'accord en cours, en toutes lettres. */
  protected readonly permissionPhrase = computed(() => {
    const request = this.chat.permissionRequest();
    if (!request) return '';
    const stages = this.detail()?.stages ?? [];
    return permissionPrompt(request, (id) => {
      const stage = stages.find((candidate) => candidate.id === id);
      return stage ? stageName(stage.title) : undefined;
    });
  });

  /** « Ajouter » pour une étape ou un pas, « Continuer » pour le reste. */
  protected readonly acceptLabel = computed(() => (this.chat.permissionRequest()?.kind === 'other' ? 'Continuer' : 'Ajouter'));

  /** La ligne d'état, sous la conversation (dite aux lecteurs d'écran). */
  protected readonly status = computed(() => {
    if (this.chat.isLoading()) return 'Akari relit la conversation…';
    if (this.chat.isAwaitingPermission()) return 'Akari attend ton accord.';
    if (this.chat.isStreaming()) return this.chat.processingStatus();
    return '';
  });

  private readonly replies = viewChildren('reply', { read: ElementRef });
  private readonly textarea = viewChild('saisie', { read: ElementRef });
  private readonly acceptButton = viewChild('accept', { read: ElementRef });
  private readonly areteScroller = viewChild('areteScroller', { read: ElementRef });

  /** L'objectif dont la conversation est ouverte. */
  private readonly openedFor = signal<string | null>(null);
  /**
   * La personne vient d'envoyer ou de répondre : la zone de réponse est désactivée, ou le bouton cliqué a
   * disparu, et le focus est perdu. Il revient à la demande d'Akari, ou à la zone de réponse quand Akari
   * est de nouveau prêt.
   */
  private readonly refocus = signal(false);
  /** La dernière réplique affichée au rendu précédent (référence DOM, pas un état de l'écran). */
  private lastReply: HTMLElement | null = null;
  /** Le nombre d'étapes de l'arête quand sa vue a été menée à la fin ; null avant le premier rendu. */
  private shownStages: number | null = null;

  constructor() {
    // Ouvre la conversation dès que l'objectif est connu : l'historique, puis le workflow,
    // repris là où il s'était arrêté.
    effect(() => {
      const id = this.id();
      if (!this.known()) return;
      untracked(() => {
        if (this.openedFor() === id) return;
        this.openedFor.set(id);
        this.chat.clearMessages();
        this.chat.loadChatHistory({ objectifId: id });
        this.chat.initWorkflow(id);
      });
    });

    // Une nouvelle réplique : on la fait venir à l'écran si la personne voyait déjà la fin. À l'ouverture
    // (aucune réplique avant), d'un coup, sans faire défiler toute la conversation sous ses yeux.
    afterRenderEffect(() => {
      const last = (this.replies().at(-1)?.nativeElement as HTMLElement | undefined) ?? null;
      untracked(() => {
        const previous = this.lastReply;
        if (!last || last === previous) return;
        this.lastReply = last;
        if (previous?.isConnected && !this.isVisible(previous)) return;
        const instant = previous === null || this.mouvement.reduit();
        last.scrollIntoView?.({ block: 'nearest', behavior: instant ? 'auto' : 'smooth' });
      });
    });

    // L'arête défile dans une colonne plus étroite qu'elle, et sa tête (le nom de l'objectif, le sceau de
    // l'écran) est à sa fin, comme la dernière étape ajoutée : à l'ouverture et à chaque étape en plus ou en
    // moins, la vue va à la fin. Ailleurs (la personne a fait défiler, un pas change), elle ne bouge pas.
    afterRenderEffect(() => {
      const stages = this.detail()?.aretes.length ?? 0;
      const scroller = this.areteScroller()?.nativeElement as HTMLElement | undefined;
      untracked(() => {
        if (!scroller || stages === this.shownStages) return;
        this.shownStages = stages;
        scroller.scrollLeft = scroller.scrollWidth;
      });
    });

    // Akari demande son accord, ou il est de nouveau prêt : si le focus s'était perdu, il va à « Ajouter »
    // (qui fait lire la demande), ou à la zone de réponse. Au clavier, on ne repart pas du haut de la page.
    afterRenderEffect(() => {
      const asking = this.chat.isAwaitingPermission();
      if (!asking && !this.ready()) return;
      untracked(() => {
        if (!this.refocus()) return;
        this.refocus.set(false);
        const active = this.document.activeElement;
        if (active && active !== this.document.body) return;
        const target = asking ? this.acceptButton() : this.textarea();
        (target?.nativeElement as HTMLElement | undefined)?.focus();
      });
    });
  }

  protected write(event: Event): void {
    this.draft.set((event.target as HTMLTextAreaElement).value);
  }

  /** Entrée envoie ; Maj+Entrée va à la ligne. */
  protected enter(event: Event): void {
    const key = event as KeyboardEvent;
    if (key.shiftKey || key.isComposing) return;
    key.preventDefault();
    this.sendDraft();
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.sendDraft();
  }

  protected accept(invitation: AkariInvitation): void {
    this.say(invitation.message);
  }

  protected answer(permission: boolean): void {
    this.chat.respondToPermission(permission);
    this.refocus.set(true);
  }

  private sendDraft(): void {
    if (this.say(this.draft())) this.draft.set('');
  }

  private say(text: string): boolean {
    const message = text.trim();
    if (!message || !this.ready()) return false;
    this.chat.sendMessageToAi({ message, objectiveId: this.id() });
    this.spoke.set(true);
    this.refocus.set(true);
    return true;
  }

  private isVisible(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    const height = this.document.defaultView?.innerHeight ?? 0;
    return rect.bottom > 0 && rect.top < height;
  }
}
