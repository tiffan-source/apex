import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditSubObjective } from './edit-sub-objective';

describe('EditSubObjective', () => {
  let component: EditSubObjective;
  let fixture: ComponentFixture<EditSubObjective>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditSubObjective],
    }).compileComponents();

    fixture = TestBed.createComponent(EditSubObjective);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
