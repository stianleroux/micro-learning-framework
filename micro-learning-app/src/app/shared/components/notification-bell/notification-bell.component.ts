import { Component, inject, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../../core/services/notification.service';
import { NotificationComponent } from '../notification/notification.component';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule, NotificationComponent],
  template: `
    <div class="notification-bell-container" #bellContainer>
      <button
        class="notification-bell"
        (click)="toggleDropdown()"
        [class.has-notifications]="unreadCount() > 0"
        title="Notifications"
      >
        <span class="bell-icon">🔔</span>
        <span class="notification-badge" *ngIf="unreadCount() > 0">
          {{ unreadCount() > 99 ? '99+' : unreadCount() }}
        </span>
      </button>

      <div class="notification-dropdown" *ngIf="showDropdown()" [class.show]="showDropdown()">
        <app-notifications></app-notifications>
      </div>
    </div>

    <!-- Overlay to close dropdown when clicking outside -->
    <div class="notification-overlay" *ngIf="showDropdown()" (click)="closeDropdown()"></div>
  `,
  styles: [
    `
      .notification-bell-container {
        position: relative;
        display: inline-block;
      }

      .notification-bell {
        position: relative;
        background: none;
        border: none;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        color: #666;
      }

      .notification-bell:hover {
        background: rgba(0, 0, 0, 0.05);
        color: #333;
      }

      .notification-bell.has-notifications {
        color: #007bff;
      }

      .bell-icon {
        font-size: 18px;
        line-height: 1;
      }

      .notification-badge {
        position: absolute;
        top: 2px;
        right: 2px;
        background: #dc3545;
        color: white;
        font-size: 10px;
        font-weight: 600;
        padding: 2px 5px;
        border-radius: 10px;
        min-width: 16px;
        text-align: center;
        line-height: 1.2;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      }

      .notification-dropdown {
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 8px;
        z-index: 1000;
        opacity: 0;
        transform: translateY(-10px);
        transition: all 0.2s ease;
        pointer-events: none;
      }

      .notification-dropdown.show {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }

      .notification-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 999;
        background: transparent;
      }

      @media (max-width: 768px) {
        .notification-dropdown {
          right: -50px;
          width: 350px;
        }
      }

      @media (max-width: 480px) {
        .notification-dropdown {
          right: -100px;
          left: -100px;
          width: auto;
        }
      }
    `,
  ],
  host: {
    '(document:keydown.escape)': 'closeDropdown()',
  },
})
export class NotificationBellComponent {
  @ViewChild('bellContainer', { static: true }) bellContainer!: ElementRef;

  private notificationService = inject(NotificationService);

  unreadCount = signal<number>(0);
  showDropdown = signal<boolean>(false);

  ngOnInit() {
    // Subscribe to unread count
    this.notificationService.unreadCount$.subscribe((count) => {
      this.unreadCount.set(count);
    });
  }

  toggleDropdown() {
    this.showDropdown.set(!this.showDropdown());
  }

  closeDropdown() {
    this.showDropdown.set(false);
  }
}
