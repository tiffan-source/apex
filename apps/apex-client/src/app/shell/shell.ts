import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { ObjectiveStore } from '../../chore/stores/objective.store';
import { DrawerStore } from '../../chore/stores/drawer.store';
import { FocusTaskStore } from '../../chore/stores/focus-task.store';

@Component({
  selector: 'app-shell',
  imports: [ RouterModule],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
  providers: [ObjectiveStore, DrawerStore, FocusTaskStore]
})
export class Shell {
  router = inject(Router);
  drawerStore = inject(DrawerStore);

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
    },
    {
      label: 'Focus',
      link: '/focus',
      primeIcon: 'pi pi-fw pi-check-square'
    }
  ]

  navigateTo(route: string) {
    this.router.navigate([route]);
  }
}
