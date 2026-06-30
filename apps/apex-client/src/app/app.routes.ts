import { Routes } from "@angular/router";

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./board/board').then(m => m.Board)
  },
  {
    path: 'objectives/:id',
    loadComponent: () => import('./board/objective-overview/objective-overview').then(m => m.ObjectiveOverview)
  },
  {
    path: 'matrix',
    loadComponent: () => import('./matrix/matrix').then(m => m.Matrix)
  },
  {
    path: 'daily-focus',
    loadComponent: () => import('./daily-focus/daily-focus').then(m => m.DailyFocus)
  }
];
