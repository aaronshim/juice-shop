import { Component } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-live-product-preview',
  templateUrl: './live-product-preview.component.html',
  styleUrls: ['./live-product-preview.component.scss']
})
export class LiveProductPreviewComponent {
  previewContent: SafeHtml = '';

  constructor(private sanitizer: DomSanitizer) { }

  updatePreview(value: string): void {
    // THIS IS THE VULNERABLE STEP
    // In a real vulnerable app, a developer might do this,
    // thinking they need to preserve some user-intended HTML.
    this.previewContent = this.sanitizer.bypassSecurityTrustHtml(value);
  }
}
