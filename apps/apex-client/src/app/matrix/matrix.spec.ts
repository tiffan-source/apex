import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Matrix } from './matrix';

describe('Matrix', () => {
  let component: Matrix;
  let fixture: ComponentFixture<Matrix>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Matrix],
    }).compileComponents();

    fixture = TestBed.createComponent(Matrix);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
