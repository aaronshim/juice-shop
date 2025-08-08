import { Routes } from '@angular/router';
import { ProfileTheme } from './profile-theme/profile-theme';
import { ProfileStatus } from './profile-status/profile-status';

export const routes: Routes = [
    {
        path: 'profile',
        component: ProfileTheme
    },
    {
        path: 'profile-status',
        component: ProfileStatus
    }
];
