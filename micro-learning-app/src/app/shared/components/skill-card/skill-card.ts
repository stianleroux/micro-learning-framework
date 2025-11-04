import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrainingItem } from '../../../core/models/training-item.model';
import { ProgressBarComponent } from '../progress-bar/progress-bar';

@Component({
  selector: 'app-skill-card',
  imports: [CommonModule, ProgressBarComponent],
  templateUrl: './skill-card.html',
  styleUrl: './skill-card.scss',
})
export class SkillCardComponent {
  @Input() skill!: TrainingItem;
  @Input() showActions = true;
  @Output() skillClick = new EventEmitter<TrainingItem>();
  @Output() practiceClick = new EventEmitter<TrainingItem>();

  onSkillClick(): void {
    this.skillClick.emit(this.skill);
  }

  onPracticeClick(event: Event): void {
    event.stopPropagation();
    this.practiceClick.emit(this.skill);
  }

  getEstimatedTimeText(): string {
    const hours = Math.floor(this.skill.estimated_duration_minutes / 60);
    const minutes = this.skill.estimated_duration_minutes % 60;

    if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
  }

  getLastPracticeText(): string {
    if (!this.skill.last_practiced_at) {
      return 'Never practiced';
    }

    const now = new Date();
    const lastPractice = new Date(this.skill.last_practiced_at);
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
