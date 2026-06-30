import { Component, inject, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { CreateObjective } from './create-objective/create-objective';
import { BoardServices } from './board.services';
import { CardModule } from 'primeng/card';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-board',
  imports: [Button, CreateObjective, CardModule, DatePipe],
  templateUrl: './board.html',
  styleUrl: './board.css',
})
export class Board {
  createObjectiveModalOpen = signal(false);
  private readonly objectiveServices = inject(BoardServices);

  getAllObjectives = this.objectiveServices.getAllObjectives;

  actionCard = (id: string) => {
    this.objectiveServices.consultObjective(id);
  }
}
