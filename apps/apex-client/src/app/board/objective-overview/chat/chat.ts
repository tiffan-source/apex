import { Component, effect, ElementRef, inject, input, OnDestroy, viewChild } from '@angular/core';
import { ChatStore } from './chat.store';
import { InputTextModule } from 'primeng/inputtext';
import { SessionStore } from 'apps/apex-client/src/chore/stores/session.store';
import { DrawerStore } from 'apps/apex-client/src/chore/stores/drawer.store';
import { ButtonModule } from 'primeng/button';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { MarkdownPipe } from './markdown.pipe';
import { DrawerModule } from 'primeng/drawer';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-chat',
  imports: [InputTextModule, ButtonModule, FormsModule, DrawerModule, CardModule, MarkdownPipe, SkeletonModule],
  templateUrl: './chat.html',
  styleUrl: './chat.css',
  providers: [ChatStore],
})
export class Chat implements OnDestroy {
  promptMessage: string = '';
  chatStore = inject(ChatStore);
  sessionStore = inject(SessionStore);
  objectiveId = input.required<string>();
  drawerStore = inject(DrawerStore);
  objectifTitle = input.required<string>();

  chatContainer = viewChild<ElementRef<HTMLDivElement>>('chatContainer');

  private isNearBottom = true;
  private mutationObserver!: MutationObserver;

  constructor() {
    effect(() => {
      this.chatStore.loadChatHistory({objectifId: this.objectiveId()});
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
    if (this.promptMessage) {
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
