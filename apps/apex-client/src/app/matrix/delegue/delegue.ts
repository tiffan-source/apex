import { Component, computed, inject } from '@angular/core';
import { Card } from 'primeng/card';
import { Checkbox } from 'primeng/checkbox';
import { Section } from '../section';

@Component({
  selector: 'app-delegue',
  imports: [Card, Checkbox],
  templateUrl: './delegue.html',
  styleUrl: './delegue.css',
})
export class Delegue extends Section{
  todoList = computed(() => this.objectiveStore.tasksByEisenhowerCategory().Déléguer);
}
