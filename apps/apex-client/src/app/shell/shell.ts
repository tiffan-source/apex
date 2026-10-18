import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ToolbarModule } from 'primeng/toolbar';
import { DividerModule } from 'primeng/divider';
import { ObjectiveStore } from '../../chore/stores/objective.store';
import { DrawerStore } from '../../chore/stores/drawer.store';
import { FocusTaskStore } from '../../chore/stores/focus-task.store';

@Component({
  selector: 'app-shell',
  imports: [RouterModule, ButtonModule, ToolbarModule, DividerModule],
  templateUrl: './shell.html',
  providers: [ObjectiveStore, DrawerStore, FocusTaskStore]
})
export class Shell {
  drawerStore = inject(DrawerStore);

  navigationList = [
    {
      label: 'Accueil',
      link: '/',
      primeIcon: 'pi pi-home'
    },
    {
      label: 'Matrice',
      link: '/matrix',
      primeIcon: 'pi pi-th-large'
    },
    {
      label: 'Focus',
      link: '/focus',
      primeIcon: 'pi pi-check-square'
    }
  ]
}
