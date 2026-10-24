import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { motsAEviter, type PreferenceTheme, Theme } from '@empreinte-studio/angular/core';
import { EMenu, type ElementMenu } from '@empreinte-studio/angular/menu';
import { FAILURE_REPORTS, voiceIssues } from '../../chore/constants/messages.constante';
import { AnnoncesStore } from '../../chore/stores/annonces.store';
import { ObjectiveStore } from '../../chore/stores/objective.store';
import { SessionStore, type UserViewModel } from '../../chore/stores/session.store';
import { CHOSEN_SUFFIX, Shell, THEME_ANNOUNCEMENTS, THEME_CHOICES } from './shell';
import { present } from '../../testing/present';

/** Une page de la coque, qui lit ObjectiveStore comme le font les vrais écrans. */
@Component({ template: '<p>Page des objectifs</p>' })
class HomeStub {
  readonly store = inject(ObjectiveStore);
}

@Component({ template: '<p>Page de la matrice</p>' })
class MatrixStub {}

@Component({ template: '<p>Page d’un objectif</p>' })
class ObjectiveStub {}

const LEA: UserViewModel = { id: 'u-1', name: 'Léa', email: 'lea@exemple.fr' };
const objectiveStoreStub = { stub: 'ObjectiveStore simulé' };

