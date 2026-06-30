import { Component } from '@angular/core';
import { Todo } from './todo/todo';
import { Delegue } from './delegue/delegue';
import { Delete } from './delete/delete';
import { Plan } from './plan/plan';

@Component({
  selector: 'app-matrix',
  imports: [Todo, Delegue, Delete, Plan],
  templateUrl: './matrix.html',
  styleUrl: './matrix.css',
})
export class Matrix {}
