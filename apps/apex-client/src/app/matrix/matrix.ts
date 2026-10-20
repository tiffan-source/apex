import { Component, ChangeDetectionStrategy } from '@angular/core';
import { EisenhowerCategory } from '@org/apex-library';
import { Quadrant } from './quadrant/quadrant';

@Component({
  selector: 'app-matrix',
  imports: [Quadrant],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './matrix.html',
})
export class Matrix {
  protected readonly Category = EisenhowerCategory;
}
