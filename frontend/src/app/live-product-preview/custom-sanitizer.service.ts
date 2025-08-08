import { Injectable, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Injectable({
  providedIn: 'root'
})
export class CustomSanitizerService {
  private sanitizer = inject(DomSanitizer);

  formatAndSanitizeHtml(value: string): SafeHtml {
    const partiallySanitizedValue = value.replace(/onerror=/ig, '');
    return this.sanitizer.bypassSecurityTrustHtml(partiallySanitizedValue);
  }
}
