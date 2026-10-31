import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { motsAEviter } from '../../../ui';
import { ObjectiveStore } from '../../../chore/stores/objective.store';
import { AnnoncesStore } from '../../../chore/stores/annonces.store';
import { SessionStore } from '../../../chore/stores/session.store';
import type { ObjectiveViewModel, TaskViewModel } from '../../../chore/models/objective.viewmodel';
import { rootObjectiveOptions, toObjectiveDetail } from '../../../chore/mapper/objective-view.mapper';
import { voiceIssues } from '../../../chore/constants/messages.constante';
import { Akari, objectiveInvitation, permissionPrompt, stageInvitation } from './akari';
import { STAGE_STATE_TITLES, UNTITLED_STAGE } from '../stage-labels';
import { AKARI_REPLIED, AKARI_REPORTS, AKARI_STATUS, ChatStore } from './chat.store';
import type { MessageViewModel, PermissionRequestViewModel } from './chat.models';

/*
 * L'écran Akari d'un objectif, avec des stores simulés : l'en-tête, la conversation (répliques,
 * invitations, demandes d'accord, ligne d'état, zone de réponse, débuts de réponse), le chemin à droite, et la voix.
 * La conversation est ax-conversation du kit : son défilement (ouverture sur les dernières répliques, suivi de
 * la fin, « Dernières répliques ») relève du kit.
 */

const OBJECTIVES: ObjectiveViewModel[] = [
  { id: 'semi', title: 'Semi-marathon', why: 'Courir pour moi', description: '', dueDate: '', parentId: null },
  { id: 'endurance', title: 'Endurance', why: '', description: '', dueDate: '', parentId: 'semi' },
  { id: 'vitesse', title: 'Vitesse', why: '', description: '', dueDate: '', parentId: 'semi' },
];

const TASKS: TaskViewModel[] = [
  { id: 't1', title: 'Courir 8 km', importance: 4, urgency: 2, done: false, objectiveId: 'endurance' },
  { id: 't2', title: 'Sortie longue', importance: 4, urgency: 2, done: true, objectiveId: 'endurance' },
  { id: 't3', title: 'Fractionné', importance: 3, urgency: 3, done: false, objectiveId: 'vitesse' },
  { id: 't4', title: 'Acheter des chaussures', importance: 2, urgency: 2, done: false, objectiveId: 'semi' },
];

const HISTORY: MessageViewModel[] = [
  { id: 'm1', sender: 'user', content: 'Je veux courir un **semi** en mai.', timestamp: new Date(2026, 9, 20, 9) },
  { id: 'm2', sender: 'assistant', content: 'Alors commençons par **l’endurance**.', timestamp: new Date(2026, 9, 20, 10) },
];

/** Un ChatStore simulé : des signaux réglables et des méthodes espionnées. */
function fakeChat() {
  const messages = signal<MessageViewModel[]>([]);
  return {
    messages,
    orderLatestMessages: computed(() => [...messages()].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())),
    historyLoaded: signal(true),
    isLoading: signal(false),
    isStreaming: signal(false),
    canSendMessage: signal(true),
    isAwaitingPermission: signal(false),
    permissionRequest: signal<PermissionRequestViewModel | null>(null),
    processingStatus: signal<string>(AKARI_STATUS.SendingPromptToAI),
    clearMessages: vi.fn(),
    loadChatHistory: vi.fn(),
    initWorkflow: vi.fn(),
    sendMessageToAi: vi.fn(),
    respondToPermission: vi.fn(),
  };
}

/** Un ObjectiveStore simulé, construit sur les vraies fonctions de vue. */
function fakeObjectives() {
  const objectives = signal<ObjectiveViewModel[]>(OBJECTIVES);
  const tasks = signal<TaskViewModel[]>(TASKS);
  return {
    objectives,
    tasks,
    objectivesLoaded: signal(true),
    error: signal<string | null>(null),
    objectiveOptions: computed(() => rootObjectiveOptions(objectives())),
    objectiveDetail: (id: string) => toObjectiveDetail(id, objectives(), tasks()),
  };
}

type Setup = {
  id?: string;
  etape?: string;
  history?: MessageViewModel[];
  configure?: (chat: ReturnType<typeof fakeChat>, objectives: ReturnType<typeof fakeObjectives>) => void;
  userName?: string;
};

