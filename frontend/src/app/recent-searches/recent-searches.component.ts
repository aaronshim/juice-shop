import { Component, Input, ViewChild, ElementRef, OnChanges, SimpleChanges } from '@angular/core'
import { RouterLink } from '@angular/router'

@Component({
  selector: 'app-recent-searches',
  templateUrl: './recent-searches.component.html',
  styleUrls: ['./recent-searches.component.scss'],
  standalone: true,
  imports: [RouterLink]
})
export class RecentSearchesComponent implements OnChanges {
  @Input() recentSearches: string[] = []
  @ViewChild('searchList') searchList: ElementRef
  isCollapsed = false

  constructor () { }

  ngOnChanges (changes: SimpleChanges): void {
    if (changes.recentSearches && this.searchList) {
      this.rebuildList()
    }
  }

  rebuildList (): void {
    // 1. Clear the existing list
    this.searchList.nativeElement.innerHTML = ''

    // 2. Loop through the data and manually insert each new element
    for (const searchTerm of this.recentSearches) {
      const liHtml = `<li><a href="/#/search?q=${encodeURIComponent(searchTerm)}">${searchTerm}</a></li>`
      this.searchList.nativeElement.insertAdjacentHTML('beforeend', liHtml)
    }
  }

  toggleCollapse () {
    this.isCollapsed = !this.isCollapsed
    // After collapsing/expanding, we might need to rebuild if the element was hidden
    if (!this.isCollapsed) {
      setTimeout(() => this.rebuildList(), 0)
    }
  }
}
