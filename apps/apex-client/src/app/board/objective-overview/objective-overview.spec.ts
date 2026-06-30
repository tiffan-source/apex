import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ObjectiveOverview } from './objective-overview';

describe('ObjectiveOverview', () => {
  let component: ObjectiveOverview;
  let fixture: ComponentFixture<ObjectiveOverview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ObjectiveOverview],
    }).compileComponents();

    fixture = TestBed.createComponent(ObjectiveOverview);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
