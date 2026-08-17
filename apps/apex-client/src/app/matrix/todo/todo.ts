import { Component, computed } from '@angular/core';
import { Card } from 'primeng/card';
import { Checkbox } from 'primeng/checkbox';
import { Section } from '../section';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-todo',
  imports: [Card, Checkbox, FormsModule],
  templateUrl: './todo.html',
  styleUrl: './todo.css',
})
export class Todo extends Section{
    todoList = computed(() => this.objectiveStore.tasksByEisenhowerCategory().Faire);
}
