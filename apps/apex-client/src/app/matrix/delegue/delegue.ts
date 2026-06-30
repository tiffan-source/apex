import { Component } from '@angular/core';
import { Card } from 'primeng/card';
import { Section } from '../section';
import { Checkbox } from 'primeng/checkbox';

@Component({
  selector: 'app-delegue',
  imports: [Card, Checkbox],
  templateUrl: './delegue.html',
  styleUrl: './delegue.css',
})
export class Delegue extends Section {
  todoList = this.matrixService.getTasksEisenhower
}
