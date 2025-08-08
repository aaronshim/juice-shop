import { Component, Input } from '@angular/core'
import { type SafeHtml } from '@angular/platform-browser'
import { RouterLink } from '@angular/router'

@Component({
  selector: 'app-recent-searches',
  templateUrl: './recent-searches.component.html',
  styleUrls: ['./recent-searches.component.scss'],
  standalone: true,
  imports: [RouterLink]
})
export class RecentSearchesComponent {
  @Input() recentSearches: Array<{ raw: string, trusted: SafeHtml }> = []
  isCollapsed = false

  toggleCollapse () {
    this.isCollapsed = !this.isCollapsed
  }
}
