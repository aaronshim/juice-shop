import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { DomSanitizer, SafeHtml, SafeStyle } from '@angular/platform-browser';
import { CustomSanitizerService } from './custom-sanitizer.service';

@Component({
  selector: 'app-live-product-preview',
  standalone: true,
  templateUrl: './live-product-preview.component.html',
  styleUrls: ['./live-product-preview.component.scss']
  // No custom provider needed anymore
})
export class LiveProductPreviewComponent implements OnChanges {
  @Input() productImageUrl: string = '';
  previewContent: SafeHtml = '';
  safeBackgroundImageStyle: SafeStyle = '';

  private sanitizer = inject(DomSanitizer);
  private customSanitizer = inject(CustomSanitizerService);

  ngOnChanges (changes: SimpleChanges): void {
    if (changes.productImageUrl && this.productImageUrl) {
      const style = `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url('${this.productImageUrl}')`;
      this.safeBackgroundImageStyle = this.sanitizer.bypassSecurityTrustStyle(style);
    }
  }

  updatePreview (value: string): void {
    this.previewContent = this.customSanitizer.formatAndSanitizeHtml(value);
  }
}


