import { Component, computed, inject } from '@angular/core';
import { Card } from 'primeng/card';
import { Checkbox } from 'primeng/checkbox';
import { Section } from '../section';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-delegue',
  imports: [Card, Checkbox, FormsModule],
  templateUrl: './delegue.html',
  styleUrl: './delegue.css',
})
export class Delegue extends Section{
  todoList = computed(() => this.objectiveStore.tasksByEisenhowerCategory().Déléguer);
}
