import { Component, computed, input } from '@angular/core';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-stats-card',
  imports: [CardModule],
  templateUrl: './stats-card.html',
  styleUrl: './stats-card.css',
})
export class StatsCard {
  color = input<string>("#f00");
  bgColor = computed(() => {
    const color = this.color().replace('#', '');
    const hex = color.length === 3 ? color.split('').map((c) => c + c).join('') : color.padStart(6, '0');

    const lighten = (value: string) => Math.min(255, Math.round(parseInt(value, 16) + (255 - parseInt(value, 16)) * 0.7));
    const r = lighten(hex.slice(0, 2));
    const g = lighten(hex.slice(2, 4));
    const b = lighten(hex.slice(4, 6));

    return `rgb(${r}, ${g}, ${b})`;
  });

  numberStat = input<number>(0);
  statLabel = input<string>('Stat Label');
  primeIcon = input<string>('pi pi-info-circle');
}