async function setup({ id = 'semi', etape, history = [], configure, userName = 'Léa Martin' }: Setup = {}) {
  const chat = fakeChat();
  chat.messages.set(history);
  const objectives = fakeObjectives();
  configure?.(chat, objectives);
  const session = {
    currentUser: signal({ id: 'u1', name: userName, email: 'lea@exemple.fr' }),
    currentUserId: signal('u1'),
  };

  TestBed.configureTestingModule({
    imports: [Akari],
    providers: [
      provideRouter([]),
      { provide: ObjectiveStore, useValue: objectives },
      { provide: SessionStore, useValue: session },
    ],
  });
  TestBed.overrideComponent(Akari, { set: { providers: [{ provide: ChatStore, useValue: chat }] } });

  const fixture = TestBed.createComponent(Akari);
  fixture.componentRef.setInput('id', id);
  if (etape) fixture.componentRef.setInput('etape', etape);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, chat, objectives, root: fixture.nativeElement as HTMLElement };
}

async function refresh(fixture: ComponentFixture<Akari>) {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const buttonsOf = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>('button, a'));
const buttonNamed = (root: HTMLElement, name: string) => buttonsOf(root).find((button) => text(button) === name);
const statusLine = (root: HTMLElement) => root.querySelector('p[role="status"]');
const repliesOf = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>('ax-conversation ol.thread > li.reply'));
const lastReply = (root: HTMLElement) => repliesOf(root).at(-1) as HTMLElement;
const signatureOf = (reply: Element | undefined) => text(reply?.querySelector('.who, p.sr-only'));
const proseOf = (reply: Element | undefined) => reply?.querySelector('.prose') as HTMLElement;
const textarea = (root: HTMLElement) => root.querySelector('textarea') as HTMLTextAreaElement;
const sendButton = (root: HTMLElement) => root.querySelector('button[aria-label="Envoyer"]') as HTMLButtonElement;
/** Le kit garde « Envoyer » focalisable : il le dit indisponible par aria-disabled. */
const sendDisabled = (root: HTMLElement) => sendButton(root).getAttribute('aria-disabled') === 'true';
const suggestionsOf = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLButtonElement>('ax-conversation button.suggestion'));
const trail = (root: HTMLElement) => root.querySelector('aside[aria-labelledby="akari-titre-chemin"]') as HTMLElement;
const stepsOf = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('ax-path li.step:not(.step--summit)')).map((step) => [text(step.querySelector('.name')), text(step.querySelector('.state'))]);

/** Tout ce que l'écran dit : son texte, et ses noms accessibles. */
function screenTexts(root: HTMLElement): string[] {
  const attributes = Array.from(root.querySelectorAll('[aria-label], [placeholder]')).flatMap((element) =>
    [element.getAttribute('aria-label'), element.getAttribute('placeholder')].filter((value): value is string => !!value),
  );
  return [text(root), ...attributes];
}

afterEach(() => {
  TestBed.resetTestingModule();
});

