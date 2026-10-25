import { inject } from '@angular/core';
import { RedirectFunction, Router, Routes } from '@angular/router';
import { authGuard } from './auth.guard';

/**
 * L'ancienne adresse d'un objectif (/objective/:id) mène à son arête (/objectifs/:id),
 * avec les paramètres de requête et le fragment.
 */
export const toObjectivePage: RedirectFunction = ({ params, queryParams, fragment }) =>
  inject(Router).createUrlTree(['/objectifs', params['id']], { queryParams, fragment: fragment ?? undefined });

/*
 * Les routes de la V1 (cahier de migration, § 3) : quatre écrans dans la coque, et la connexion.
 * L'ordre compte : « objectifs/nouveau » passe avant « objectifs/:id ».
 */
export const routes: Routes = [
  // Les anciennes adresses. L'écran Focus sort de la V1 : le quadrant « Maintenant » de la matrice joue son rôle.
  { path: 'objective/:id', pathMatch: 'full', redirectTo: toObjectivePage },
  { path: 'matrix', pathMatch: 'full', redirectTo: '/matrice' },
  { path: 'focus', pathMatch: 'full', redirectTo: '/matrice' },
  {
    path: '',
    loadComponent: () => import('./shell/shell').then((m) => m.Shell),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Objectifs · Apex',
        loadComponent: () => import('./objectives/objectives').then((m) => m.Objectives),
      },
      {
        path: 'objectifs/nouveau',
        title: 'Nouvel objectif · Apex',
        loadComponent: () => import('./objectives/new-objective/new-objective').then((m) => m.NewObjective),
      },
      {
        path: 'objectifs/:id',
        title: "L'arête · Apex",
        loadComponent: () => import('./objective/objective-page').then((m) => m.ObjectivePage),
      },
      {
        path: 'objectifs/:id/akari',
        title: 'Akari · Apex',
        // L'écran tient dans la fenêtre au-dessus de 1100px : la coque lui donne la hauteur qui reste (shell.css).
        data: { fitsWindow: true },
        loadComponent: () => import('./objective/akari/akari').then((m) => m.Akari),
      },
      {
        path: 'matrice',
        title: 'La matrice · Apex',
        loadComponent: () => import('./matrix/matrix').then((m) => m.Matrix),
      },
    ],
  },
  {
    path: 'auth',
    title: 'Connexion · Apex',
    loadComponent: () => import('./auth/auuthentication-page').then((m) => m.AuuthenticationPage),
  },
  { path: '**', redirectTo: '' },
];
