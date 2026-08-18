import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Focus } from './focus';

describe('Focus', () => {
  let component: Focus;
  let fixture: ComponentFixture<Focus>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Focus],
    }).compileComponents();

    fixture = TestBed.createComponent(Focus);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
