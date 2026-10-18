import { Component, computed, effect, ElementRef, inject, input, OnDestroy, viewChild } from '@angular/core';
import { ChatStore } from './chat.store';
import { InputTextModule } from 'primeng/inputtext';
import { SessionStore } from 'apps/apex-client/src/chore/stores/session.store';
import { DrawerStore } from 'apps/apex-client/src/chore/stores/drawer.store';
import { ButtonModule } from 'primeng/button';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { MarkdownPipe } from './markdown.pipe';
import { DrawerModule } from 'primeng/drawer';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-chat',
  imports: [InputTextModule, ButtonModule, FormsModule, DrawerModule, CardModule, MarkdownPipe, MessageModule],
  templateUrl: './chat.html',
  providers: [ChatStore],
})
export class Chat implements OnDestroy {
  promptMessage: string = '';

  // Bulle de l'utilisateur : carte sur fond légèrement teinté
  readonly userBubbleTokens = { root: { background: 'var(--ds-chat-bubble-background)', shadow: 'none' } };
  chatStore = inject(ChatStore);
  sessionStore = inject(SessionStore);
  objectiveId = input.required<string>();
  drawerStore = inject(DrawerStore);
  objectifTitle = input.required<string>();

  chatContainer = viewChild<ElementRef<HTMLDivElement>>('chatContainer');

  // Phrase de confirmation présentée à l'utilisateur quand l'IA veut exécuter
  // un outil d'écriture, construite à partir de l'outil en attente.
  permissionPrompt = computed(() => {
    const call = this.chatStore.pendingToolCall();
    if (!call) {
      return '';
    }

    const args = (call.arguments ?? {}) as Record<string, unknown>;
    const title = String(args['title'] ?? '');

    switch (call.name) {
      case 'createSubObjective':
        return `L'assistant souhaite créer le sous-objectif « ${title} ». Autoriser ?`;
      case 'createTask':
        return `L'assistant souhaite créer la tâche « ${title} ». Autoriser ?`;
      default:
        return `L'assistant souhaite exécuter « ${call.name} ». Autoriser ?`;
    }
  });

  private isNearBottom = true;
  private mutationObserver!: MutationObserver;

  constructor() {
    effect(() => {
      const objectiveId = this.objectiveId();
      this.chatStore.loadChatHistory({objectifId: objectiveId});
      // Wake up (or start) the workflow as soon as the chat opens so a previously
      // interrupted process resumes, instead of waiting for a new message.
      this.chatStore.initWorkflow(objectiveId);
    });

    effect((onCleanup) => {
      const chatEl = this.chatContainer()?.nativeElement;

      if (chatEl) {
        // 1. On remonte dans l'arbre DOM pour trouver le vrai conteneur de scroll de PrimeNG
        const scrollParent = chatEl.closest('.p-drawer-content') as HTMLDivElement;

        if (!scrollParent) return;

        // 2. On attache l'événement de scroll dynamiquement sur CE parent
        const onScroll = () => {
          const threshold = 50;
          const position = scrollParent.scrollTop + scrollParent.clientHeight;
          const height = scrollParent.scrollHeight;
          this.isNearBottom = height - position <= threshold;
        };
        scrollParent.addEventListener('scroll', onScroll);

        // 3. On observe les nouveaux messages sur notre conteneur
        this.mutationObserver = new MutationObserver(() => {
          if (this.isNearBottom) {
            setTimeout(() => {
              scrollParent.scrollTop = scrollParent.scrollHeight;
            }, 0);
          }
        });
        this.mutationObserver.observe(chatEl, { childList: true });

        // 4. Scroll initial à l'ouverture du drawer
        setTimeout(() => {
          this.isNearBottom = true;
          scrollParent.scrollTop = scrollParent.scrollHeight;
        }, 50);

        // 5. Nettoyage
        onCleanup(() => {
          scrollParent.removeEventListener('scroll', onScroll);
          if (this.mutationObserver) {
            this.mutationObserver.disconnect();
          }
        });
      }
    });
  }

  sendMessage() {
    // Only let the user talk to the AI while the workflow is idle and waiting
    // for a new message; any other state means a turn is still running.
    if (this.promptMessage && this.chatStore.canSendMessage()) {
      this.chatStore.sendMessageToAi({
        message: this.promptMessage,
        objectiveId: this.objectiveId()
      });
      this.promptMessage = '';
    }
  }

  ngOnDestroy() {
    // La majorité du nettoyage est gérée par onCleanup dans l'effect,
    // on garde ceci par sécurité.
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
  }
}
