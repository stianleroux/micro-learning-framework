import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, map, filter, switchMap } from 'rxjs';
import { SupabaseService } from './supabase.service';

export interface Notification {
  id: string;
  user_id: string;
  type: 'comment' | 'mention' | 'reply' | 'system';
  title: string;
  message: string;
  data?: any; // Additional data (comment ID, training item ID, etc.)
  read: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationCreateRequest {
  user_id: string;
  type: 'comment' | 'mention' | 'reply' | 'system';
  title: string;
  message: string;
  data?: any;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  private unreadCountSubject = new BehaviorSubject<number>(0);

  public notifications$ = this.notificationsSubject.asObservable();
  public unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(private supabase: SupabaseService) {
    this.initializeNotifications();
    this.setupRealtimeSubscription();
  }

  private initializeNotifications() {
    this.supabase.currentUser$.subscribe((user) => {
      if (user) {
        this.loadUserNotifications(user.id);
      } else {
        this.notificationsSubject.next([]);
        this.unreadCountSubject.next(0);
      }
    });
  }

  private loadUserNotifications(userId: string) {
    this.supabase.select<Notification>('notifications', '*', { user_id: userId }).subscribe({
      next: (notifications) => {
        // Sort by created_at descending and take the latest 50
        const sortedNotifications = notifications
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 50);
        this.notificationsSubject.next(sortedNotifications);
        this.updateUnreadCount(sortedNotifications);
      },
      error: (error) => {
        console.error('Failed to load notifications:', error);
      },
    });
  }

  private updateUnreadCount(notifications: Notification[]) {
    const unreadCount = notifications.filter((n) => !n.read).length;
    this.unreadCountSubject.next(unreadCount);
  }

  private setupRealtimeSubscription() {
    this.supabase.currentUser$.subscribe((user) => {
      if (user) {
        this.supabase.subscribe(
          'notifications',
          (payload) => {
            if (payload.eventType === 'INSERT' && payload.new.user_id === user.id) {
              this.handleNewNotification(payload.new);
            } else if (payload.eventType === 'UPDATE' && payload.new.user_id === user.id) {
              this.handleNotificationUpdate(payload.new);
            }
          },
          { user_id: user.id }
        );
      }
    });
  }

  private handleNewNotification(notification: Notification) {
    const currentNotifications = this.notificationsSubject.value;
    const updatedNotifications = [notification, ...currentNotifications].slice(0, 50);
    this.notificationsSubject.next(updatedNotifications);
    this.updateUnreadCount(updatedNotifications);
  }

  private handleNotificationUpdate(updatedNotification: Notification) {
    const currentNotifications = this.notificationsSubject.value;
    const updatedNotifications = currentNotifications.map((n) =>
      n.id === updatedNotification.id ? updatedNotification : n
    );
    this.notificationsSubject.next(updatedNotifications);
    this.updateUnreadCount(updatedNotifications);
  }

