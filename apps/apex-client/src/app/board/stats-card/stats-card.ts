import { Component, input } from '@angular/core';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-stats-card',
  imports: [CardModule],
  templateUrl: './stats-card.html',
  styleUrl: './stats-card.css',
})
export class StatsCard {
  // Couleur CSS quelconque (hex ou var(--ds-…)) ; le fond de l'icône en est dérivé
  color = input<string>('var(--ds-color-accent)');
  numberStat = input<number>(0);
  statLabel = input<string>('Stat Label');
  primeIcon = input<string>('pi pi-info-circle');
}
