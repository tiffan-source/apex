import { Component } from '@angular/core';
import { Card } from 'primeng/card';
import { Section } from '../section';
import { Checkbox } from 'primeng/checkbox';

@Component({
  selector: 'app-plan',
  imports: [Card, Checkbox],
  templateUrl: './plan.html',
  styleUrl: './plan.css',
})
export class Plan extends Section {
  todoList = this.matrixService.getTasksEisenhower
}
