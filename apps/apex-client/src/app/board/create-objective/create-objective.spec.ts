import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CreateObjective } from './create-objective';

describe('CreateObjective', () => {
  let component: CreateObjective;
  let fixture: ComponentFixture<CreateObjective>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateObjective],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateObjective);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
