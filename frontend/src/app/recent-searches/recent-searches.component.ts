import { Component, OnInit } from '@angular/core'
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser'
import { RouterLink } from '@angular/router'

@Component({
  selector: 'app-recent-searches',
  templateUrl: './recent-searches.component.html',
  styleUrls: ['./recent-searches.component.scss'],
  standalone: true,
  imports: [RouterLink]
})
export class RecentSearchesComponent implements OnInit {
  recentSearches: Array<{ raw: string, trusted: SafeHtml }> = []

  constructor (private readonly sanitizer: DomSanitizer) { }

  ngOnInit (): void {
    const searches = localStorage.getItem('recentSearches')
    if (searches) {
      const parsedSearches: string[] = JSON.parse(searches)
      this.recentSearches = parsedSearches.map(term => {
        return {
          raw: term,
          trusted: this.sanitizer.bypassSecurityTrustHtml(term)
        }
      })
    }
  }
}
