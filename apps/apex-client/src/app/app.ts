import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * La racine d'Apex. Rien ne surgit à l'écran : les réussites sont annoncées aux lecteurs d'écran
 * et les signalements affichés par la coque (AnnoncesStore, chore/stores/annonces.store.ts).
 */
@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
})
export class App {}
