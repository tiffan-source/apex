import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { DailyServices } from './daily-services';
import { Checkbox } from 'primeng/checkbox';

@Component({
  selector: 'app-daily-focus',
  imports: [DatePipe, Checkbox],
  templateUrl: './daily-focus.html',
  styleUrl: './daily-focus.css',
})
export class DailyFocus {
  today = new Date();
  private readonly dailyServices = inject(DailyServices);

  tasks = this.dailyServices.mostimportantTaskOftheDay;
}