describe('Akari : l’en-tête', () => {
  it('dit « Avec Akari », pour quel objectif, et qui décide', async () => {
    const { root } = await setup();
    const h1 = root.querySelector('h1') as HTMLElement;
    expect(h1.classList).toContain('t1');
    expect(text(h1)).toBe('Avec Akari, pour « Semi-marathon »');
    expect(text(h1.querySelector('.serif.accent'))).toBe('Akari');
    // Le titre de l'objectif est dit aux lecteurs d'écran ; à l'œil, le lien de retour le porte.
    expect(text(h1.querySelector('.sr-only'))).toBe(', pour « Semi-marathon »');
    expect(text(root.querySelector('header'))).toContain("Akari propose, tu décides. Rien n'est ajouté sans ton accord.");
  });

  it('dit qu’Akari est là, d’un point qui luit', async () => {
    const { root } = await setup();
    const chip = root.querySelector('.topbar .chip') as HTMLElement;
    expect(text(chip)).toBe('Akari est là');
    expect(chip.querySelector('.live')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('ramène à l’objectif par un lien discret', async () => {
    const { root } = await setup();
    const back = buttonNamed(root, 'Revenir à Semi-marathon') as HTMLAnchorElement;
    expect(back.getAttribute('href')).toBe('/objectifs/semi');
    expect(back.classList).toContain('btn--ghost');
    expect(back.querySelector('ax-icon')).not.toBeNull();
  });

  it('coupe un long titre dans le lien de retour, comme l’arête, et le garde entier dans le titre', async () => {
    const title = 'Préparer et courir un semi-marathon avant la fin du mois de mai';
    const { root } = await setup({
      configure: (_, store) => store.objectives.update((list) => list.map((o) => (o.id === 'semi' ? { ...o, title } : o))),
    });
    expect(text(root.querySelector('.topbar a'))).toBe('Revenir à Préparer et courir un…');
    expect(text(root.querySelector('h1'))).toContain(title);
  });
});

describe('Akari : l’ouverture de la conversation', () => {
  it('charge l’historique et reprend le workflow de l’objectif, une seule fois', async () => {
    const { fixture, chat, objectives } = await setup();
    expect(chat.clearMessages).toHaveBeenCalledTimes(1);
    expect(chat.loadChatHistory).toHaveBeenCalledWith({ objectifId: 'semi' });
    expect(chat.initWorkflow).toHaveBeenCalledWith('semi');

    // Akari ajoute une étape : les objectifs sont rechargés, la conversation reste ouverte.
    objectives.objectives.set([...OBJECTIVES, { id: 'portfolio', title: 'Portfolio', why: '', description: '', dueDate: '', parentId: 'semi' }]);
    await refresh(fixture);
    expect(chat.loadChatHistory).toHaveBeenCalledTimes(1);
    expect(chat.initWorkflow).toHaveBeenCalledTimes(1);
  });

  it('attend que l’objectif soit chargé avant d’ouvrir la conversation', async () => {
    const { fixture, chat, objectives, root } = await setup({
      configure: (_, store) => {
        store.objectives.set([]);
        store.objectivesLoaded.set(false);
      },
    });
    expect(text(statusLine(root))).toBe('Akari retrouve ton objectif…');
    expect(chat.loadChatHistory).not.toHaveBeenCalled();

    objectives.objectives.set(OBJECTIVES);
    objectives.objectivesLoaded.set(true);
    await refresh(fixture);
    expect(text(root.querySelector('h1'))).toBe('Avec Akari, pour « Semi-marathon »');
    expect(chat.loadChatHistory).toHaveBeenCalledWith({ objectifId: 'semi' });
  });

  it('ne retrouve pas un objectif inconnu, ni une étape prise pour un objectif', async () => {
    const { chat, root } = await setup({ id: 'endurance' });
    expect(text(root.querySelector('h1'))).toBe('Cet objectif est introuvable');
    expect(text(root)).toContain('Le lien est peut-être incomplet. Retrouve-le parmi tes objectifs.');
    expect(buttonNamed(root, 'Voir mes objectifs')?.getAttribute('href')).toBe('/');
    expect(statusLine(root)).toBeNull();
    expect(chat.loadChatHistory).not.toHaveBeenCalled();
    expect(chat.initWorkflow).not.toHaveBeenCalled();
    expect(root.querySelector('ax-path')).toBeNull();
  });

  it('ne prétend pas chercher quand les objectifs n’ont pas pu être chargés', async () => {
    const { fixture, chat, root } = await setup({
      configure: (_, store) => {
        store.objectives.set([]);
        store.objectivesLoaded.set(false);
        store.error.set('Je n’ai pas pu charger tes objectifs.');
      },
    });
    const annonces = TestBed.inject(AnnoncesStore);
    annonces.signaler('Je n’ai pas pu charger tes objectifs.');
    await refresh(fixture);
    // La coque affiche le signalement : l'écran ne dit ni « introuvable », ni « Akari retrouve… », mais garde
    // un titre et un chemin.
    expect(statusLine(root)).toBeNull();
    expect(text(root)).not.toContain('introuvable');
    expect(text(root.querySelector('h1'))).toBe('Tes objectifs ne sont pas chargés');
    expect(root.querySelector('p.hint')).toBeNull();
    expect(buttonNamed(root, 'Voir mes objectifs')?.getAttribute('href')).toBe('/');
    expect(chat.loadChatHistory).not.toHaveBeenCalled();

    annonces.compris(); // la note est lue : l'écran dit quoi faire
    await refresh(fixture);
    expect(text(root.querySelector('p.hint'))).toBe('Vérifie ta connexion, puis recharge la page.');
  });
});

describe('Akari : les répliques', () => {
  it('pose la conversation dans sa grande carte, à côté du chemin', async () => {
    const { root } = await setup({ history: HISTORY });
    const conversation = root.querySelector('.layout > .card.talk > ax-conversation') as HTMLElement;
    expect(conversation.classList).toContain('conversation');
    expect(conversation.querySelector('ol.thread')?.getAttribute('aria-label')).toBe('Conversation avec Akari');
    expect(root.querySelector('.layout > aside.card')).not.toBeNull();
    // L'écran tient dans la fenêtre (akari.css) seulement quand la conversation est là.
    expect(root.querySelector('.screen')?.classList).toContain('akari');
  });

  it('Akari signe de son nom, la personne de son prénom (dit aux lecteurs d’écran)', async () => {
    const { root } = await setup({ history: HISTORY });
    const replies = repliesOf(root);
    expect(replies).toHaveLength(2);

    const [mine, akari] = replies;
    expect(mine.classList).toContain('reply--me');
    expect(signatureOf(mine)).toBe('Léa');
    expect(proseOf(mine).querySelector('strong')?.textContent).toBe('semi');

    expect(akari.classList).toContain('reply--akari');
    expect(signatureOf(akari)).toBe('Akari');
    expect(proseOf(akari).querySelector('strong')?.textContent).toBe('l’endurance');
  });

  it('signe « Toi » quand la personne n’a pas de prénom', async () => {
    const { root } = await setup({ history: HISTORY, userName: '' });
    expect(signatureOf(repliesOf(root)[0])).toBe('Toi');
  });

  it('assainit le Markdown d’une réplique', async () => {
    const { root } = await setup({
      history: [{ id: 'x', sender: 'assistant', content: 'Voici <img src="x" onerror="alert(1)"> <script>alert(2)</script>[lien](javascript:alert(3))', timestamp: new Date() }],
    });
    const prose = proseOf(lastReply(root));
    expect(prose.innerHTML).not.toMatch(/onerror|<script|javascript:/);
  });

  it('écrit en encre douce le message qui part encore', async () => {
    const { fixture, chat, root } = await setup({ history: HISTORY });
    chat.messages.update((messages) => [...messages, { id: 'temp-id-1', sender: 'user', content: 'Et ensuite ?', timestamp: new Date(2026, 9, 20, 11) }]);
    await refresh(fixture);
    expect(lastReply(root).classList).toContain('pending');

    // Le workflow l'enregistre : il reçoit son vrai id.
    chat.messages.update((messages) => messages.map((m) => (m.id === 'temp-id-1' ? { ...m, id: 'm3' } : m)));
    await refresh(fixture);
    expect(lastReply(root).classList).not.toContain('pending');
  });
});

describe('Akari : les invitations', () => {
  it('ouvre une conversation vide en proposant des étapes', async () => {
    const { chat, fixture, root } = await setup();
    const invitation = lastReply(root);
    expect(invitation.classList).toContain('reply--akari');
    expect(text(proseOf(invitation))).toBe('Je peux te proposer des étapes pour « Semi-marathon ». On commence ?');

    buttonNamed(root, 'Propose-moi des étapes')?.click();
    await refresh(fixture);
    expect(chat.sendMessageToAi).toHaveBeenCalledWith({ message: 'Propose-moi des étapes pour « Semi-marathon ».', objectiveId: 'semi' });
    expect(buttonNamed(root, 'Propose-moi des étapes')).toBeUndefined();
  });

  it('attend l’historique et un Akari prêt avant d’inviter', async () => {
    const { fixture, chat, root } = await setup({
      configure: (c) => {
        c.historyLoaded.set(false);
        c.isLoading.set(true);
      },
    });
    expect(buttonNamed(root, 'Propose-moi des étapes')).toBeUndefined();
    expect(text(statusLine(root))).toBe('Akari relit la conversation…');

    chat.historyLoaded.set(true);
    chat.isLoading.set(false);
    chat.canSendMessage.set(false);
    await refresh(fixture);
    expect(buttonNamed(root, 'Propose-moi des étapes')).toBeUndefined();

    chat.canSendMessage.set(true);
    await refresh(fixture);
    expect(buttonNamed(root, 'Propose-moi des étapes')).toBeDefined();
  });

  it('ne réinvite pas quand la conversation a déjà commencé', async () => {
    const { root } = await setup({ history: HISTORY });
    expect(buttonNamed(root, 'Propose-moi des étapes')).toBeUndefined();
  });

  it('avec ?etape, propose des pas pour cette étape, même après une conversation', async () => {
    const { chat, fixture, root } = await setup({ etape: 'endurance', history: HISTORY });
    expect(text(proseOf(lastReply(root)))).toBe("Je peux te proposer des pas pour l'étape « Endurance ».");

    buttonNamed(root, 'Propose-moi des pas')?.click();
    await refresh(fixture);
    expect(chat.sendMessageToAi).toHaveBeenCalledWith({ message: "Propose-moi des pas pour l'étape « Endurance ».", objectiveId: 'semi' });
    expect(buttonNamed(root, 'Propose-moi des pas')).toBeUndefined();
  });

  it('ignore une étape qui n’appartient pas à l’objectif', async () => {
    const { root } = await setup({ etape: 'inconnue' });
    expect(buttonNamed(root, 'Propose-moi des pas')).toBeUndefined();
    expect(buttonNamed(root, 'Propose-moi des étapes')).toBeDefined();
  });
});

describe('Akari : les demandes d’accord', () => {
  const asking = (request: PermissionRequestViewModel) => (chat: ReturnType<typeof fakeChat>) => {
    chat.canSendMessage.set(false);
    chat.isAwaitingPermission.set(true);
    chat.permissionRequest.set(request);
  };

  it('propose une étape : « Ajouter » ou « Pas maintenant »', async () => {
    const { chat, root } = await setup({ history: HISTORY, configure: asking({ kind: 'stage', title: 'Portfolio', parentId: 'semi' }) });
    const request = lastReply(root);
    expect(signatureOf(request)).toBe('Akari');
    expect(text(statusLine(root))).toBe('Akari attend ton accord.');

    const add = buttonNamed(root, 'Ajouter') as HTMLButtonElement;
    const later = buttonNamed(root, 'Pas maintenant') as HTMLButtonElement;
    expect(add.classList).toContain('btn--accent');
    expect(add.classList).toContain('btn--sm');
    expect(later.classList).toContain('btn--ghost');

    // Les deux boutons font lire la demande : leur groupe est décrit par sa phrase.
    const phrase = proseOf(request);
    expect(text(phrase)).toBe("Je te propose d'ajouter l'étape « Portfolio ». On l'ajoute ?");
    expect(phrase.id).not.toBe('');
    expect(add.parentElement?.getAttribute('aria-describedby')).toBe(phrase.id);
    expect(later.parentElement).toBe(add.parentElement);

    add.click();
    expect(chat.respondToPermission).toHaveBeenCalledWith(true);
    later.click();
    expect(chat.respondToPermission).toHaveBeenCalledWith(false);
  });

  it('dit la demande aux lecteurs d’écran, une seule fois', async () => {
    const { fixture, chat } = await setup({ history: HISTORY });
    const announce = vi.spyOn(TestBed.inject(AnnoncesStore), 'annoncer');
    asking({ kind: 'stage', title: 'Portfolio', parentId: 'semi' })(chat);
    await refresh(fixture);
    expect(announce).toHaveBeenCalledWith("Je te propose d'ajouter l'étape « Portfolio ». On l'ajoute ?");

    // L'état du workflow est relu chaque seconde : la même demande n'est pas redite.
    chat.permissionRequest.set({ kind: 'stage', title: 'Portfolio', parentId: 'semi' });
    await refresh(fixture);
    expect(announce).toHaveBeenCalledTimes(1);

    // Une autre demande, après la réponse, est dite à son tour.
    chat.isAwaitingPermission.set(false);
    await refresh(fixture);
    asking({ kind: 'stage', title: 'Fractionné', parentId: 'semi' })(chat);
    await refresh(fixture);
    expect(announce).toHaveBeenLastCalledWith("Je te propose d'ajouter l'étape « Fractionné ». On l'ajoute ?");
    expect(announce).toHaveBeenCalledTimes(2);
  });

  it('au clavier, la zone de réponse garde le focus pendant qu’Akari travaille, et le retrouve après « Ajouter »', async () => {
    const { fixture, chat, root } = await setup({ history: HISTORY });
    const area = textarea(root);
    area.focus();
    area.value = 'Propose-moi une étape.';
    area.dispatchEvent(new Event('input'));
    area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    // Akari travaille : la zone de réponse reste ouverte et garde le focus ; seul l'envoi attend.
    chat.canSendMessage.set(false);
    chat.isStreaming.set(true);
    await refresh(fixture);
    expect(textarea(root).disabled).toBe(false);
    expect(document.activeElement).toBe(textarea(root));

    // Akari demande son accord : la personne va jusqu'à « Ajouter » et l'accepte ; le bouton disparaît.
    chat.isStreaming.set(false);
    chat.isAwaitingPermission.set(true);
    chat.permissionRequest.set({ kind: 'stage', title: 'Portfolio', parentId: 'semi' });
    await refresh(fixture);
    const add = buttonNamed(root, 'Ajouter') as HTMLButtonElement;
    add.focus();
    add.click();
    chat.isAwaitingPermission.set(false);
    chat.permissionRequest.set(null);
    chat.isStreaming.set(true);
    await refresh(fixture);
    expect(chat.respondToPermission).toHaveBeenCalledWith(true);
    expect(buttonNamed(root, 'Ajouter')).toBeUndefined();
    // Le focus ne repart pas du haut de la page : il revient à la zone de réponse.
    expect(document.activeElement).toBe(textarea(root));
  });

  it('ne prend pas le focus quand la personne est ailleurs', async () => {
    const { fixture, chat, root } = await setup({ history: HISTORY });
    const area = textarea(root);
    area.value = 'Une étape ?';
    area.dispatchEvent(new Event('input'));
    area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    const elsewhere = buttonNamed(root, "Voir l'objectif") as HTMLAnchorElement;
    elsewhere.focus();

    chat.canSendMessage.set(false);
    chat.isAwaitingPermission.set(true);
    chat.permissionRequest.set({ kind: 'stage', title: 'Portfolio', parentId: 'semi' });
    await refresh(fixture);
    expect(document.activeElement).toBe(elsewhere);
  });

  it('propose un pas en nommant son étape', async () => {
    const { root } = await setup({ history: HISTORY, configure: asking({ kind: 'task', title: 'Courir 10 km', objectiveId: 'endurance' }) });
    expect(text(root)).toContain("Je te propose d'ajouter le pas « Courir 10 km » à l'étape « Endurance ». On l'ajoute ?");
  });

  it('demande son accord pour une autre action, avec « Continuer »', async () => {
    const { root } = await setup({ history: HISTORY, configure: asking({ kind: 'other' }) });
    expect(text(root)).toContain("J'ai besoin de ton accord pour continuer. On y va ?");
    expect(buttonNamed(root, 'Continuer')).toBeDefined();
  });
});

describe('Akari : la ligne d’état et la zone de réponse', () => {
  it('dit ce que fait Akari, dans une région annoncée', async () => {
    const { fixture, chat, root } = await setup({ history: HISTORY });
    const status = statusLine(root) as HTMLElement;
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(text(status)).toBe('');

    chat.isStreaming.set(true);
    chat.canSendMessage.set(false);
    chat.processingStatus.set(AKARI_STATUS.ExecutingAllTool);
    await refresh(fixture);
    expect(text(statusLine(root))).toBe('Akari regarde ton objectif…');
  });

  it('a un libellé accessible et un bouton « Envoyer »', async () => {
    const { root } = await setup();
    const area = textarea(root);
    expect(text(root.querySelector(`label[for="${area.id}"]`))).toBe('Réponds à Akari');
    expect(sendButton(root).classList).toContain('btn--accent');
    expect(sendButton(root).classList).toContain('btn--round');
  });

  it('Entrée envoie et vide la zone ; Maj+Entrée va à la ligne', async () => {
    const { fixture, chat, root } = await setup({ history: HISTORY });
    const area = textarea(root);
    area.value = 'On garde janvier libre ?';
    area.dispatchEvent(new Event('input'));
    await refresh(fixture);
    expect(sendDisabled(root)).toBe(false);

    area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
    expect(chat.sendMessageToAi).not.toHaveBeenCalled();

    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    area.dispatchEvent(enter);
    await refresh(fixture);
    expect(enter.defaultPrevented).toBe(true);
    expect(chat.sendMessageToAi).toHaveBeenCalledWith({ message: 'On garde janvier libre ?', objectiveId: 'semi' });
    expect(textarea(root).value).toBe('');
  });

  it('le bouton « Envoyer » envoie aussi', async () => {
    const { fixture, chat, root } = await setup({ history: HISTORY });
    const area = textarea(root);
    area.value = '  Et en février ?  ';
    area.dispatchEvent(new Event('input'));
    await refresh(fixture);
    sendButton(root).click();
    await refresh(fixture);
    expect(chat.sendMessageToAi).toHaveBeenCalledWith({ message: 'Et en février ?', objectiveId: 'semi' });
  });

  it('n’envoie rien tant qu’Akari n’est pas prêt, mais laisse écrire', async () => {
    const { fixture, chat, root } = await setup({ history: HISTORY, configure: (c) => c.canSendMessage.set(false) });
    const area = textarea(root);
    expect(area.disabled).toBe(false);
    area.value = 'Et pour février ?';
    area.dispatchEvent(new Event('input'));
    await refresh(fixture);
    expect(sendDisabled(root)).toBe(true);

    area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await refresh(fixture);
    expect(chat.sendMessageToAi).not.toHaveBeenCalled();
    expect(textarea(root).value).toBe('Et pour février ?');

    // Akari est de nouveau prêt : le message écrit pendant ce temps part.
    chat.canSendMessage.set(true);
    await refresh(fixture);
    textarea(root).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await refresh(fixture);
    expect(chat.sendMessageToAi).toHaveBeenCalledWith({ message: 'Et pour février ?', objectiveId: 'semi' });
  });

  it('attend l’historique avant d’écouter : un message envoyé avant serait effacé', async () => {
    const { fixture, chat, root } = await setup({
      configure: (c) => {
        c.historyLoaded.set(false);
        c.isLoading.set(true);
      },
    });
    const area = textarea(root);
    area.value = 'Bonjour';
    area.dispatchEvent(new Event('input'));
    await refresh(fixture);
    expect(sendDisabled(root)).toBe(true);
    area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(chat.sendMessageToAi).not.toHaveBeenCalled();

    chat.historyLoaded.set(true);
    chat.isLoading.set(false);
    await refresh(fixture);
    expect(sendDisabled(root)).toBe(false);
  });

  it('n’envoie pas un message vide', async () => {
    const { chat, root } = await setup({ history: HISTORY });
    expect(sendDisabled(root)).toBe(true);
    textarea(root).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(chat.sendMessageToAi).not.toHaveBeenCalled();
  });
});

describe('Akari : les débuts de réponse', () => {
  it('propose de découper l’étape en cours, des pas, ou de dire ce qui bloque', async () => {
    const { root } = await setup({ history: HISTORY });
    expect(suggestionsOf(root).map(text)).toEqual(["Découpe l'étape « Endurance »", 'Propose des pas', "Qu'est-ce qui bloque ?"]);
  });

  it('avec ?etape, découpe cette étape-là', async () => {
    const { root } = await setup({ etape: 'vitesse', history: HISTORY });
    expect(text(suggestionsOf(root)[0])).toBe("Découpe l'étape « Vitesse »");
  });

  it('sans étape, propose des étapes', async () => {
    const { root } = await setup({ configure: (_, store) => store.objectives.set([OBJECTIVES[0]]) });
    expect(text(suggestionsOf(root)[0])).toBe('Propose des étapes');
  });

  it('envoie le début de réponse choisi, et l’invitation s’efface', async () => {
    const { fixture, chat, root } = await setup();
    suggestionsOf(root)[1].click();
    await refresh(fixture);
    expect(chat.sendMessageToAi).toHaveBeenCalledWith({ message: 'Propose des pas', objectiveId: 'semi' });
    expect(buttonNamed(root, 'Propose-moi des étapes')).toBeUndefined();
  });

  it('pendant qu’Akari travaille, le pose dans la zone de réponse sans l’envoyer', async () => {
    const { fixture, chat, root } = await setup({ history: HISTORY, configure: (c) => c.canSendMessage.set(false) });
    suggestionsOf(root)[2].click();
    await refresh(fixture);
    expect(chat.sendMessageToAi).not.toHaveBeenCalled();
    expect(textarea(root).value).toBe("Qu'est-ce qui bloque ?");
  });
});

describe('Akari : le chemin à droite', () => {
  it('montre le chemin, ses étapes avec leur état et leur nombre de pas, et mène à l’objectif', async () => {
    const { root } = await setup();
    const panel = trail(root);
    expect(panel.classList).toContain('card');
    expect(text(panel.querySelector('h2'))).toBe('Le chemin');
    expect(text(panel.querySelector('.trail-head .mono'))).toBe('1/4 pas');

    const path = panel.querySelector('ax-path') as HTMLElement;
    expect(path.classList).toContain('vertical');
    // Le chemin se lit, il ne se choisit pas : aucune étape n'est un bouton.
    expect(path.querySelector('button')).toBeNull();
    expect(stepsOf(root)).toEqual([
      ['Endurance', 'En cours · 2 pas'],
      ['Vitesse', 'À venir · 1 pas'],
    ]);
    expect(text(path.querySelector('.step--summit .name'))).toBe('Semi-marathon');
    expect(text(panel)).toContain('1 pas sans étape');

    const see = buttonNamed(panel, "Voir l'objectif") as HTMLAnchorElement;
    expect(see.getAttribute('href')).toBe('/objectifs/semi');
    expect(see.classList).toContain('btn--line');
  });

  it('invite Akari quand l’objectif n’a pas encore d’étape', async () => {
    const { root } = await setup({
      configure: (_, store) => {
        store.objectives.set([OBJECTIVES[0]]);
        store.tasks.set([]);
      },
    });
    expect(text(root)).toContain("Aucune étape pour l'instant. Akari peut t'en proposer.");
    expect(root.querySelector('ax-path')).not.toBeNull();
    expect(root.querySelector('.trail-head .mono')).toBeNull();
  });

  it('se remplit quand Akari ajoute une étape', async () => {
    const { fixture, objectives, root } = await setup();
    objectives.objectives.set([...OBJECTIVES, { id: 'portfolio', title: 'Récupération', why: '', description: '', dueDate: '', parentId: 'semi' }]);
    await refresh(fixture);
    expect(stepsOf(root).map(([name]) => name)).toEqual(['Endurance', 'Vitesse', 'Récupération']);
  });

  it('nomme une étape enregistrée sans nom, comme l’arête', async () => {
    const { root } = await setup({
      etape: 'vitesse',
      configure: (_, store) => store.objectives.set(OBJECTIVES.map((o) => (o.id === 'vitesse' ? { ...o, title: '' } : o))),
    });
    expect(stepsOf(root).map(([name]) => name)).toEqual(['Endurance', 'Étape sans nom']);
    expect(text(root)).toContain("Je peux te proposer des pas pour l'étape « Étape sans nom ».");
  });

  it('nomme aussi une étape au titre fait d’espaces', async () => {
    const { root } = await setup({
      configure: (_, store) => store.objectives.set(OBJECTIVES.map((o) => (o.id === 'vitesse' ? { ...o, title: '   ' } : o))),
    });
    expect(stepsOf(root).map(([name]) => name)).toEqual(['Endurance', 'Étape sans nom']);
  });

  it('défile au clavier dans sa carte : elle prend le focus et porte le nom du chemin', async () => {
    const { root } = await setup();
    const panel = trail(root);
    expect(panel.getAttribute('tabindex')).toBe('0');
    expect(text(root.querySelector(`#${panel.getAttribute('aria-labelledby')}`))).toBe('Le chemin');
  });
});

describe('Akari : sur une seule colonne (1100px et moins)', () => {
  let narrow = true;
  let place = { top: 320, bottom: 1100 };
  const scrolled: { element: Element; options: unknown }[] = [];

  beforeEach(() => {
    narrow = true;
    place = { top: 320, bottom: 1100 };
    scrolled.length = 0;
    // jsdom n'a ni mise en page ni défilement : la largeur de l'écran, la place de la conversation (sous l'en-tête,
    // son pied sous la fenêtre de 768px) et le défilement de la page sont simulés.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(max-width: 1100px)' && narrow,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.tagName === 'AX-CONVERSATION'
        ? new DOMRect(0, place.top, 600, place.bottom - place.top)
        : new DOMRect();
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: function (this: Element, options: unknown) {
        scrolled.push({ element: this, options });
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
  });

  it('descend jusqu’au pied de la conversation quand son historique est là, une seule fois', async () => {
    const { fixture, chat, root } = await setup({ history: HISTORY, configure: (c) => c.historyLoaded.set(false) });
    expect(scrolled).toEqual([]);

    chat.historyLoaded.set(true);
    await refresh(fixture);
    expect(scrolled).toEqual([{ element: root.querySelector('ax-conversation'), options: { block: 'end', behavior: 'instant' } }]);

    // Les relectures suivantes de l'historique ne déplacent plus la page.
    chat.historyLoaded.set(false);
    await refresh(fixture);
    chat.historyLoaded.set(true);
    await refresh(fixture);
    expect(scrolled).toHaveLength(1);
  });

  it('ne bouge pas quand la conversation et le chemin sont côte à côte', async () => {
    narrow = false;
    await setup({ history: HISTORY });
    expect(scrolled).toEqual([]);
  });

  it('ne bouge pas quand la personne est déjà à la conversation, ou plus bas', async () => {
    place = { top: -200, bottom: 560 };
    await setup({ history: HISTORY });
    expect(scrolled).toEqual([]);

    TestBed.resetTestingModule();
    place = { top: 40, bottom: 760 };
    await setup({ history: HISTORY });
    expect(scrolled).toEqual([]);
  });
});

describe('Akari : la voix', () => {
  const texts = [
    objectiveInvitation('Semi-marathon').phrase,
    objectiveInvitation('Semi-marathon').action,
    objectiveInvitation('Semi-marathon').message,
    stageInvitation('Endurance').phrase,
    stageInvitation('Endurance').action,
    stageInvitation('Endurance').message,
    permissionPrompt({ kind: 'stage', title: 'Portfolio', parentId: null }),
    permissionPrompt({ kind: 'stage', title: '', parentId: null }),
    permissionPrompt({ kind: 'task', title: 'Courir 10 km', objectiveId: 'endurance' }, () => 'Endurance'),
    permissionPrompt({ kind: 'task', title: '', objectiveId: null }),
    permissionPrompt({ kind: 'other' }),
    ...Object.values(STAGE_STATE_TITLES),
    UNTITLED_STAGE,
    ...Object.values(AKARI_STATUS),
    ...Object.values(AKARI_REPORTS),
    AKARI_REPLIED,
  ];

  it.each(texts)('« %s » parle comme Apex', (phrase) => {
    expect(motsAEviter(phrase)).toEqual([]);
    expect(voiceIssues(phrase)).toEqual([]);
  });

  it('tout ce que l’écran affiche parle comme Apex, dans chaque état', async () => {
    const states: Setup[] = [
      {},
      { etape: 'endurance', history: HISTORY },
      { history: HISTORY, configure: (c) => { c.isAwaitingPermission.set(true); c.permissionRequest.set({ kind: 'task', title: 'Courir 10 km', objectiveId: 'endurance' }); } },
      { history: HISTORY, configure: (c) => { c.isStreaming.set(true); c.canSendMessage.set(false); } },
      { configure: (c) => { c.isLoading.set(true); c.historyLoaded.set(false); } },
      { configure: (_, store) => { store.objectives.set([]); store.objectivesLoaded.set(false); } },
      { configure: (_, store) => { store.objectives.set([]); store.objectivesLoaded.set(false); store.error.set('chargement non abouti'); } },
      { id: 'inconnu' },
      { history: HISTORY, configure: (c) => { c.isAwaitingPermission.set(true); c.permissionRequest.set({ kind: 'other' }); } },
    ];
    for (const state of states) {
      const { root } = await setup(state);
      for (const shown of screenTexts(root)) {
        expect(motsAEviter(shown), shown).toEqual([]);
        expect(voiceIssues(shown), shown).toEqual([]);
      }
      TestBed.resetTestingModule();
    }
  });
});
