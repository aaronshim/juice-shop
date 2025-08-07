import { Component, Input, OnChanges, SimpleChanges } from '@angular/core'
import { DomSanitizer, SafeHtml, SafeStyle } from '@angular/platform-browser'

@Component({
  selector: 'app-live-product-preview',
  standalone: true,
  templateUrl: './live-product-preview.component.html',
  styleUrls: ['./live-product-preview.component.scss']
})
export class LiveProductPreviewComponent implements OnChanges {
  @Input() productImageUrl: string = ''
  previewContent: SafeHtml = ''
  safeBackgroundImageStyle: SafeStyle = ''

  constructor (private readonly sanitizer: DomSanitizer) {
  }

  ngOnChanges (changes: SimpleChanges): void {
    if (changes.productImageUrl && this.productImageUrl) {
      const style = `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url('${this.productImageUrl}')`
      this.safeBackgroundImageStyle = this.sanitizer.bypassSecurityTrustStyle(style)
    }
  }

  updatePreview (value: string): void {
    // THIS IS THE VULNERABLE STEP
    // In a real vulnerable app, a developer might do this,
    // thinking they need to preserve some user-intended HTML.
    this.previewContent = this.sanitizer.bypassSecurityTrustHtml(value)
  }
}


