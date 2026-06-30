import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Delegue } from './delegue';

describe('Delegue', () => {
  let component: Delegue;
  let fixture: ComponentFixture<Delegue>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Delegue],
    }).compileComponents();

    fixture = TestBed.createComponent(Delegue);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
