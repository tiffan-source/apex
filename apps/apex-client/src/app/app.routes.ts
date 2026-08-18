import { Routes } from "@angular/router";
import { authGuard } from "./auth.guard";

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./shell/shell').then(m => m.Shell),
    children: [
      {
        path: '',
        loadComponent: () => import('./board/board').then(m => m.Board)
      },
      {
        path: 'objective/:id',
        loadComponent: () => import('./board/objective-overview/objective-overview').then(m => m.ObjectiveOverview)
      },
      {
        path: 'matrix',
        loadComponent: () => import('./matrix/matrix').then(m => m.Matrix)
      },
      {
        path: 'focus',
        loadComponent: () => import('./focus/focus').then(m => m.Focus)
      }
    ],
    canActivate: [authGuard]
  },
  {
    path: 'auth',
    loadComponent: () => import('./auth/auuthentication-page').then(m => m.AuuthenticationPage)
  }
];
