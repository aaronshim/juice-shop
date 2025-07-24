import { ComponentFixture, TestBed } from '@angular/core/testing'
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core'
import { DomSanitizer } from '@angular/platform-browser'

import { ProductReviewComponent } from './product-review.component'

describe('ProductReviewComponent', () => {
  let component: ProductReviewComponent
  let fixture: ComponentFixture<ProductReviewComponent>
  let sanitizer: DomSanitizer

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductReviewComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA] // Allow the custom <insecure-editor> element
    })
      .compileComponents()

    fixture = TestBed.createComponent(ProductReviewComponent)
    component = fixture.componentInstance
    sanitizer = TestBed.inject(DomSanitizer)
    fixture.detectChanges()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })

  it('should assign the raw HTML from the insecure editor to the reviewHtml property', () => {
    const xssPayload = '<b>Hello</b><img src=x onerror="alert(\'XSS\')">'
    // Create a mock editor element
    const mockEditor = {
      getRawHtml: () => xssPayload
    }
    // Attach it to the component instance for the test
    component.editor = { nativeElement: mockEditor }

    component.submitReview()
    fixture.detectChanges()

    expect(component.reviewHtml.toString()).toContain(xssPayload)
  })
})
