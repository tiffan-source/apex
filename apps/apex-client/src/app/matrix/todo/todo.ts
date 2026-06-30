import { Component, inject } from '@angular/core';
import { Card } from 'primeng/card';
import { MatrixServices } from '../matrix.services';
import { Checkbox } from 'primeng/checkbox';
import { Section } from '../section';

@Component({
  selector: 'app-todo',
  imports: [Card, Checkbox],
  templateUrl: './todo.html',
  styleUrl: './todo.css',
})
export class Todo extends Section{
  todoList = this.matrixService.getTasksEisenhower;
}
