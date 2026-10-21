import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { motsAEviter } from '@empreinte-studio/angular/core';
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
 * invitations, demandes d'accord, ligne d'état, zone de réponse), l'arête à droite, et la voix.
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
const textarea = (root: HTMLElement) => root.querySelector('textarea') as HTMLTextAreaElement;
const sendButton = (root: HTMLElement) => root.querySelector('button[aria-label="Envoyer"]') as HTMLButtonElement;

/** Tout ce que l'écran dit : son texte, et ses noms accessibles. */
function screenTexts(root: HTMLElement): string[] {
  const attributes = Array.from(root.querySelectorAll('[aria-label], [placeholder]')).flatMap((element) =>
    [element.getAttribute('aria-label'), element.getAttribute('placeholder')].filter((value): value is string => !!value),
  );
  return [text(root), ...attributes];
}

beforeEach(() => {
  // jsdom ne fait pas défiler la page.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  TestBed.resetTestingModule();
});

describe('Akari : l’en-tête', () => {
  it('nomme Akari, titre l’objectif et dit qui décide', async () => {
    const { root } = await setup();
    const header = root.querySelector('header');
    expect(text(header?.querySelector('p.repere'))).toBe('Akari');
    expect(header?.querySelector('p.repere e-icone')).not.toBeNull();
    expect(text(root.querySelector('h1'))).toBe('Semi-marathon');
    expect(root.querySelector('h1')?.classList).toContain('objectif');
    expect(text(header)).toContain("Akari propose, tu décides : rien n'est ajouté sans ton accord.");
  });

  it('pose un fil d’Ariane : Objectifs / l’objectif / Akari', async () => {
    const { root } = await setup();
    const crumbs = Array.from(root.querySelectorAll('nav[eFilAriane] li'));
    expect(crumbs.map(text)).toEqual(['Objectifs', 'Semi-marathon', 'Akari']);
    expect(crumbs[0].querySelector('a')?.getAttribute('href')).toBe('/');
    expect(crumbs[1].querySelector('a')?.getAttribute('href')).toBe('/objectifs/semi');
    expect(crumbs[2].getAttribute('aria-current')).toBe('page');
  });

  it('coupe un long titre dans le fil d’Ariane, comme l’arête, et le garde entier dans le titre', async () => {
    const title = 'Préparer et courir un semi-marathon avant la fin du mois de mai';
    const { root } = await setup({
      configure: (_, store) => store.objectives.update((list) => list.map((o) => (o.id === 'semi' ? { ...o, title } : o))),
    });
    expect(text(root.querySelectorAll('nav[eFilAriane] li')[1])).toBe('Préparer et courir un…');
    expect(text(root.querySelector('h1'))).toBe(title);
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
    expect(text(root.querySelector('h1'))).toBe('Semi-marathon');
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
    expect(root.querySelector('e-arete')).toBeNull();
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
    expect(root.querySelector('p.corps')).toBeNull();
    expect(buttonNamed(root, 'Voir mes objectifs')?.getAttribute('href')).toBe('/');
    expect(chat.loadChatHistory).not.toHaveBeenCalled();

    annonces.compris(); // la note est lue : l'écran dit quoi faire
    await refresh(fixture);
    expect(text(root.querySelector('p.corps'))).toBe('Vérifie ta connexion, puis recharge la page.');
  });
});

