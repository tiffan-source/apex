import { Component, inject } from '@angular/core';
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
  drawerStore = inject(DrawerStore);

  navigationList = [
    {
      label: 'Accueil',
      link: '/',
      primeIcon: 'pi pi-fw pi-home'
    },
    {
      label: 'Matrice',
      link: '/matrix',
      primeIcon: 'pi pi-fw pi-th-large'
    },
    {
      label: 'Focus',
      link: '/focus',
      primeIcon: 'pi pi-fw pi-check-square'
    }
  ]
}
