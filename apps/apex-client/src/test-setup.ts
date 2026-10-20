// Environnement de test Angular pour Vitest (jsdom). L'application tourne avec zone.js.
import '@angular/compiler';
import '@analogjs/vitest-angular/setup-zone';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';

setupTestBed({ zoneless: false });