describe('Akari : les répliques', () => {
  it('Akari parle dans une note signée, la personne signe de son prénom', async () => {
    const { root } = await setup({ history: HISTORY });
    const replies = Array.from(root.querySelectorAll('ol.ds-conversation > li'));
    expect(replies).toHaveLength(2);

    const [mine, akari] = replies;
    expect(mine.classList).toContain('ds-reply');
    expect(text(mine.querySelector('.ds-reply-author'))).toBe('Léa');
    expect(mine.querySelector('.corps.ds-prose strong')?.textContent).toBe('semi');

    expect(akari.classList).not.toContain('ds-reply');
    const note = akari.querySelector('aside[eNote]');
    expect(note).not.toBeNull();
    expect(text(note?.querySelector('.e-note__qui'))).toBe('Akari');
    expect(note?.querySelector('.ds-prose strong')?.textContent).toBe('l’endurance');
  });

  it('signe « Toi » quand la personne n’a pas de prénom', async () => {
    const { root } = await setup({ history: HISTORY, userName: '' });
    expect(text(root.querySelector('.ds-reply-author'))).toBe('Toi');
  });

  it('assainit le Markdown d’une réplique', async () => {
    const { root } = await setup({
      history: [{ id: 'x', sender: 'assistant', content: 'Voici <img src="x" onerror="alert(1)"> <script>alert(2)</script>[lien](javascript:alert(3))', timestamp: new Date() }],
    });
    const prose = root.querySelector('aside[eNote] .ds-prose') as HTMLElement;
    expect(prose.innerHTML).not.toMatch(/onerror|<script|javascript:/);
  });

  it('fait venir la dernière réplique à l’écran', async () => {
    const { root } = await setup({ history: HISTORY });
    const last = root.querySelector('ol.ds-conversation > li:last-child') as HTMLElement;
    // À l'ouverture, d'un coup : pas de défilement animé à travers toute la conversation.
    expect(last.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' });
  });

  it('ne déplace pas la page quand la personne relit plus haut', async () => {
    const { fixture, chat, root } = await setup({ history: HISTORY });
    const previous = root.querySelector('ol.ds-conversation > li:last-child') as HTMLElement;
    // La dernière réplique est hors de l'écran : la personne lit plus haut.
    previous.getBoundingClientRect = () => ({ top: 2000, bottom: 2100 }) as DOMRect;
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;

    chat.messages.update((messages) => [...messages, { id: 'm3', sender: 'assistant', content: 'Et ensuite ?', timestamp: new Date(2026, 9, 20, 11) }]);
    await refresh(fixture);
    expect(scroll).not.toHaveBeenCalled();
  });

  it('suit la conversation quand la personne en voit la fin', async () => {
    const { fixture, chat, root } = await setup({ history: HISTORY });
    const previous = root.querySelector('ol.ds-conversation > li:last-child') as HTMLElement;
    previous.getBoundingClientRect = () => ({ top: 100, bottom: 200 }) as DOMRect;
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;

    chat.messages.update((messages) => [...messages, { id: 'm3', sender: 'assistant', content: 'Et ensuite ?', timestamp: new Date(2026, 9, 20, 11) }]);
    await refresh(fixture);
    expect(scroll).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
  });
});

describe('Akari : les invitations', () => {
  it('ouvre une conversation vide en proposant des étapes', async () => {
    const { chat, fixture, root } = await setup();
    const note = root.querySelector('ol.ds-conversation aside[eNote]');
    expect(text(note)).toContain('Je peux te proposer des étapes pour « Semi-marathon ». On commence ?');

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
    const notes = Array.from(root.querySelectorAll('ol.ds-conversation aside[eNote]'));
    expect(text(notes.at(-1))).toContain("Je peux te proposer des pas pour l'étape « Endurance ».");

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
    const note = Array.from(root.querySelectorAll('ol.ds-conversation aside[eNote]')).at(-1);
    expect(text(note)).toContain("Je te propose d'ajouter l'étape « Portfolio ». On l'ajoute ?");
    expect(text(statusLine(root))).toBe('Akari attend ton accord.');

    const add = buttonNamed(root, 'Ajouter') as HTMLButtonElement;
    const later = buttonNamed(root, 'Pas maintenant') as HTMLButtonElement;
    expect(add.classList).toContain('e-btn--trait');
    expect(add.classList).toContain('e-btn--petit');
    expect(later.classList).toContain('e-btn--nu');

    // Les deux boutons font lire la demande quand ils prennent le focus.
    const phrase = root.querySelector('#akari-demande');
    expect(text(phrase)).toBe("Je te propose d'ajouter l'étape « Portfolio ». On l'ajoute ?");
    expect(add.getAttribute('aria-describedby')).toBe('akari-demande');
    expect(later.getAttribute('aria-describedby')).toBe('akari-demande');

    add.click();
    expect(chat.respondToPermission).toHaveBeenCalledWith(true);
    later.click();
    expect(chat.respondToPermission).toHaveBeenCalledWith(false);
  });

  it('au clavier, le focus va à la demande, puis revient à la zone de réponse', async () => {
    const { fixture, chat, root } = await setup({ history: HISTORY });
    const area = textarea(root);
    area.focus();
    area.value = 'Propose-moi une étape.';
    area.dispatchEvent(new Event('input'));
    area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    // Akari travaille : la zone de réponse se désactive et perd le focus (le navigateur la quitte ;
    // jsdom ne le fait pas seul, et ne sait plus quitter un champ désactivé).
    area.blur();
    chat.canSendMessage.set(false);
    chat.isStreaming.set(true);
    await refresh(fixture);
    expect(textarea(root).disabled).toBe(true);
    expect(document.activeElement).toBe(document.body);

    // Akari demande son accord : le focus va à « Ajouter ».
    chat.isStreaming.set(false);
    chat.isAwaitingPermission.set(true);
    chat.permissionRequest.set({ kind: 'stage', title: 'Portfolio', parentId: 'semi' });
    await refresh(fixture);
    expect(document.activeElement).toBe(buttonNamed(root, 'Ajouter'));

    // La personne accepte : le bouton disparaît, puis Akari est de nouveau prêt.
    (buttonNamed(root, 'Ajouter') as HTMLButtonElement).click();
    chat.isAwaitingPermission.set(false);
    chat.permissionRequest.set(null);
    chat.isStreaming.set(true);
    await refresh(fixture);
    expect(document.activeElement).toBe(document.body);

    chat.isStreaming.set(false);
    chat.canSendMessage.set(true);
    await refresh(fixture);
    expect(document.activeElement).toBe(textarea(root));
  });

  it('ne prend pas le focus quand la personne est ailleurs', async () => {
    const { fixture, chat, root } = await setup({ history: HISTORY });
    const area = textarea(root);
    area.value = 'Une étape ?';
    area.dispatchEvent(new Event('input'));
    area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    const elsewhere = buttonNamed(root, "Voir l'arête") as HTMLAnchorElement;
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
    expect(sendButton(root).classList).toContain('e-btn--trait');
    expect(sendButton(root).classList).toContain('e-btn--icone');
  });

  it('Entrée envoie et vide la zone ; Maj+Entrée va à la ligne', async () => {
    const { fixture, chat, root } = await setup({ history: HISTORY });
    const area = textarea(root);
    area.value = 'On garde janvier libre ?';
    area.dispatchEvent(new Event('input'));
    await refresh(fixture);
    expect(sendButton(root).disabled).toBe(false);

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

  it('n’envoie rien tant qu’Akari n’est pas prêt', async () => {
    const { fixture, chat, root } = await setup({ history: HISTORY, configure: (c) => c.canSendMessage.set(false) });
    expect(textarea(root).disabled).toBe(true);
    expect(sendButton(root).disabled).toBe(true);

    textarea(root).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await refresh(fixture);
    expect(chat.sendMessageToAi).not.toHaveBeenCalled();
  });

  it('attend l’historique avant d’écouter : un message envoyé avant serait effacé', async () => {
    const { fixture, chat, root } = await setup({
      configure: (c) => {
        c.historyLoaded.set(false);
        c.isLoading.set(true);
      },
    });
    expect(textarea(root).disabled).toBe(true);
    expect(sendButton(root).disabled).toBe(true);

    chat.historyLoaded.set(true);
    chat.isLoading.set(false);
    await refresh(fixture);
    expect(textarea(root).disabled).toBe(false);
  });

  it('n’envoie pas un message vide', async () => {
    const { chat, root } = await setup({ history: HISTORY });
    expect(sendButton(root).disabled).toBe(true);
    textarea(root).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(chat.sendMessageToAi).not.toHaveBeenCalled();
  });
});

describe('Akari : l’arête à droite', () => {
  it('montre l’arête, ses étapes avec leur nombre de pas, et mène à l’arête', async () => {
    const { root } = await setup();
    const panel = root.querySelector('section[aria-labelledby="akari-titre-arete"]') as HTMLElement;
    expect(text(panel.querySelector('h2'))).toBe("L'arête");
    expect(text(panel)).toContain('2 étapes · 4 pas');
    expect(panel.querySelector('.ds-scroll-x > e-arete')).not.toBeNull();
    expect(panel.querySelector('e-arete')?.hasAttribute('interactive')).toBe(false);

    const rows = Array.from(panel.querySelectorAll('ol.ds-divided > li.ds-entry'));
    expect(rows.map((row) => Array.from(row.children).map(text))).toEqual([
      ['1', 'Endurance', '2 pas', 'En cours'],
      ['2', 'Vitesse', '1 pas', 'À venir'],
    ]);
    expect(text(panel)).toContain('1 pas sans étape');

    const see = buttonNamed(panel, "Voir l'arête") as HTMLAnchorElement;
    expect(see.getAttribute('href')).toBe('/objectifs/semi');
    expect(see.classList).toContain('e-btn--trait');
  });

  it('invite Akari quand l’objectif n’a pas encore d’étape', async () => {
    const { root } = await setup({
      configure: (_, store) => {
        store.objectives.set([OBJECTIVES[0]]);
        store.tasks.set([]);
      },
    });
    expect(text(root)).toContain("Aucune étape pour l'instant. Akari peut t'en proposer.");
    expect(root.querySelector('e-arete')).not.toBeNull();
  });

  it('se remplit quand Akari ajoute une étape', async () => {
    const { fixture, objectives, root } = await setup();
    objectives.objectives.set([...OBJECTIVES, { id: 'portfolio', title: 'Récupération', why: '', description: '', dueDate: '', parentId: 'semi' }]);
    await refresh(fixture);
    expect(Array.from(root.querySelectorAll('li.ds-entry')).map((row) => text(row.children[1]))).toEqual(['Endurance', 'Vitesse', 'Récupération']);
  });

  it('nomme une étape enregistrée sans nom, comme l’arête', async () => {
    const { root } = await setup({
      etape: 'vitesse',
      configure: (_, store) => store.objectives.set(OBJECTIVES.map((o) => (o.id === 'vitesse' ? { ...o, title: '' } : o))),
    });
    expect(Array.from(root.querySelectorAll('li.ds-entry')).map((row) => text(row.children[1]))).toEqual(['Endurance', 'Étape sans nom']);
    // Sur l'arête aussi, et un titre fait d'espaces compte comme vide.
    expect(Array.from(root.querySelectorAll('e-arete .etape .nom')).map(text)).toEqual(['Endurance', 'Étape sans nom']);
    expect(text(root)).toContain("Je peux te proposer des pas pour l'étape « Étape sans nom ».");
  });

  it('nomme aussi une étape au titre fait d’espaces, dans la liste et sur l’arête', async () => {
    const { root } = await setup({
      configure: (_, store) => store.objectives.set(OBJECTIVES.map((o) => (o.id === 'vitesse' ? { ...o, title: '   ' } : o))),
    });
    expect(Array.from(root.querySelectorAll('li.ds-entry')).map((row) => text(row.children[1]))).toEqual(['Endurance', 'Étape sans nom']);
    expect(Array.from(root.querySelectorAll('e-arete .etape .nom')).map(text)).toEqual(['Endurance', 'Étape sans nom']);
  });

  it('mène la vue de l’arête à sa fin (sa tête, la dernière étape), dans une zone qui défile au clavier', async () => {
    // jsdom ne mesure rien : une arête plus large que sa colonne.
    vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockReturnValue(900);
    try {
      const { fixture, objectives, root } = await setup();
      const scroller = root.querySelector('.ds-scroll-x') as HTMLElement;
      expect(scroller.scrollLeft).toBe(900);
      expect(scroller.getAttribute('tabindex')).toBe('0');
      expect(scroller.getAttribute('role')).toBe('region');
      expect(scroller.getAttribute('aria-label')).toBe("L'arête de l'objectif");
      // Comme l'aperçu de la maquette, masquée sur mobile ; la liste des étapes suit.
      expect(scroller.classList).toContain('ds-hide-mobile');

      // La personne fait défiler ; un pas qui change ne la ramène pas à la fin.
      scroller.scrollLeft = 0;
      objectives.tasks.update((list) => list.map((t) => (t.id === 't1' ? { ...t, done: true } : t)));
      await refresh(fixture);
      expect(scroller.scrollLeft).toBe(0);

      // Akari ajoute une étape : la vue va à la fin, où elle arrive.
      objectives.objectives.update((list) => [...list, { id: 'recup', title: 'Récupération', why: '', description: '', dueDate: '', parentId: 'semi' }]);
      await refresh(fixture);
      expect(scroller.scrollLeft).toBe(900);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('garde un seul sceau : la tête de l’arête', async () => {
    const { root } = await setup({ history: HISTORY, configure: (c) => {
      c.isAwaitingPermission.set(true);
      c.permissionRequest.set({ kind: 'stage', title: 'Portfolio', parentId: 'semi' });
    } });
    expect(root.querySelectorAll('e-arete')).toHaveLength(1);
    expect(root.querySelectorAll('.e-btn--sceau, e-sceau')).toHaveLength(0);
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

  it.each(texts)('« %s » parle comme Empreinte', (phrase) => {
    expect(motsAEviter(phrase)).toEqual([]);
    expect(voiceIssues(phrase)).toEqual([]);
  });

  it('tout ce que l’écran affiche parle comme Empreinte, dans chaque état', async () => {
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
