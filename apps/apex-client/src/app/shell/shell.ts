import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { ObjectiveStore } from '../../chore/stores/objective.store';
import { ChatDrawerStore } from '../../chore/stores/chat-drawer.store';

@Component({
  selector: 'app-shell',
  imports: [ RouterModule],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
  providers: [ObjectiveStore, ChatDrawerStore]
})
export class Shell {
  router = inject(Router);
  chatDrawerStore = inject(ChatDrawerStore);
  
  navigationList = [
    {
      label: 'Board',
      link: '/',
      primeIcon: 'pi pi-fw pi-home'
    },
    {
      label: 'Matrix',
      link: '/matrix',
      primeIcon: 'pi pi-fw pi-th-large'
    }
  ]

  navigateTo(route: string) {
    this.router.navigate([route]);
  }
}
