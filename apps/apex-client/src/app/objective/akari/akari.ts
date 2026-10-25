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
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  type ActionChoisie,
  EArete,
  EBouton,
  EConversation,
  EFilAriane,
  EIcone,
  ERepliqueContenu,
  type Replique,
  compter,
} from '@empreinte-studio/angular';
import { ObjectiveStore } from '../../../chore/stores/objective.store';
import { AnnoncesStore } from '../../../chore/stores/annonces.store';
import { CRUMB_TITLE_MAX, shortTitle } from '../../../chore/mapper/title.mapper';
import { SessionStore } from '../../../chore/stores/session.store';
import { isTemporaryId } from '../../../chore/stores/utils/map-optimistique-id';
import { ChatStore } from './chat.store';
import { PermissionRequestViewModel } from './chat.models';
import { MarkdownPipe } from './markdown.pipe';
import { STAGE_STATE_TITLES, stageName } from '../stage-labels';
import { firstName } from '../../../chore/mapper/person.mapper';

/** Une invitation d'Akari : sa phrase, son bouton, et le message envoyé quand on l'accepte. */
export type AkariInvitation = {
  phrase: string;
  action: string;
  message: string;
};

/**
 * Une réplique du fil d'Akari : un message de la conversation, l'invitation d'Akari ou sa demande d'accord.
 * Un message est rendu en Markdown assaini ; les phrases de l'écran restent du texte.
 */
export type AkariReply = Replique & {
  readonly markdown: boolean;
  /** L'invitation qu'accepte son bouton. */
  readonly invitation?: AkariInvitation;
};

/** Une seule colonne (akari.css) : la conversation suit l'en-tête de la page. */
const STACKED_LAYOUT = '(max-width: 1100px)';

/** Les répliques que l'écran ajoute après les messages, et les boutons de la demande d'accord. */
export const INVITATION_REPLY_ID = 'akari-invitation';
export const PERMISSION_REPLY_ID = 'akari-demande';
export const ACCEPT_ACTION = 'accepter';
export const DECLINE_ACTION = 'pas-maintenant';

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
 * Akari pour un objectif (/objectifs/:id/akari) : la conversation avec Akari à gauche (e-conversation
 * d'Empreinte), l'arête de l'objectif à droite, qui se remplit quand la personne accepte une étape ou un pas.
 * La tête de l'arête est le seul sceau de l'écran.
 *
 * Au-dessus de 1100px, l'écran tient dans la fenêtre (data.fitsWindow de sa route, akari.css) : la conversation
 * défile à l'intérieur, s'ouvre sur ses dernières répliques et garde sa zone de réponse au pied. En dessous, elle
 * suit l'en-tête, et la page y descend à l'ouverture. Empreinte suit la fin de la conversation et rend le focus à
 * la zone de réponse quand un bouton d'une réplique disparaît.
 */
@Component({
  selector: 'app-akari',
  imports: [RouterLink, EArete, EBouton, EConversation, EFilAriane, EIcone, ERepliqueContenu, MarkdownPipe],
  templateUrl: './akari.html',
  styleUrl: './akari.css',
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
  private readonly document = inject(DOCUMENT);

  /** La conversation d'Empreinte, amenée à l'écran à l'ouverture quand elle suit l'en-tête (une seule colonne). */
  private readonly conversation = viewChild(EConversation, { read: ElementRef });

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
  protected readonly personName = computed(() => firstName(this.session.currentUser()?.name, 'Toi'));

  /**
   * Akari écoute : le workflow attend un nouveau message, et l'historique est là. Avant, un message envoyé
   * serait effacé par l'historique qui arrive. La personne peut écrire pendant ce temps : seul l'envoi attend.
   */
  protected readonly ready = computed(() => this.chat.historyLoaded() && this.chat.canSendMessage());

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

  /**
   * Le fil : les messages de la conversation, puis l'invitation d'Akari ou sa demande d'accord, avec leurs
   * boutons. Le message que la personne vient d'envoyer garde son id temporaire jusqu'à son enregistrement :
   * il s'écrit en encre douce jusque-là.
   */
  protected readonly replies = computed<AkariReply[]>(() => {
    const replies: AkariReply[] = this.chat.orderLatestMessages().map((message) => ({
      id: message.id,
      auteur: message.sender === 'user' ? 'personne' : 'assistant',
      texte: message.content,
      markdown: true,
      enAttente: isTemporaryId(message.id),
    }));
    const invitation = this.invitation();
    if (invitation) {
      replies.push({
        id: INVITATION_REPLY_ID,
        auteur: 'assistant',
        texte: invitation.phrase,
        markdown: false,
        invitation,
        actions: [{ id: ACCEPT_ACTION, libelle: invitation.action }],
      });
    }
    if (this.chat.isAwaitingPermission()) {
      replies.push({
        id: PERMISSION_REPLY_ID,
        auteur: 'assistant',
        texte: this.permissionPhrase(),
        markdown: false,
        actions: [
          { id: ACCEPT_ACTION, libelle: this.acceptLabel() },
          { id: DECLINE_ACTION, libelle: 'Pas maintenant' },
        ],
      });
    }
    return replies;
  });

  /** L'objectif dont la conversation est ouverte. */
  private readonly openedFor = signal<string | null>(null);

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

    // La demande d'accord arrive dans le fil, qui ne se lit pas à voix haute : sa phrase est dite une fois (la
    // ligne d'état dit seulement « Akari attend ton accord. »), pour que ses deux boutons aient un sens.
    let announced = '';
    effect(() => {
      const phrase = this.chat.isAwaitingPermission() ? this.permissionPhrase() : '';
      if (phrase && phrase !== announced) this.annonces.annoncer(phrase);
      announced = phrase;
    });

    // Une seule colonne (1100px et moins) : la conversation suit l'en-tête de la page. Quand son historique est là,
    // la page descend jusqu'à son pied : ses dernières répliques et sa zone de réponse sont à l'écran. Une fois par
    // objectif ouvert, et seulement si la conversation est encore plus bas (la personne n'y est pas déjà, ni plus
    // bas, comme après un retour arrière qui retrouve sa place).
    let framedFor: string | null = null;
    afterRenderEffect({
      earlyRead: () => {
        const id = this.openedFor();
        const host = this.conversation()?.nativeElement as HTMLElement | undefined;
        if (!id || !host || !this.chat.historyLoaded() || framedFor === id) return null;
        framedFor = id;
        const view = this.document.defaultView;
        if (!view || typeof view.matchMedia !== 'function' || !view.matchMedia(STACKED_LAYOUT).matches) return null;
        const { top, bottom } = host.getBoundingClientRect();
        return top >= 0 && bottom > view.innerHeight ? host : null;
      },
      write: (below) => below()?.scrollIntoView({ block: 'end', behavior: 'instant' }),
    });
  }

  /** La personne envoie un message (Empreinte l'a nettoyé et vide la zone de réponse). */
  protected say(text: string): void {
    const message = text.trim();
    if (!message || !this.ready()) return;
    this.chat.sendMessageToAi({ message, objectiveId: this.id() });
    this.spoke.set(true);
  }

  /** Un bouton sous une réplique : accepter l'invitation, ou répondre à la demande d'accord. */
  protected act({ replique, action }: ActionChoisie<AkariReply>): void {
    if (replique.invitation) {
      this.say(replique.invitation.message);
    } else if (replique.id === PERMISSION_REPLY_ID) {
      this.chat.respondToPermission(action.id === ACCEPT_ACTION);
    }
  }
}
