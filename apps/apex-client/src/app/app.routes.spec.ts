import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router, RouterOutlet, type Route, type Routes } from '@angular/router';
import { motsAEviter } from '@empreinte-studio/angular/core';
import { voiceIssues } from '../chore/constants/messages.constante';
import { routes } from './app.routes';
import { authGuard } from './auth.guard';

/** La coque simulée : une sortie pour les écrans. */
@Component({ template: '<router-outlet />', imports: [RouterOutlet] })
class ShellStub {}

/** Un écran simulé. Les vrais écrans sont chargés à la demande et ne sont pas testés ici. */
@Component({ template: '' })
class PageStub {}

/** Les mêmes routes, avec des composants simulés et un garde qui laisse passer. */
function withStubs(config: Routes): Routes {
  return config.map(({ loadComponent, canActivate, children, ...route }): Route => ({
    ...route,
    ...(loadComponent ? { component: children ? ShellStub : PageStub } : {}),
    ...(canActivate ? { canActivate: [() => true] } : {}),
    ...(children ? { children: withStubs(children) } : {}),
  }));
}

const shellRoute = routes.find((r) => r.path === '' && r.children)!;
const childPaths = shellRoute.children!.map((r) => r.path);

describe('routes', () => {
  describe('la configuration', () => {
    it('met les quatre écrans de la V1 dans la coque, protégée par authGuard', () => {
      expect(shellRoute.canActivate).toEqual([authGuard]);
      expect(childPaths).toEqual(['', 'objectifs/nouveau', 'objectifs/:id', 'objectifs/:id/akari', 'matrice']);
      for (const child of shellRoute.children!) expect(child.loadComponent).toBeTypeOf('function');
    });

    it('fait passer « objectifs/nouveau » avant « objectifs/:id »', () => {
      expect(childPaths.indexOf('objectifs/nouveau')).toBeLessThan(childPaths.indexOf('objectifs/:id'));
    });

    it('laisse la connexion hors de la coque, sans garde', () => {
      const auth = routes.find((r) => r.path === 'auth')!;
      expect(auth.canActivate).toBeUndefined();
      expect(auth.loadComponent).toBeTypeOf('function');
    });

    it('n’a plus de route Focus ni d’anciennes adresses servies par un écran', () => {
      const all = [...routes, ...shellRoute.children!];
      for (const path of ['focus', 'matrix', 'objective/:id']) {
        const route = all.find((r) => r.path === path)!;
        expect(route.redirectTo, path).toBeDefined();
        expect(route.loadComponent, path).toBeUndefined();
      }
      expect(routes.at(-1)).toEqual({ path: '**', redirectTo: '' });
    });

    it('donne un titre dans la voix d’Empreinte à chaque écran', () => {
      const titles = [...shellRoute.children!, routes.find((r) => r.path === 'auth')!].map((r) => r.title as string);
      expect(titles).toEqual([
        'Objectifs · Apex',
        'Nouvel objectif · Apex',
        "L'arête · Apex",
        'Akari · Apex',
        'La matrice · Apex',
        'Connexion · Apex',
      ]);
      for (const title of titles) {
        expect(motsAEviter(title), title).toEqual([]);
        expect(voiceIssues(title), title).toEqual([]);
      }
    });
  });

  describe('la navigation', () => {
    let router: Router;
    let title: Title;

    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [provideRouter(withStubs(routes))] });
      router = TestBed.inject(Router);
      title = TestBed.inject(Title);
    });

    /** Le chemin de la route feuille atteinte. */
    function leafPath(): string | undefined {
      let route = router.routerState.snapshot.root;
      while (route.firstChild) route = route.firstChild;
      return route.routeConfig?.path;
    }

    it.each([
      ['/', '', 'Objectifs · Apex'],
      ['/objectifs/nouveau', 'objectifs/nouveau', 'Nouvel objectif · Apex'],
      ['/objectifs/42', 'objectifs/:id', "L'arête · Apex"],
      ['/objectifs/42/akari?etape=7', 'objectifs/:id/akari', 'Akari · Apex'],
      ['/matrice', 'matrice', 'La matrice · Apex'],
      ['/auth', 'auth', 'Connexion · Apex'],
    ])('%s ouvre « %s » et titre la page « %s »', async (url, path, expected) => {
      expect(await router.navigateByUrl(url)).toBe(true);
      expect(router.url).toBe(url);
      expect(leafPath()).toBe(path);
      expect(title.getTitle()).toBe(expected);
    });

    it.each([
      ['/objective/42', '/objectifs/42'],
      ['/objective/42?etape=7#contenu', '/objectifs/42?etape=7#contenu'],
      ['/matrix', '/matrice'],
      ['/focus', '/matrice'],
      ['/une/adresse/inconnue', '/'],
      ['/objectifs/42/autre/chose', '/'],
    ])('%s mène à %s', async (from, to) => {
      await router.navigateByUrl(from);
      expect(router.url).toBe(to);
    });
  });
});
