import { Component, computed, inject } from '@angular/core';
import { Card } from 'primeng/card';
import { Section } from '../section';
import { Checkbox } from 'primeng/checkbox';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-plan',
  imports: [Card, Checkbox, FormsModule],
  templateUrl: './plan.html',
  styleUrl: './plan.css',
})
export class Plan extends Section {
  todoList = computed(() => this.objectiveStore.tasksByEisenhowerCategory().Planifier);
}