  /**
   * Create a new notification
   */
  createNotification(request: NotificationCreateRequest): Observable<Notification> {
    const notification = {
      ...request,
      read: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return this.supabase.insert<Notification>('notifications', notification);
  }

  /**
   * Mark a notification as read
   */
  markAsRead(notificationId: string): Observable<Notification> {
    return this.supabase.update<Notification>('notifications', notificationId, {
      read: true,
      updated_at: new Date().toISOString(),
    });
  }

  /**
   * Mark all notifications as read for the current user
   */
  markAllAsRead(): Observable<void> {
    const user = this.supabase.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get all unread notifications and mark them individually
    const unreadNotifications = this.notificationsSubject.value.filter((n) => !n.read);

    if (unreadNotifications.length === 0) {
      return new Observable<void>((subscriber) => {
        subscriber.next();
        subscriber.complete();
      });
    }

    return new Observable<void>((subscriber) => {
      let completed = 0;
      const total = unreadNotifications.length;

      unreadNotifications.forEach((notification) => {
        this.markAsRead(notification.id).subscribe({
          next: () => {
            completed++;
            if (completed === total) {
              subscriber.next();
              subscriber.complete();
            }
          },
          error: (error) => {
            subscriber.error(error);
          },
        });
      });
    });
  }

  /**
   * Delete a notification
   */
  deleteNotification(notificationId: string): Observable<void> {
    return this.supabase.delete('notifications', notificationId).pipe(map(() => void 0));
  }

  /**
   * Create notification for comment mentions
   */
  createMentionNotification(
    mentionedUserId: string,
    commentAuthor: string,
    commentContent: string,
    trainingItemTitle: string,
    commentId: string,
    trainingItemId: string
  ): Observable<Notification> {
    return this.createNotification({
      user_id: mentionedUserId,
      type: 'mention',
      title: `Mentioned in "${trainingItemTitle}"`,
      message: `${commentAuthor} mentioned you in a comment: "${commentContent.substring(0, 100)}${
        commentContent.length > 100 ? '...' : ''
      }"`,
      data: {
        comment_id: commentId,
        training_item_id: trainingItemId,
        training_item_title: trainingItemTitle,
        author: commentAuthor,
      },
    });
  }

  /**
   * Create notification for new comments on items user is following
   */
  createCommentNotification(
    userId: string,
    commentAuthor: string,
    trainingItemTitle: string,
    commentId: string,
    trainingItemId: string
  ): Observable<Notification> {
    return this.createNotification({
      user_id: userId,
      type: 'comment',
      title: `New comment on "${trainingItemTitle}"`,
      message: `${commentAuthor} added a comment to "${trainingItemTitle}"`,
      data: {
        comment_id: commentId,
        training_item_id: trainingItemId,
        training_item_title: trainingItemTitle,
        author: commentAuthor,
      },
    });
  }

  /**
   * Create notification for comment replies
   */
  createReplyNotification(
    originalCommentAuthorId: string,
    replyAuthor: string,
    originalComment: string,
    trainingItemTitle: string,
    commentId: string,
    trainingItemId: string
  ): Observable<Notification> {
    return this.createNotification({
      user_id: originalCommentAuthorId,
      type: 'reply',
      title: `Reply to your comment`,
      message: `${replyAuthor} replied to your comment on "${trainingItemTitle}"`,
      data: {
        comment_id: commentId,
        training_item_id: trainingItemId,
        training_item_title: trainingItemTitle,
        author: replyAuthor,
        original_comment: originalComment.substring(0, 100),
      },
    });
  }

  /**
   * Extract @mentions from comment content
   */
  extractMentions(content: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }

    return [...new Set(mentions)]; // Remove duplicates
  }

  /**
   * Process notifications for a new comment
   */
  processCommentNotifications(comment: {
    id: string;
    content: string;
    author_id: string;
    author_name: string;
    training_item_id: string;
    training_item_title: string;
    parent_comment_id?: string;
  }): Observable<Notification[]> {
    const notifications: Observable<Notification>[] = [];

    // Extract mentions and create mention notifications
    const mentions = this.extractMentions(comment.content);
    mentions.forEach((username) => {
      // Note: In a real app, you'd need to resolve username to user_id
      // For now, we'll assume the username is the user_id
      if (username !== comment.author_id) {
        notifications.push(
          this.createMentionNotification(
            username,
            comment.author_name,
            comment.content,
            comment.training_item_title,
            comment.id,
            comment.training_item_id
          )
        );
      }
    });

    // If this is a reply, notify the original comment author
    if (comment.parent_comment_id) {
      // Note: You'd need to fetch the original comment to get the author_id
      // This is a simplified example
      notifications.push(
        this.createReplyNotification(
          'original_author_id', // Would be fetched from parent comment
          comment.author_name,
          'Original comment content', // Would be fetched from parent comment
          comment.training_item_title,
          comment.id,
          comment.training_item_id
        )
      );
    }

    // Create observables array and combine them
    if (notifications.length === 0) {
      return new Observable<Notification[]>((subscriber) => {
        subscriber.next([]);
        subscriber.complete();
      });
    }

    return new Observable<Notification[]>((subscriber) => {
      let completed = 0;
      const results: Notification[] = [];

      notifications.forEach((notif$) => {
        notif$.subscribe({
          next: (notification) => {
            results.push(notification);
          },
          error: (error) => {
            console.error('Failed to create notification:', error);
          },
          complete: () => {
            completed++;
            if (completed === notifications.length) {
              subscriber.next(results);
              subscriber.complete();
            }
          },
        });
      });
    });
  }
}
