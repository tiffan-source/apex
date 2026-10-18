import { Component } from '@angular/core';
import { EisenhowerCategory } from '@org/apex-library';
import { Quadrant } from './quadrant/quadrant';

@Component({
  selector: 'app-matrix',
  imports: [Quadrant],
  templateUrl: './matrix.html',
})
export class Matrix {
  protected readonly Category = EisenhowerCategory;
}
