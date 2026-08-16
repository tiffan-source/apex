import { Component, computed, inject } from '@angular/core';
import { Card } from 'primeng/card';
import { Section } from '../section';
import { Checkbox } from 'primeng/checkbox';

@Component({
  selector: 'app-delete',
  imports: [Card, Checkbox],
  templateUrl: './delete.html',
  styleUrl: './delete.css',
})
export class Delete extends Section {
  todoList = computed(() => this.objectiveStore.tasksByEisenhowerCategory().Supprimer);
}
