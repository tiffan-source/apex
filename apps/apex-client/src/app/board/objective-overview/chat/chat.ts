import { Component, computed, effect, inject, input } from '@angular/core';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { FormsModule } from '@angular/forms';
import { ChatStore } from './chat.store';
import { DatePipe } from '@angular/common';
import { SessionStore } from 'apps/apex-client/src/chore/stores/session.store';
import { DrawerModule } from 'primeng/drawer';
import { ChatDrawerStore } from 'apps/apex-client/src/chore/stores/chat-drawer.store';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-chat',
  imports: [InputTextModule, ButtonModule, FormsModule, DrawerModule, CardModule, MarkdownPipe],
  templateUrl: './chat.html',
  styleUrl: './chat.css',
  providers: [ChatStore],
})
export class Chat {
  promptMessage: string = '';
  chatStore = inject(ChatStore);
  sessionStore = inject(SessionStore);
  objectiveId = input.required<string>();
  chatDrawerStore = inject(ChatDrawerStore);
  objectifTitle = input.required<string>();

  constructor(){
    effect(()=>{
      this.chatStore.loadChatHistory({objectifId: this.objectiveId()});
    })
  }

  sendMessage() {
    if(this.promptMessage){
      this.chatStore.sendMessageToAi({
        message: this.promptMessage,
        objectiveId: this.objectiveId()
      })

      this.promptMessage = '';
    }
  }
}import { MarkdownPipe } from './markdown.pipe';
import { ObjectiveStore } from 'apps/apex-client/src/chore/stores/objective.store';

