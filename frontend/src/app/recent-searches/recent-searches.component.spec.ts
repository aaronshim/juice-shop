import { type ComponentFixture, TestBed } from '@angular/core/testing'
import { RouterTestingModule } from '@angular/router/testing'
import { RecentSearchesComponent } from './recent-searches.component'
import { SimpleChange } from '@angular/core'

describe('RecentSearchesComponent', () => {
  let component: RecentSearchesComponent
  let fixture: ComponentFixture<RecentSearchesComponent>

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecentSearchesComponent, RouterTestingModule]
    })
      .compileComponents()

    fixture = TestBed.createComponent(RecentSearchesComponent)
    component = fixture.componentInstance
    fixture.detectChanges() // Initial change detection to render the component
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })

  it('should not display anything if the input array is empty', () => {
    component.recentSearches = []
    fixture.detectChanges()
    const container = fixture.nativeElement.querySelector('#recent-searches-container')
    expect(container).toBeNull()
  })

  it('should display the list of recent searches when input changes', () => {
    const searches = ['apple', 'banana']
    component.recentSearches = searches
    // Manually trigger ngOnChanges AFTER the view is initialized
    component.ngOnChanges({
      recentSearches: new SimpleChange(null, searches, true)
    })
    fixture.detectChanges()

    const listItems = fixture.nativeElement.querySelectorAll('li')
    expect(listItems.length).toBe(2)
    expect(listItems[0].textContent).toContain('apple')
    expect(listItems[1].textContent).toContain('banana')
  })

  it('should render unsanitized HTML from input strings', () => {
    const xssPayload = '<img src=x onerror="alert(\'XSS\')">'
    const searches = [xssPayload]
    component.recentSearches = searches
    component.ngOnChanges({
      recentSearches: new SimpleChange(null, searches, true)
    })
    fixture.detectChanges()

    const anchor = fixture.nativeElement.querySelector('a')
    expect(anchor.innerHTML).toContain('onerror="alert(\'XSS\')"')
  })

  it('should clear and rebuild the list on subsequent changes', () => {
    // Initial state
    const initialSearches = ['initial']
    component.recentSearches = initialSearches
    component.ngOnChanges({
      recentSearches: new SimpleChange(null, initialSearches, true)
    })
    fixture.detectChanges()
    let listItems = fixture.nativeElement.querySelectorAll('li')
    expect(listItems.length).toBe(1)

    // New state
    const newSearches = ['new1', 'new2']
    component.recentSearches = newSearches
    component.ngOnChanges({
      recentSearches: new SimpleChange(initialSearches, newSearches, false)
    })
    fixture.detectChanges()

    listItems = fixture.nativeElement.querySelectorAll('li')
    expect(listItems.length).toBe(2)
    expect(listItems[0].textContent).toContain('new1')
  })
})