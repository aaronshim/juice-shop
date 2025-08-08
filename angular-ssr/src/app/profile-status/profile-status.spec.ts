import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfileStatus } from './profile-status';

describe('ProfileStatus', () => {
  let component: ProfileStatus;
  let fixture: ComponentFixture<ProfileStatus>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileStatus]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProfileStatus);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
