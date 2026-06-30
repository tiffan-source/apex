import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddSubObjective } from './add-sub-objective';

describe('AddSubObjective', () => {
  let component: AddSubObjective;
  let fixture: ComponentFixture<AddSubObjective>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddSubObjective],
    }).compileComponents();

    fixture = TestBed.createComponent(AddSubObjective);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
