// Environnement de test Angular pour Vitest (jsdom). L'application tourne avec zone.js.
import '@angular/compiler';
import '@analogjs/vitest-angular/setup-zone';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';

setupTestBed({ zoneless: false });

/*
 * jsdom ne lit pas encore @container ni @starting-style (la conversation d'Empreinte) : il écarte la feuille et
 * l'écrit, pile comprise, à chaque composant monté. Les tests ne calculent aucun style : seul ce message est tu.
 */
type JsdomErrors = {
  listeners(event: 'jsdomError'): ((error: Error) => void)[];
  removeAllListeners(event: 'jsdomError'): void;
  on(event: 'jsdomError', listener: (error: Error) => void): void;
};
const jsdomConsole = (globalThis as { jsdom?: { virtualConsole?: JsdomErrors } }).jsdom?.virtualConsole;
if (jsdomConsole) {
  const forward = jsdomConsole.listeners('jsdomError');
  jsdomConsole.removeAllListeners('jsdomError');
  jsdomConsole.on('jsdomError', (error) => {
    if (error.message !== 'Could not parse CSS stylesheet') forward.forEach((listener) => listener(error));
  });
}
