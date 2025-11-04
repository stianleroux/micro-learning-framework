import { Component, inject, signal, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { TrainingService } from '../../core/services/training.service';
import { NotificationService } from '../../core/services/notification.service';
import { TeamComment, CommentType, CommentVisibility } from '../../core/models/team-comment.model';
import { User } from '../../core/models/user.model';
import { TrainingItem } from '../../core/models/training-item.model';
import { Subject, takeUntil, combineLatest } from 'rxjs';

interface CommentThread {
  comment: TeamComment;
  replies: TeamComment[];
  isExpanded: boolean;
}

interface CommentState {
  threads: CommentThread[];
  isLoading: boolean;
  error: string | null;
  filterByType: CommentType | null;
  filterByVisibility: CommentVisibility | null;
  showOnlyUnread: boolean;
}

interface NewCommentForm {
  content: string;
  type: CommentType;
  visibility: CommentVisibility;
  parentCommentId: string | null;
  isPrivateNote: boolean;
}

@Component({
  selector: 'app-team-comments',
  imports: [CommonModule, FormsModule],
  templateUrl: './team-comments.html',
  styleUrl: './team-comments.scss',
})
export class TeamComments implements OnInit, OnDestroy {
  @Input() trainingItemId: string | null = null;
  @Input() userId: string | null = null;
  @Input() reviewPeriodId: string | null = null;

  private supabaseService = inject(SupabaseService);
  private trainingService = inject(TrainingService);
  private notificationService = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private destroy$ = new Subject<void>();

  // Expose enums for template
  readonly CommentType = CommentType;
  readonly CommentVisibility = CommentVisibility;

  // Component state
  currentUser = signal<User | null>(null);
  targetItem = signal<TrainingItem | null>(null);
  commentState = signal<CommentState>({
    threads: [],
    isLoading: false,
    error: null,
    filterByType: null,
    filterByVisibility: null,
    showOnlyUnread: false,
  });

  // New comment form
  newCommentForm = signal<NewCommentForm>({
    content: '',
    type: CommentType.GENERAL,
    visibility: CommentVisibility.TEAM,
    parentCommentId: null,
    isPrivateNote: false,
  });

  // UI state
  showCommentForm = signal(false);
  selectedThread = signal<string | null>(null);

  ngOnInit() {
    // Check for route parameter
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      if (params['itemId']) {
        this.trainingItemId = params['itemId'];
      }
    });

    this.loadCurrentUser();
    this.loadTrainingItem();
    this.loadComments();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCurrentUser() {
    this.supabaseService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.currentUser.set(user);
    });
  }

  private loadTrainingItem() {
    if (!this.trainingItemId) return;

    this.trainingService
      .getTrainingItems()
      .pipe(takeUntil(this.destroy$))
      .subscribe((items) => {
        const item = items.find((i) => i.id === this.trainingItemId);
        this.targetItem.set(item || null);
      });
  }

  private loadComments() {
    if (!this.trainingItemId && !this.userId && !this.reviewPeriodId) return;

    this.commentState.update((state) => ({ ...state, isLoading: true }));

    // Build filters based on inputs
    const filters: any = {};
    if (this.trainingItemId) filters.training_item_id = this.trainingItemId;
    if (this.userId) filters.user_id = this.userId;
    if (this.reviewPeriodId) filters.review_period_id = this.reviewPeriodId;

    // Load comments from Supabase
    this.supabaseService.client
      .from('team_comments')
      .select(
        `
        *,
        author:users!team_comments_author_id_fkey(id, full_name, avatar_url),
        mentions:users!team_comments_mentioned_user_ids_fkey(id, full_name)
      `
      )
      .match(filters)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          this.commentState.update((state) => ({
            ...state,
            isLoading: false,
            error: error.message,
          }));
          return;
        }

        const comments = data || [];
        const threads = this.buildCommentThreads(comments);

        this.commentState.update((state) => ({
          ...state,
          threads,
          isLoading: false,
          error: null,
        }));
      });
  }

  private buildCommentThreads(comments: any[]): CommentThread[] {
    const threadsMap = new Map<string, CommentThread>();
    const rootThreads: CommentThread[] = [];

    // First pass: create thread objects
    comments.forEach((commentData) => {
      const comment = new TeamComment(commentData);

      if (!comment.parent_comment_id) {
        // Root comment - create new thread
        const thread: CommentThread = {
          comment,
          replies: [],
          isExpanded: false,
        };
        threadsMap.set(comment.id, thread);
        rootThreads.push(thread);
      }
    });

    // Second pass: add replies to threads
    comments.forEach((commentData) => {
      const comment = new TeamComment(commentData);

      if (comment.parent_comment_id) {
        const parentThread = threadsMap.get(comment.parent_comment_id);
        if (parentThread) {
          parentThread.replies.push(comment);
        }
      }
    });

    // Sort threads by creation date
    rootThreads.sort(
      (a, b) => new Date(b.comment.created_at).getTime() - new Date(a.comment.created_at).getTime()
    );

    return rootThreads;
  }

  // Comment actions
  startNewComment(parentCommentId: string | null = null) {
    this.newCommentForm.update((form) => ({
      ...form,
      parentCommentId,
      content: '',
      type: CommentType.GENERAL,
      visibility: CommentVisibility.TEAM,
    }));
    this.showCommentForm.set(true);
  }

  cancelComment() {
    this.showCommentForm.set(false);
    this.newCommentForm.update((form) => ({
      ...form,
      content: '',
      parentCommentId: null,
    }));
  }

  async submitComment() {
    const form = this.newCommentForm();
    const user = this.currentUser();

    if (!form.content.trim() || !user) return;

    const newComment = new TeamComment({
      content: form.content,
      type: form.type,
      visibility: form.visibility,
      author_id: user.id,
      training_item_id: this.trainingItemId || undefined,
      user_id: this.userId || undefined,
      review_period_id: this.reviewPeriodId || undefined,
      parent_comment_id: form.parentCommentId || undefined,
      is_private_note: form.isPrivateNote,
      mentioned_user_ids: this.extractMentions(form.content),
    });

    try {
      const { error } = await this.supabaseService.client.from('team_comments').insert(newComment);

      if (error) throw error;

      // Reload comments
      this.loadComments();
      this.cancelComment();

      // Send notifications for mentions
      if (newComment.mentioned_user_ids.length > 0) {
        this.sendMentionNotifications(newComment);
      }
    } catch (error) {
      console.error('Failed to submit comment:', error);
      this.commentState.update((state) => ({
        ...state,
        error: 'Failed to submit comment',
      }));
    }
  }

  private extractMentions(content: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }

    return mentions;
  }

  private async sendMentionNotifications(comment: TeamComment) {
    const user = this.currentUser();
    const trainingItem = this.targetItem();

    if (!user || !comment.mentioned_user_ids.length) return;

    try {
      // Process notifications for this comment
      const commentData = {
        id: comment.id || '',
        content: comment.content,
        author_id: user.id,
        author_name: user.full_name || user.email,
        training_item_id: comment.training_item_id || '',
        training_item_title: trainingItem?.title || 'Unknown Item',
        parent_comment_id: comment.parent_comment_id,
      };

      // Use the notification service to process all relevant notifications
      this.notificationService.processCommentNotifications(commentData).subscribe({
        next: (notifications) => {
          console.log(`Created ${notifications.length} notifications for comment`, comment.id);
        },
        error: (error) => {
          console.error('Failed to create notifications:', error);
        },
      });
    } catch (error) {
      console.error('Error sending mention notifications:', error);
    }
  }

  // Thread actions
  toggleThread(threadId: string) {
    this.commentState.update((state) => ({
      ...state,
      threads: state.threads.map((thread) =>
        thread.comment.id === threadId ? { ...thread, isExpanded: !thread.isExpanded } : thread
      ),
    }));
  }

  selectThread(threadId: string) {
    this.selectedThread.set(this.selectedThread() === threadId ? null : threadId);
  }

  // Comment management
  async deleteComment(commentId: string) {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      const { error } = await this.supabaseService.client
        .from('team_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      this.loadComments();
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  }

  async markAsRead(commentId: string) {
    const user = this.currentUser();
    if (!user) return;

    try {
      const { error } = await this.supabaseService.client
        .from('team_comments')
        .update({
          read_by: [...(await this.getReadBy(commentId)), user.id],
          updated_at: new Date().toISOString(),
        })
        .eq('id', commentId);

      if (error) throw error;

      this.loadComments();
    } catch (error) {
      console.error('Failed to mark comment as read:', error);
    }
  }

  private async getReadBy(commentId: string): Promise<string[]> {
    const { data } = await this.supabaseService.client
      .from('team_comments')
      .select('read_by')
      .eq('id', commentId)
      .single();

    return data?.read_by || [];
  }

  // Filtering
  setTypeFilter(type: CommentType | null) {
    this.commentState.update((state) => ({
      ...state,
      filterByType: type,
    }));
  }

  setVisibilityFilter(visibility: CommentVisibility | null) {
    this.commentState.update((state) => ({
      ...state,
      filterByVisibility: visibility,
    }));
  }

  // Helper methods for event handling
  onTypeFilterChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const value = target.value;
    this.setTypeFilter(value === '' ? null : (value as CommentType));
  }

  onVisibilityFilterChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const value = target.value;
    this.setVisibilityFilter(value === '' ? null : (value as CommentVisibility));
  }

  toggleUnreadFilter() {
    this.commentState.update((state) => ({
      ...state,
      showOnlyUnread: !state.showOnlyUnread,
    }));
  }

  // Helper methods
  isCommentVisible(comment: TeamComment): boolean {
    const user = this.currentUser();
    const state = this.commentState();

    // Check type filter
    if (state.filterByType && comment.type !== state.filterByType) {
      return false;
    }

    // Check visibility filter
    if (state.filterByVisibility && comment.visibility !== state.filterByVisibility) {
      return false;
    }

    // Check unread filter
    if (state.showOnlyUnread && user) {
      const readBy = comment.read_by || [];
      if (readBy.includes(user.id)) {
        return false;
      }
    }

    // Check visibility permissions
    if (!user) return false;

    switch (comment.visibility) {
      case CommentVisibility.PUBLIC:
        return true;
      case CommentVisibility.TEAM:
        return this.isUserInTeam(user, comment);
      case CommentVisibility.PRIVATE:
        return comment.author_id === user.id || comment.mentioned_user_ids.includes(user.id);
      default:
        return false;
    }
  }

  private isUserInTeam(user: User, comment: TeamComment): boolean {
    // This would check if the user is in the same team as the comment author
    // For now, we'll assume all users are in the same team
    return true;
  }

  canDeleteComment(comment: TeamComment): boolean {
    const user = this.currentUser();
    if (!user) return false;

    // Only the author or team leads can delete comments
    return comment.author_id === user.id || user.role === 'team_lead';
  }

  canReplyToComment(comment: TeamComment): boolean {
    const user = this.currentUser();
    if (!user) return false;

    // Check visibility permissions for replying
    return this.isCommentVisible(comment);
  }

  getCommentTypeIcon(type: CommentType): string {
    switch (type) {
      case CommentType.FEEDBACK:
        return '💬';
      case CommentType.QUESTION:
        return '❓';
      case CommentType.SUGGESTION:
        return '💡';
      case CommentType.APPROVAL:
        return '✅';
      case CommentType.CONCERN:
        return '⚠️';
      case CommentType.GENERAL:
        return '📝';
      default:
        return '💬';
    }
  }

  getVisibilityIcon(visibility: CommentVisibility): string {
    switch (visibility) {
      case CommentVisibility.PUBLIC:
        return '🌐';
      case CommentVisibility.TEAM:
        return '👥';
      case CommentVisibility.PRIVATE:
        return '🔒';
      default:
        return '👥';
    }
  }

  formatDate(date: Date | string): string {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return d.toLocaleDateString();
  }

  getFilteredThreads(): CommentThread[] {
    return this.commentState().threads.filter((thread) => this.isCommentVisible(thread.comment));
  }
}
