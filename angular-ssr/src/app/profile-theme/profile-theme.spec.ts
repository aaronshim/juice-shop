import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfileTheme } from './profile-theme';

describe('ProfileTheme', () => {
  let component: ProfileTheme;
  let fixture: ComponentFixture<ProfileTheme>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileTheme]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProfileTheme);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
