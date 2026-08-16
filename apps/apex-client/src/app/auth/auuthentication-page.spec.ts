import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuuthenticationPage } from './auuthentication-page';

describe('AuuthenticationPage', () => {
  let component: AuuthenticationPage;
  let fixture: ComponentFixture<AuuthenticationPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuuthenticationPage],
    }).compileComponents();

    fixture = TestBed.createComponent(AuuthenticationPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
