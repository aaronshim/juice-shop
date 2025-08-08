import { Component, OnInit, inject, signal, WritableSignal, PLATFORM_ID, TransferState, makeStateKey } from '@angular/core';
import { isPlatformServer, CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatCardModule } from '@angular/material/card';
import { StatusService } from '../services/status.service';
import { trustedResourceUrl } from 'safevalues'

@Component({
  selector: 'app-profile-status',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  templateUrl: './profile-status.html',
  styleUrl: './profile-status.scss'
})
export class ProfileStatus implements OnInit {
  private transferState = inject(TransferState);
  private sanitizer = inject(DomSanitizer);
  private platformId = inject(PLATFORM_ID);
  private statusService = inject(StatusService);
  x: string | undefined;

  status: WritableSignal<SafeHtml | null> = signal(null);

  ngOnInit() {
    const x = trustedResourceUrl`foobar`;
    this.x = JSON.stringify(x);
    const key = makeStateKey<string>('status');
    const storedStatus = this.transferState.get(key, null);

    if (storedStatus) {
      // On the client, trust the value from the server
      // We don't want to break formatting!
      this.status.set(this.sanitizer.bypassSecurityTrustHtml(storedStatus));
    } else if (isPlatformServer(this.platformId)) {
      // On the server, get the raw value from the URL and store it.
      const statusFromUrl = this.statusService.getCurrentStatus();
      this.transferState.set(key, statusFromUrl);
      // Also set the signal for the initial server render
      this.status.set(this.sanitizer.bypassSecurityTrustHtml(statusFromUrl));
    }
  }
}
