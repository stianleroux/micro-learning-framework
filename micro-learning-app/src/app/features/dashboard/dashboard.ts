import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, combineLatest } from 'rxjs';
import { takeUntil, map } from 'rxjs/operators';

import { SupabaseService } from '../../core/services/supabase.service';
import { TrainingService } from '../../core/services/training.service';
import { User } from '../../core/models/user.model';
import { TrainingItem, SkillType, TrainingStatus } from '../../core/models/training-item.model';
import { SkillCardComponent } from '../../shared/components/skill-card/skill-card';
import { ProgressBarComponent } from '../../shared/components/progress-bar/progress-bar';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule, SkillCardComponent, ProgressBarComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  currentUser$: Observable<User | null>;
  currentHardSkill$!: Observable<TrainingItem | null>;
  currentSoftSkill$!: Observable<TrainingItem | null>;
  userStats$: Observable<any>;
  recentActivity$!: Observable<TrainingItem[]>;

  // Dashboard data
  currentUser: User | null = null;
  isEditingProfile = false;
  editProfile = {
    my_why: '',
    about_me: '',
    current_hard_skill: '',
    current_soft_skill: '',
  };

  // Quick stats
  todayProgress = 0;
  weeklyGoal = 5; // 5 sessions per week
  weeklyCompleted = 0;
  streakDays = 0;

  constructor(private supabase: SupabaseService, private trainingService: TrainingService) {
    this.currentUser$ = this.supabase.currentUser$;
    this.userStats$ = this.currentUser$.pipe(
      map((user) => (user ? this.trainingService.getUserStats(user.id) : null))
    );
  }

  ngOnInit(): void {
    this.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.currentUser = user;
      if (user) {
        this.editProfile = {
          my_why: user.my_why || '',
          about_me: user.about_me || '',
          current_hard_skill: user.current_hard_skill || '',
          current_soft_skill: user.current_soft_skill || '',
        };
        this.loadDashboardData(user);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadDashboardData(user: User): void {
    // Load current focus skills
    this.currentHardSkill$ = this.trainingService
      .getTrainingItems(user.id)
      .pipe(
        map((items) => this.findCurrentSkill(items, SkillType.HARD_SKILL, user.current_hard_skill))
      );

    this.currentSoftSkill$ = this.trainingService
      .getTrainingItems(user.id)
      .pipe(
        map((items) => this.findCurrentSkill(items, SkillType.SOFT_SKILL, user.current_soft_skill))
      );

    // Load recent activity
    this.recentActivity$ = this.trainingService
      .getTrainingItems(user.id)
      .pipe(map((items) => this.getRecentActivity(items)));

    // Calculate today's progress and streaks
    this.calculateProgressMetrics(user.id);
  }

  private findCurrentSkill(
    items: TrainingItem[],
    skillType: SkillType,
    skillName?: string
  ): TrainingItem | null {
    const flatItems = this.flattenTrainingItems(items);

    if (skillName) {
      // Find by name first
      const byName = flatItems.find(
        (item) =>
          item.skill_type === skillType &&
          item.title.toLowerCase().includes(skillName.toLowerCase())
      );
      if (byName) return byName;
    }

    // Find the most recently practiced item of this skill type
    const skillItems = flatItems
      .filter((item) => item.skill_type === skillType && item.status === TrainingStatus.IN_PROGRESS)
      .sort((a, b) => {
        const aDate = a.last_practiced_at || a.created_at;
        const bDate = b.last_practiced_at || b.created_at;
        return bDate.getTime() - aDate.getTime();
      });

    return skillItems.length > 0 ? skillItems[0] : null;
  }

  private getRecentActivity(items: TrainingItem[]): TrainingItem[] {
    const flatItems = this.flattenTrainingItems(items);
    return flatItems
      .filter((item) => item.last_practiced_at || item.completed_at)
      .sort((a, b) => {
        const aDate = a.last_practiced_at || a.completed_at || a.created_at;
        const bDate = b.last_practiced_at || b.completed_at || b.created_at;
        return bDate.getTime() - aDate.getTime();
      })
      .slice(0, 5);
  }

  private flattenTrainingItems(items: TrainingItem[]): TrainingItem[] {
    const result: TrainingItem[] = [];

    const addItems = (itemsToAdd: TrainingItem[]) => {
      itemsToAdd.forEach((item) => {
        result.push(item);
        if (item.children) {
          addItems(item.children);
        }
      });
    };

    addItems(items);
    return result;
  }

  private calculateProgressMetrics(userId: string): void {
    this.trainingService
      .getTrainingItems(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((items) => {
        const flatItems = this.flattenTrainingItems(items);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Today's progress
        const todayItems = flatItems.filter((item) => {
          const lastPracticed = item.last_practiced_at;
          if (!lastPracticed) return false;
          const itemDate = new Date(lastPracticed);
          itemDate.setHours(0, 0, 0, 0);
          return itemDate.getTime() === today.getTime();
        });
        this.todayProgress = todayItems.length;

        // Weekly progress
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const weeklyItems = flatItems.filter((item) => {
          const lastPracticed = item.last_practiced_at;
          return lastPracticed && lastPracticed >= weekStart;
        });
        this.weeklyCompleted = weeklyItems.length;

        // Streak calculation (simplified)
        this.streakDays = this.calculateStreak(flatItems);
      });
  }

  private calculateStreak(items: TrainingItem[]): number {
    const practiseDates = items
      .filter((item) => item.last_practiced_at)
      .map((item) => {
        const date = new Date(item.last_practiced_at!);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
      })
      .filter((date, index, array) => array.indexOf(date) === index)
      .sort((a, b) => b - a);

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (const practiseDate of practiseDates) {
      if (practiseDate === currentDate.getTime()) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  // UI Methods
  startEditingProfile(): void {
    this.isEditingProfile = true;
  }

  saveProfile(): void {
    if (!this.currentUser) return;

    this.supabase
      .updateUserProfile({
        my_why: this.editProfile.my_why,
        about_me: this.editProfile.about_me,
        current_hard_skill: this.editProfile.current_hard_skill,
        current_soft_skill: this.editProfile.current_soft_skill,
      })
      .subscribe((updatedUser) => {
        if (updatedUser) {
          this.isEditingProfile = false;
          this.currentUser = updatedUser;
        }
      });
  }

  cancelEditProfile(): void {
    if (this.currentUser) {
      this.editProfile = {
        my_why: this.currentUser.my_why || '',
        about_me: this.currentUser.about_me || '',
        current_hard_skill: this.currentUser.current_hard_skill || '',
        current_soft_skill: this.currentUser.current_soft_skill || '',
      };
    }
    this.isEditingProfile = false;
  }

  quickPractice(): void {
    // Navigate to a random in-progress training item
    this.trainingService.getTrainingItems(this.currentUser?.id).subscribe((items) => {
      const flatItems = this.flattenTrainingItems(items);
      const inProgressItems = flatItems.filter(
        (item) => item.status === TrainingStatus.IN_PROGRESS
      );

      if (inProgressItems.length > 0) {
        const randomItem = inProgressItems[Math.floor(Math.random() * inProgressItems.length)];
        // TODO: Navigate to practice page with this item
        console.log('Starting quick practice with:', randomItem.title);
      }
    });
  }

  onSkillCardClick(skill: TrainingItem): void {
    // TODO: Navigate to detailed skill view
    console.log('Skill card clicked:', skill.title);
  }

  onProgressUpdate(item: TrainingItem, newProgress: number): void {
    this.trainingService.updateProgress(item.id, newProgress).subscribe((updatedItem) => {
      if (updatedItem) {
        // Refresh dashboard data
        if (this.currentUser) {
          this.loadDashboardData(this.currentUser);
        }
      }
    });
  }

  getLastPracticeText(activity: TrainingItem): string {
    if (!activity.last_practiced_at) {
      return 'Never practiced';
    }

    const now = new Date();
    const lastPractice = new Date(activity.last_practiced_at);
    const diffMs = now.getTime() - lastPractice.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return lastPractice.toLocaleDateString();
    }
  }
}
