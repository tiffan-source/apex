import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-shell',
  imports: [],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  router = inject(Router);
  
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
      label: 'Daily Focus',
      link: '/daily-focus',
      primeIcon: 'pi pi-fw pi-calendar'
    }
  ]

  navigateTo(route: string) {
    this.router.navigate([route]);
  }
}
