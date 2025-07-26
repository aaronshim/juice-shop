import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LiveProductPreviewComponent } from './live-product-preview.component';

describe('LiveProductPreviewComponent', () => {
  let component: LiveProductPreviewComponent;
  let fixture: ComponentFixture<LiveProductPreviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LiveProductPreviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LiveProductPreviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
