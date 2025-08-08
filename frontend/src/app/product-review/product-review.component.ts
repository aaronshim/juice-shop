import { Component, CUSTOM_ELEMENTS_SCHEMA, ViewChild, type ElementRef } from '@angular/core'
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser'
import { MatButtonModule } from '@angular/material/button'

@Component({
  selector: 'app-product-review',
  templateUrl: './product-review.component.html',
  styleUrls: ['./product-review.component.scss'],
  standalone: true,
  imports: [MatButtonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ProductReviewComponent {
  @ViewChild('editor') editor: ElementRef | undefined
  reviewHtml: SafeHtml = ''

  constructor (private readonly sanitizer: DomSanitizer) { }

  submitReview (): void {
    if (this.editor) {
      // This preserves the best formatting.
      const formattedHtml = this.editor.nativeElement.getRawHtml()
      // Or should we have used this?
      // const formattedHtml = this.editor.nativeElement.getSanitizedHtml()

      // We don't want the Angular sanitizer to mangle the formatted HTML!
      this.reviewHtml = this.sanitizer.bypassSecurityTrustHtml(formattedHtml)
    }
  }
}
