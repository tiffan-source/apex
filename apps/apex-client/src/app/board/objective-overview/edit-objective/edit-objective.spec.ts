import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditObjective } from './edit-objective';

describe('EditObjective', () => {
  let component: EditObjective;
  let fixture: ComponentFixture<EditObjective>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditObjective],
    }).compileComponents();

    fixture = TestBed.createComponent(EditObjective);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
