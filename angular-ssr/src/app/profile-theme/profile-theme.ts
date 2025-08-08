import { Component, OnInit, Inject, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { ThemeService } from '../services/theme.service';
import { trustedResourceUrl } from 'safevalues'

@Component({
  selector: 'app-profile-theme',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  templateUrl: './profile-theme.html',
  styleUrl: './profile-theme.scss'
})
export class ProfileTheme implements OnInit {
  private themeService = inject(ThemeService);
  x: string | undefined;

  constructor(
    @Inject(DOCUMENT) private document: Document
  ) {
    const x = trustedResourceUrl`foobar`;
    this.x = JSON.stringify(x);
  }

  ngOnInit(): void {
    const themeUrl = this.themeService.getThemeUrl();
    if (themeUrl) {
      const link = this.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = themeUrl;
      this.document.head.appendChild(link);
    }
  }
}

