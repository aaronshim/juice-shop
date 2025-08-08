import { Injectable, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class StatusService {
  private route = inject(ActivatedRoute);

  getCurrentStatus(): string {
    return this.route.snapshot.queryParamMap.get('status') || '';
  }
}
