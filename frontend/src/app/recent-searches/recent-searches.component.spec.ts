import { type ComponentFixture, TestBed } from '@angular/core/testing'
import { RouterTestingModule } from '@angular/router/testing'

import { RecentSearchesComponent } from './recent-searches.component'

describe('RecentSearchesComponent', () => {
  let component: RecentSearchesComponent
  let fixture: ComponentFixture<RecentSearchesComponent>
  let getSpy: jasmine.Spy

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecentSearchesComponent, RouterTestingModule]
    })
      .compileComponents()

    fixture = TestBed.createComponent(RecentSearchesComponent)
    component = fixture.componentInstance
    getSpy = spyOn(localStorage, 'getItem').and.returnValue(null)
    fixture.detectChanges()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })

  it('should not display anything if there are no recent searches', () => {
    component.ngOnInit()
    fixture.detectChanges()
    const list = fixture.nativeElement.querySelector('ul')
    expect(list).toBeNull()
  })

  it('should display the list of recent searches', () => {
    const searches = ['apple', 'banana', 'cherry']
    getSpy.and.returnValue(JSON.stringify(searches))

    component.ngOnInit()
    fixture.detectChanges()

    const listItems = fixture.nativeElement.querySelectorAll('li')
    expect(listItems.length).toBe(3)
    expect(listItems[0].textContent).toContain('apple')
    expect(listItems[1].textContent).toContain('banana')
    expect(listItems[2].textContent).toContain('cherry')
  })

  it('should render unsanitized HTML from localStorage', () => {
    const xssPayload = '<img src=x onerror="alert(\'XSS\')">'
    const searches = [xssPayload]
    getSpy.and.returnValue(JSON.stringify(searches))

    component.ngOnInit()
    fixture.detectChanges()

    const anchor = fixture.nativeElement.querySelector('a')
    expect(anchor.innerHTML).toContain('onerror="alert(\'XSS\')"')
  })
})
