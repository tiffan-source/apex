import { Component, computed, input, ChangeDetectionStrategy } from '@angular/core';
import { CardModule } from 'primeng/card';
import { AvatarModule } from 'primeng/avatar';
import { avatarTone, AvatarTone } from '@org/design-tokens';

@Component({
  selector: 'app-stats-card',
  imports: [CardModule, AvatarModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './stats-card.html',
})
export class StatsCard {
  // Tonalité de la pastille, définie par le design system (pas de couleur libre)
  tone = input<AvatarTone>('accent');
  toneTokens = computed(() => avatarTone[this.tone()]);

  numberStat = input<number>(0);
  statLabel = input<string>('Stat Label');
  primeIcon = input<string>('pi pi-info-circle');
}
