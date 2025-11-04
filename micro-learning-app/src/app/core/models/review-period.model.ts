export interface IReviewPeriod {
  id: string;
  user_id: string;
  year: number;
  period_number: number; // 1 or 2 (for 6-month periods)
  start_date: Date;
  end_date: Date;
  status: ReviewStatus;

  // Goals and focus
  hard_skill_focus: string;
  soft_skill_focus: string;
  goals: string[];

  // Completion metrics
  total_items: number;
  completed_items: number;
  total_estimated_minutes: number;
  actual_minutes_spent: number;

  // Review outcomes
  review_completed_at?: Date;
  self_assessment_score?: number; // 1-10
  team_lead_assessment_score?: number; // 1-10
  strengths_identified: string[];
  areas_for_improvement: string[];
  next_period_recommendations: string[];

  created_at: Date;
  updated_at: Date;
}

export enum ReviewStatus {
  PLANNING = 'planning',
  IN_PROGRESS = 'in_progress',
  REVIEW_PENDING = 'review_pending',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export interface IYearlyRecord {
  id: string;
  user_id: string;
  year: number;

  // Aggregated metrics
  total_training_items: number;
  completed_training_items: number;
  total_learning_hours: number;

  // Skills developed
  hard_skills_developed: string[];
  soft_skills_developed: string[];

  // Annual review
  annual_review_completed_at?: Date;
  overall_performance_score?: number; // 1-10
  career_progression_notes: string[];

  created_at: Date;
  updated_at: Date;
}

export class ReviewPeriod implements IReviewPeriod {
  id: string;
  user_id: string;
  year: number;
  period_number: number;
  start_date: Date;
  end_date: Date;
  status: ReviewStatus;
  hard_skill_focus: string;
  soft_skill_focus: string;
  goals: string[];
  total_items: number;
  completed_items: number;
  total_estimated_minutes: number;
  actual_minutes_spent: number;
  review_completed_at?: Date;
  self_assessment_score?: number;
  team_lead_assessment_score?: number;
  strengths_identified: string[];
  areas_for_improvement: string[];
  next_period_recommendations: string[];
  created_at: Date;
  updated_at: Date;

  constructor(data: Partial<IReviewPeriod>) {
    this.id = data.id || this.generateId();
    this.user_id = data.user_id || '';
    this.year = data.year || new Date().getFullYear();
    this.period_number = data.period_number || 1;

    // Calculate start and end dates based on year and period
    if (data.start_date && data.end_date) {
      this.start_date = data.start_date;
      this.end_date = data.end_date;
    } else {
      const dates = this.calculatePeriodDates(this.year, this.period_number);
      this.start_date = dates.start;
      this.end_date = dates.end;
    }

    this.status = data.status || ReviewStatus.PLANNING;
    this.hard_skill_focus = data.hard_skill_focus || '';
    this.soft_skill_focus = data.soft_skill_focus || '';
    this.goals = data.goals || [];
    this.total_items = data.total_items || 0;
    this.completed_items = data.completed_items || 0;
    this.total_estimated_minutes = data.total_estimated_minutes || 0;
    this.actual_minutes_spent = data.actual_minutes_spent || 0;
    this.review_completed_at = data.review_completed_at;
    this.self_assessment_score = data.self_assessment_score;
    this.team_lead_assessment_score = data.team_lead_assessment_score;
    this.strengths_identified = data.strengths_identified || [];
    this.areas_for_improvement = data.areas_for_improvement || [];
    this.next_period_recommendations = data.next_period_recommendations || [];
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
  }

  private generateId(): string {
    return 'review_' + Math.random().toString(36).substr(2, 9);
  }

  private calculatePeriodDates(year: number, period: number): { start: Date; end: Date } {
    if (period === 1) {
      return {
        start: new Date(year, 0, 1), // January 1st
        end: new Date(year, 5, 30), // June 30th
      };
    } else {
      return {
        start: new Date(year, 6, 1), // July 1st
        end: new Date(year, 11, 31), // December 31st
      };
    }
  }

  getCompletionPercentage(): number {
    return this.total_items > 0 ? (this.completed_items / this.total_items) * 100 : 0;
  }

  getTimeEfficiency(): number {
    return this.total_estimated_minutes > 0
      ? (this.actual_minutes_spent / this.total_estimated_minutes) * 100
      : 0;
  }

  isActive(): boolean {
    const now = new Date();
    return now >= this.start_date && now <= this.end_date;
  }

  daysUntilEnd(): number {
    const now = new Date();
    const diffTime = this.end_date.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  canStartReview(): boolean {
    return this.status === ReviewStatus.IN_PROGRESS && new Date() >= this.end_date;
  }
}

export class YearlyRecord implements IYearlyRecord {
  id: string;
  user_id: string;
  year: number;
  total_training_items: number;
  completed_training_items: number;
  total_learning_hours: number;
  hard_skills_developed: string[];
  soft_skills_developed: string[];
  annual_review_completed_at?: Date;
  overall_performance_score?: number;
  career_progression_notes: string[];
  created_at: Date;
  updated_at: Date;

  constructor(data: Partial<IYearlyRecord>) {
    this.id = data.id || this.generateId();
    this.user_id = data.user_id || '';
    this.year = data.year || new Date().getFullYear();
    this.total_training_items = data.total_training_items || 0;
    this.completed_training_items = data.completed_training_items || 0;
    this.total_learning_hours = data.total_learning_hours || 0;
    this.hard_skills_developed = data.hard_skills_developed || [];
    this.soft_skills_developed = data.soft_skills_developed || [];
    this.annual_review_completed_at = data.annual_review_completed_at;
    this.overall_performance_score = data.overall_performance_score;
    this.career_progression_notes = data.career_progression_notes || [];
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
  }

  private generateId(): string {
    return 'yearly_' + Math.random().toString(36).substr(2, 9);
  }

  getCompletionRate(): number {
    return this.total_training_items > 0
      ? (this.completed_training_items / this.total_training_items) * 100
      : 0;
  }

  getTotalSkillsDeveloped(): number {
    return this.hard_skills_developed.length + this.soft_skills_developed.length;
  }
}
