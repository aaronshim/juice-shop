import { Injectable, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private route = inject(ActivatedRoute);

  getThemeUrl(): string | null {
    return this.route.snapshot.queryParamMap.get('themeUrl');
  }
}
