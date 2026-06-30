import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DailyFocus } from './daily-focus';

describe('DailyFocus', () => {
  let component: DailyFocus;
  let fixture: ComponentFixture<DailyFocus>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DailyFocus],
    }).compileComponents();

    fixture = TestBed.createComponent(DailyFocus);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
