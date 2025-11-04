import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, Notification } from '../../../core/services/notification.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="notifications-container">
      <div class="notifications-header">
        <h3>Notifications</h3>
        <div class="notifications-actions">
          <button
            class="btn btn-sm btn-outline"
            *ngIf="unreadCount() > 0"
            (click)="markAllAsRead()"
            [disabled]="isLoading()"
          >
            Mark All Read
          </button>
          <span class="unread-count" *ngIf="unreadCount() > 0"> {{ unreadCount() }} unread </span>
        </div>
      </div>

      <div class="notifications-list" *ngIf="notifications().length > 0; else noNotifications">
        <div
          *ngFor="let notification of notifications(); trackBy: trackByNotificationId"
          class="notification-item"
          [class.unread]="!notification.read"
          [class.mention]="notification.type === 'mention'"
          [class.reply]="notification.type === 'reply'"
          [class.comment]="notification.type === 'comment'"
          [class.system]="notification.type === 'system'"
          (click)="handleNotificationClick(notification)"
        >
          <div class="notification-icon">
            <span class="icon" [ngSwitch]="notification.type">
              <span *ngSwitchCase="'mention'">@</span>
              <span *ngSwitchCase="'reply'">↩️</span>
              <span *ngSwitchCase="'comment'">💬</span>
              <span *ngSwitchCase="'system'">ℹ️</span>
            </span>
          </div>

          <div class="notification-content">
            <div class="notification-title">{{ notification.title }}</div>
            <div class="notification-message">{{ notification.message }}</div>
            <div class="notification-time">
              {{ formatTime(notification.created_at) }}
            </div>
          </div>

          <div class="notification-actions">
            <button
              class="btn-icon"
              *ngIf="!notification.read"
              (click)="markAsRead(notification.id, $event)"
              title="Mark as read"
            >
              ✓
            </button>
            <button
              class="btn-icon delete"
              (click)="deleteNotification(notification.id, $event)"
              title="Delete notification"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      <ng-template #noNotifications>
        <div class="no-notifications">
          <div class="no-notifications-icon">🔔</div>
          <div class="no-notifications-text">No notifications yet</div>
          <div class="no-notifications-subtext">
            You'll see notifications here when someone mentions you or comments on your content.
          </div>
        </div>
      </ng-template>

      <div class="loading-overlay" *ngIf="isLoading()">
        <div class="spinner"></div>
      </div>
    </div>
  `,
  styles: [
    `
      .notifications-container {
        position: relative;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        max-height: 500px;
        min-width: 400px;
        display: flex;
        flex-direction: column;
      }

      .notifications-header {
        padding: 16px 20px;
        border-bottom: 1px solid #e0e0e0;
        display: flex;
        justify-content: between;
        align-items: center;
        background: #f8f9fa;
        border-radius: 8px 8px 0 0;
      }

      .notifications-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #333;
      }

      .notifications-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .unread-count {
        background: #dc3545;
        color: white;
        font-size: 12px;
        padding: 2px 6px;
        border-radius: 10px;
        font-weight: 600;
      }

      .notifications-list {
        flex: 1;
        overflow-y: auto;
        max-height: 400px;
      }

      .notification-item {
        padding: 12px 20px;
        border-bottom: 1px solid #f0f0f0;
        display: flex;
        align-items: flex-start;
        gap: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .notification-item:hover {
        background: #f8f9fa;
      }

      .notification-item:last-child {
        border-bottom: none;
      }

      .notification-item.unread {
        background: #fff3cd;
        border-left: 3px solid #ffc107;
      }

      .notification-item.mention {
        border-left-color: #17a2b8;
      }

      .notification-item.reply {
        border-left-color: #28a745;
      }

      .notification-item.comment {
        border-left-color: #6f42c1;
      }

      .notification-item.system {
        border-left-color: #6c757d;
      }

      .notification-icon {
        flex-shrink: 0;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #f8f9fa;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 600;
      }

      .notification-item.mention .notification-icon {
        background: #e7f3ff;
        color: #17a2b8;
      }

      .notification-item.reply .notification-icon {
        background: #e7f5e7;
        color: #28a745;
      }

      .notification-item.comment .notification-icon {
        background: #f3e7ff;
        color: #6f42c1;
      }

      .notification-item.system .notification-icon {
        background: #f8f9fa;
        color: #6c757d;
      }

      .notification-content {
        flex: 1;
        min-width: 0;
      }

      .notification-title {
        font-weight: 600;
        color: #333;
        margin-bottom: 4px;
        font-size: 14px;
      }

      .notification-message {
        color: #666;
        font-size: 13px;
        line-height: 1.4;
        margin-bottom: 6px;
        word-wrap: break-word;
      }

      .notification-time {
        color: #999;
        font-size: 12px;
      }

      .notification-actions {
        display: flex;
        gap: 4px;
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      .notification-item:hover .notification-actions {
        opacity: 1;
      }

      .btn-icon {
        background: none;
        border: none;
        width: 24px;
        height: 24px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s ease;
      }

      .btn-icon:hover {
        background: #f0f0f0;
      }

      .btn-icon.delete:hover {
        background: #ffe6e6;
        color: #dc3545;
      }

      .no-notifications {
        padding: 40px 20px;
        text-align: center;
        color: #666;
      }

      .no-notifications-icon {
        font-size: 48px;
        margin-bottom: 12px;
        opacity: 0.5;
      }

      .no-notifications-text {
        font-size: 16px;
        font-weight: 500;
        margin-bottom: 8px;
      }

      .no-notifications-subtext {
        font-size: 14px;
        opacity: 0.8;
      }

      .btn {
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        border: none;
      }

      .btn-outline {
        background: white;
        border: 1px solid #ddd;
        color: #666;
      }

      .btn-outline:hover {
        background: #f8f9fa;
        border-color: #bbb;
      }

      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
      }

      .spinner {
        width: 24px;
        height: 24px;
        border: 2px solid #f3f3f3;
        border-top: 2px solid #007bff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 768px) {
        .notifications-container {
          min-width: 300px;
          max-height: 400px;
        }

        .notification-item {
          padding: 10px 16px;
        }

        .notifications-header {
          padding: 12px 16px;
        }
      }
    `,
  ],
})
export class NotificationComponent {
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  notifications = signal<Notification[]>([]);
  unreadCount = signal<number>(0);
  isLoading = signal<boolean>(false);

  ngOnInit() {
    // Subscribe to notifications
    this.notificationService.notifications$.subscribe((notifications) => {
      this.notifications.set(notifications);
    });

    // Subscribe to unread count
    this.notificationService.unreadCount$.subscribe((count) => {
      this.unreadCount.set(count);
    });
  }

  trackByNotificationId(index: number, notification: Notification): string {
    return notification.id;
  }

  formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMilliseconds = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMilliseconds / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  markAsRead(notificationId: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }

    this.notificationService.markAsRead(notificationId).subscribe({
      next: () => {
        // Notification will be updated via real-time subscription
      },
      error: (error) => {
        console.error('Failed to mark notification as read:', error);
      },
    });
  }

  markAllAsRead() {
    this.isLoading.set(true);

    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Failed to mark all notifications as read:', error);
        this.isLoading.set(false);
      },
    });
  }

  deleteNotification(notificationId: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }

    this.notificationService.deleteNotification(notificationId).subscribe({
      next: () => {
        // Remove from local state
        const currentNotifications = this.notifications();
        const updatedNotifications = currentNotifications.filter((n) => n.id !== notificationId);
        this.notifications.set(updatedNotifications);
      },
      error: (error) => {
        console.error('Failed to delete notification:', error);
      },
    });
  }

  handleNotificationClick(notification: Notification) {
    // Mark as read if not already read
    if (!notification.read) {
      this.markAsRead(notification.id);
    }

    // Navigate based on notification type and data
    if (notification.data && notification.data.training_item_id) {
      this.router.navigate(['/training', notification.data.training_item_id], {
        queryParams: notification.data.comment_id ? { comment: notification.data.comment_id } : {},
      });
    }
  }
}