describe('Shell', () => {
  let announce: ReturnType<typeof vi.fn>;
  let currentUser: ReturnType<typeof signal<UserViewModel | null>>;

  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      /* stockage indisponible : le thème part de la configuration */
    }
    document.documentElement.removeAttribute('data-theme');
    announce = vi.fn().mockResolvedValue(undefined);
    currentUser = signal<UserViewModel | null>(LEA);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: '',
            component: Shell,
            children: [
              { path: '', pathMatch: 'full', component: HomeStub },
              { path: 'matrice', component: MatrixStub },
              { path: 'objectifs/nouveau', component: ObjectiveStub },
              { path: 'objectifs/:id', component: ObjectiveStub },
              { path: 'objectifs/:id/akari', component: ObjectiveStub },
            ],
          },
        ]),
        { provide: SessionStore, useValue: { currentUser } },
        { provide: LiveAnnouncer, useValue: { announce } },
      ],
    });
    // La vraie coque fournit le vrai ObjectiveStore ; ici, un store simulé (aucune infrastructure).
    TestBed.overrideComponent(Shell, { set: { providers: [{ provide: ObjectiveStore, useValue: objectiveStoreStub }] } });
  });

  async function open(url = '/') {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    harness.detectChanges();
    return harness;
  }

  const shellOf = (harness: RouterTestingHarness) => harness.fixture.nativeElement.querySelector('app-shell') as HTMLElement;
  const navLink = (root: HTMLElement, label: string) =>
    present(
      [...root.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Navigation principale"] a[href]')].find(
        (a) => a.textContent?.trim() === label,
      ),
      `l'entrée « ${label} »`,
    );
  const menus = (harness: RouterTestingHarness) =>
    harness.fixture.debugElement.queryAll(By.directive(EMenu)).map((d) => d.componentInstance as EMenu<PreferenceTheme>);
  const labels = (entries: readonly unknown[]) => (entries as ElementMenu<PreferenceTheme>[]).map((e) => e.libelle);

  describe('la navigation', () => {
    it('affiche la marque « Apex » et deux entrées : Objectifs et Matrice, avec leurs icônes', async () => {
      const root = shellOf(await open());
      const marque = present(root.querySelector<HTMLAnchorElement>('nav a.e-nav__marque'), 'la marque');
      expect(marque.textContent?.trim()).toBe('Apex');
      expect(marque.getAttribute('href')).toBe('/');

      const links = [...root.querySelectorAll<HTMLAnchorElement>('ul a')];
      expect(links.map((a) => a.textContent?.trim())).toEqual(['Objectifs', 'Matrice']);
      expect(links.map((a) => a.getAttribute('href'))).toEqual(['/', '/matrice']);
      for (const link of links) expect(link.querySelector('e-icone svg')).not.toBeNull();
      expect(root.textContent).not.toContain('Focus');
    });

    it('pose la corne (aria-current="page") sur Objectifs à l’accueil, et seulement là', async () => {
      const root = shellOf(await open('/'));
      expect(navLink(root, 'Objectifs').getAttribute('aria-current')).toBe('page');
      expect(navLink(root, 'Matrice').hasAttribute('aria-current')).toBe(false);
    });

    it('pose la corne sur Matrice dans la matrice, pas sur Objectifs (« / » est exact)', async () => {
      const harness = await open('/');
      await harness.navigateByUrl('/matrice');
      harness.detectChanges();
      const root = shellOf(harness);
      expect(navLink(root, 'Matrice').getAttribute('aria-current')).toBe('page');
      expect(navLink(root, 'Objectifs').hasAttribute('aria-current')).toBe(false);
    });

    it.each(['/objectifs/nouveau', '/objectifs/42', '/objectifs/42/akari?etape=7'])(
      'garde Objectifs comme entrée courante sur %s (maquettes Arête et Akari)',
      async (url) => {
        const root = shellOf(await open(url));
        expect(navLink(root, 'Objectifs').getAttribute('aria-current')).toBe('page');
        expect(navLink(root, 'Matrice').hasAttribute('aria-current')).toBe(false);
      },
    );

    it('n’affiche aucun sceau : la coque laisse le sien à l’écran', async () => {
      const root = shellOf(await open());
      expect(root.querySelectorAll('.e-btn--sceau, e-sceau').length).toBe(0);
    });
  });

  describe('la personne, en bas de la navigation', () => {
    it('montre l’initiale et le nom', async () => {
      const root = shellOf(await open());
      const initial = present(root.querySelector('[eNavBas] .initial'), "l'initiale");
      expect(initial.textContent?.trim()).toBe('L');
      expect(initial.getAttribute('aria-hidden')).toBe('true');
      expect(present(root.querySelector('[eNavBas]'), 'le bas de la navigation').textContent).toContain('Léa');
    });

    it('prend l’adresse quand le nom manque, et met l’initiale en capitale', async () => {
      currentUser.set({ id: 'u-2', name: '  ', email: 'élise@exemple.fr' });
      const root = shellOf(await open());
      expect(present(root.querySelector('[eNavBas] .initial'), "l'initiale").textContent?.trim()).toBe('É');
      expect(present(root.querySelector('[eNavBas]'), 'le bas de la navigation').textContent).toContain('élise@exemple.fr');
    });

    it('coupe une adresse longue sans élargir la navigation (grille minmax(0, 1fr) autour du texte)', async () => {
      currentUser.set({ id: 'u-3', name: '', email: 'une.adresse.vraiment.longue@exemple-de-domaine.fr' });
      const root = shellOf(await open());
      const text = present(root.querySelector('[eNavBas] .ds-truncate'), "le nom ou l'adresse");
      expect(text.textContent?.trim()).toBe('une.adresse.vraiment.longue@exemple-de-domaine.fr');
      // Mesuré dans Chrome : sans la grille, la navigation passait de 232 à 350px pour une adresse de 25 lettres.
      expect(present(text.parentElement, 'son conteneur').matches('.ds-grid.ds-grow')).toBe(true);
    });

    it('ne dessine pas d’initiale vide sans session', async () => {
      currentUser.set(null);
      const root = shellOf(await open());
      expect(root.querySelector('.initial')).toBeNull();
    });
  });

  describe('les réglages', () => {
    it('propose un menu « Réglages » dans le bas de la navigation, et un autre pour le mobile', async () => {
      const harness = await open();
      const root = shellOf(harness);
      const found = menus(harness);
      expect(found.length).toBe(2);
      for (const menu of found) {
        expect(menu.libelle()).toBe('Réglages');
        expect(menu.icone()).toBe('reglages');
      }
      expect(root.querySelector('[eNavBas] e-menu')).not.toBeNull();
      // eNavBas disparaît sous 760px : le second menu est dans la navigation, enveloppé dans .ds-show-mobile.
      expect(root.querySelector('nav > .ds-show-mobile > e-menu')).not.toBeNull();
      expect(root.querySelector('.ds-show-mobile [eNavBas]')).toBeNull();
    });

    it('dit quelle entrée est retenue : Jour au premier lancement', async () => {
      const [menu] = menus(await open());
      expect(labels(menu.entrees())).toEqual(['Thème Jour · choisi', 'Thème Nuit', "Comme l'appareil"]);
      const chosen = (menu.entrees() as ElementMenu<PreferenceTheme>[]).filter((e) => e.icone === 'coche');
      expect(chosen.map((e) => e.valeur)).toEqual(['jour']);
    });

    it('passe en Nuit au choix « Thème Nuit », l’annonce, et l’entrée retenue suit', async () => {
      const harness = await open();
      const [desktop, mobile] = menus(harness);
      desktop.choix.emit('nuit');
      harness.detectChanges();
      TestBed.tick();

      const theme = TestBed.inject(Theme);
      expect(theme.preference()).toBe('nuit');
      expect(document.documentElement.getAttribute('data-theme')).toBe('nuit');
      expect(announce).toHaveBeenCalledWith('Thème Nuit choisi.', 'polite');
      expect(labels(desktop.entrees())).toEqual(['Thème Jour', 'Thème Nuit · choisi', "Comme l'appareil"]);
      expect(labels(mobile.entrees())).toEqual(['Thème Jour', 'Thème Nuit · choisi', "Comme l'appareil"]);
    });

    it('suit l’appareil au choix « Comme l’appareil », depuis le menu mobile', async () => {
      const harness = await open();
      const [, mobile] = menus(harness);
      mobile.choix.emit('systeme');
      harness.detectChanges();
      expect(TestBed.inject(Theme).preference()).toBe('systeme');
      expect(announce).toHaveBeenCalledWith('Le thème suit ton appareil.', 'polite');
      expect(labels(mobile.entrees())).toEqual(['Thème Jour', 'Thème Nuit', "Comme l'appareil · choisi"]);
    });

    it('déplie le menu au clic et applique l’entrée choisie', async () => {
      const harness = await open();
      const trigger = present(
        shellOf(harness).querySelector<HTMLButtonElement>('[eNavBas] e-menu button[aria-label="Réglages"]'),
        'le bouton « Réglages »',
      );
      trigger.click();
      harness.detectChanges();
      await harness.fixture.whenStable();

      const items = [...document.querySelectorAll<HTMLElement>('.e-menu__element')];
      expect(items.map((i) => i.textContent?.trim())).toEqual(['Thème Jour · choisi', 'Thème Nuit', "Comme l'appareil"]);
      items[1].click();
      harness.detectChanges();
      expect(TestBed.inject(Theme).preference()).toBe('nuit');
    });
  });

  describe('le lien d’évitement', () => {
    it('est le premier élément de la coque et vise la page courante, pas l’accueil', async () => {
      const root = shellOf(await open('/matrice'));
      const skip = root.firstElementChild as HTMLAnchorElement;
      expect(skip.matches('a.skip-link')).toBe(true);
      expect(skip.textContent?.trim()).toBe('Aller au contenu');
      expect(skip.getAttribute('href')).toBe('/matrice#contenu');
      expect(skip.getAttribute('href')).not.toBe('/#contenu');
    });

    it('garde les paramètres de la page (?etape=…)', async () => {
      const root = shellOf(await open('/objectifs/42/akari?etape=7'));
      expect(present(root.querySelector('a.skip-link'), "le lien d'évitement").getAttribute('href')).toBe('/objectifs/42/akari?etape=7#contenu');
    });

    it('donne le focus au contenu et reste sur la page', async () => {
      const harness = await open('/matrice');
      const root = shellOf(harness);
      present(root.querySelector<HTMLAnchorElement>('a.skip-link'), "le lien d'évitement").click();
      await harness.fixture.whenStable();
      harness.detectChanges();

      const main = present(root.querySelector<HTMLElement>('main#contenu'), 'main#contenu');
      expect(main.getAttribute('tabindex')).toBe('-1');
      expect(document.activeElement).toBe(main);
      const router = TestBed.inject(Router);
      expect(router.url).toBe('/matrice#contenu');
      expect(root.textContent).toContain('Page de la matrice');
    });
  });

  describe('le contenu', () => {
    it('rend la page dans le contenu de la coque, sans note quand tout va bien', async () => {
      const root = shellOf(await open());
      const content = present(root.querySelector('main [eCoqueContenu]'), 'le contenu de la coque');
      expect(content.textContent).toContain('Page des objectifs');
      expect(root.querySelector('aside[eNote]')).toBeNull();
    });

    it('fournit ObjectiveStore aux écrans de la coque', async () => {
      const harness = await open();
      const page = harness.fixture.debugElement.query(By.directive(HomeStub)).componentInstance as HomeStub;
      expect(page.store).toBe(objectiveStoreStub);
    });

    it('affiche un signalement en haut du contenu, signé Akari, jusqu’à « Compris »', async () => {
      const harness = await open();
      const annonces = TestBed.inject(AnnoncesStore);
      annonces.signaler(FAILURE_REPORTS.moveTask);
      harness.detectChanges();

      const root = shellOf(harness);
      const content = present(root.querySelector('main [eCoqueContenu]'), 'le contenu de la coque');
      const note = present(content.querySelector('aside[eNote]'), 'la note');
      expect(note).not.toBeNull();
      expect(content.firstElementChild).toBe(note);
      expect(present(note.querySelector('.e-note__qui'), 'la signature').textContent?.trim()).toBe('Akari');
      expect(note.getAttribute('aria-label')).toBe("Message d'Akari");
      expect(note.textContent).toContain(FAILURE_REPORTS.moveTask);

      const understood = present([...note.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Compris'), '« Compris »');
      understood.focus();
      understood.click();
      harness.detectChanges();
      expect(annonces.signalement()).toBeNull();
      expect(root.querySelector('aside[eNote]')).toBeNull();
      expect(content.textContent).toContain('Page des objectifs');
      // Le bouton a disparu avec la note : le focus passe au contenu, pas au document.
      expect(document.activeElement).toBe(root.querySelector('main#contenu'));
    });

    it('place la note avant la page', async () => {
      const harness = await open();
      TestBed.inject(AnnoncesStore).signaler(FAILURE_REPORTS.loadObjectives);
      harness.detectChanges();
      const note = present(shellOf(harness).querySelector('aside[eNote]'), 'la note');
      const page: HTMLElement = harness.fixture.debugElement.query(By.directive(HomeStub)).nativeElement;
      expect(note.compareDocumentPosition(page) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(note.contains(page)).toBe(false);
    });
  });

  describe('le changement de page', () => {
    it('ne prend pas le focus à l’ouverture de la première page', async () => {
      (document.activeElement as HTMLElement | null)?.blur();
      const root = shellOf(await open('/'));
      expect(document.activeElement).not.toBe(root.querySelector('main#contenu'));
    });

    it('donne le focus au contenu quand ce qui a mené à la page est parti avec l’ancienne', async () => {
      const harness = await open('/');
      // « Ouvrir », un fil d'Ariane… : le lien disparaît avec la page, le focus tombe sur le document.
      (document.activeElement as HTMLElement | null)?.blur();
      await harness.navigateByUrl('/objectifs/42');
      harness.detectChanges();
      await harness.fixture.whenStable();
      expect(document.activeElement).toBe(shellOf(harness).querySelector('main#contenu'));
    });

    it('laisse le focus sur une entrée de la navigation, qui reste à l’écran', async () => {
      const harness = await open('/');
      const matrice = navLink(shellOf(harness), 'Matrice');
      matrice.focus();
      await harness.navigateByUrl('/matrice');
      harness.detectChanges();
      await harness.fixture.whenStable();
      expect(document.activeElement).toBe(matrice);
    });

    it('ne bouge pas quand seuls la requête ou le fragment changent', async () => {
      const harness = await open('/objectifs/42/akari?etape=7');
      (document.activeElement as HTMLElement | null)?.blur();
      await harness.navigateByUrl('/objectifs/42/akari?etape=8');
      harness.detectChanges();
      await harness.fixture.whenStable();
      expect(document.activeElement).not.toBe(shellOf(harness).querySelector('main#contenu'));
    });
  });

  describe('la voix', () => {
    it('ne contient aucun mot hors de la voix d’Empreinte', async () => {
      const harness = await open();
      TestBed.inject(AnnoncesStore).signaler(FAILURE_REPORTS.editTask);
      harness.detectChanges();
      const root = shellOf(harness);
      const [menu] = menus(harness);

      const texts = [
        root.textContent ?? '',
        ...[...root.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label') ?? ''),
        ...labels(menu.entrees()),
        ...THEME_CHOICES.map((c) => c.libelle + CHOSEN_SUFFIX),
        ...Object.values(THEME_ANNOUNCEMENTS),
      ];
      for (const text of texts) {
        expect(motsAEviter(text), text).toEqual([]);
        expect(voiceIssues(text), text).toEqual([]);
      }
    });
  });
});
