export interface ITrainingItem {
  id: string;
  user_id: string;
  parent_id?: string; // For tree structure
  title: string;
  description?: string;
  category: SkillCategory;
  skill_type: SkillType;
  difficulty_level: DifficultyLevel;
  estimated_duration_minutes: number;

  // Progress tracking
  status: TrainingStatus;
  progress_percentage: number;
  completed_at?: Date;
  last_practiced_at?: Date;

  // Metadata
  source: TrainingSource;
  source_url?: string;
  tags: string[];
  created_at: Date;
  updated_at: Date;

  // Tree structure helpers
  children?: TrainingItem[];
  level: number; // Depth in tree (0 = root)
  order_index: number; // For sorting siblings
}

export enum SkillCategory {
  TECHNICAL = 'technical',
  LEADERSHIP = 'leadership',
  COMMUNICATION = 'communication',
  PROBLEM_SOLVING = 'problem_solving',
  CREATIVITY = 'creativity',
  PROJECT_MANAGEMENT = 'project_management',
  COLLABORATION = 'collaboration',
  LEARNING = 'learning',
}

export enum SkillType {
  HARD_SKILL = 'hard_skill',
  SOFT_SKILL = 'soft_skill',
}

export enum DifficultyLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
}

export enum TrainingStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  PAUSED = 'paused',
  ARCHIVED = 'archived',
}

export enum TrainingSource {
  MANUAL = 'manual',
  ROADMAP_SH = 'roadmap_sh',
  SPECKIT = 'speckit',
  IMPORTED_CSV = 'imported_csv',
  IMPORTED_JSON = 'imported_json',
}

export class TrainingItem implements ITrainingItem {
  id: string;
  user_id: string;
  parent_id?: string;
  title: string;
  description?: string;
  category: SkillCategory;
  skill_type: SkillType;
  difficulty_level: DifficultyLevel;
  estimated_duration_minutes: number;
  status: TrainingStatus;
  progress_percentage: number;
  completed_at?: Date;
  last_practiced_at?: Date;
  source: TrainingSource;
  source_url?: string;
  tags: string[];
  created_at: Date;
  updated_at: Date;
  children?: TrainingItem[];
  level: number;
  order_index: number;

  constructor(data: Partial<ITrainingItem>) {
    this.id = data.id || this.generateId();
    this.user_id = data.user_id || '';
    this.parent_id = data.parent_id;
    this.title = data.title || '';
    this.description = data.description;
    this.category = data.category || SkillCategory.TECHNICAL;
    this.skill_type = data.skill_type || SkillType.HARD_SKILL;
    this.difficulty_level = data.difficulty_level || DifficultyLevel.BEGINNER;
    this.estimated_duration_minutes = data.estimated_duration_minutes || 30;
    this.status = data.status || TrainingStatus.NOT_STARTED;
    this.progress_percentage = data.progress_percentage || 0;
    this.completed_at = data.completed_at;
    this.last_practiced_at = data.last_practiced_at;
    this.source = data.source || TrainingSource.MANUAL;
    this.source_url = data.source_url;
    this.tags = data.tags || [];
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
    this.children = data.children || [];
    this.level = data.level || 0;
    this.order_index = data.order_index || 0;
  }

  private generateId(): string {
    return 'training_' + Math.random().toString(36).substr(2, 9);
  }

  isCompleted(): boolean {
    return this.status === TrainingStatus.COMPLETED || this.progress_percentage >= 100;
  }

  canStartPracticing(): boolean {
    return this.status !== TrainingStatus.COMPLETED && this.status !== TrainingStatus.ARCHIVED;
  }

  updateProgress(percentage: number): void {
    this.progress_percentage = Math.max(0, Math.min(100, percentage));
    this.last_practiced_at = new Date();
    this.updated_at = new Date();

    if (percentage >= 100 && this.status !== TrainingStatus.COMPLETED) {
      this.status = TrainingStatus.COMPLETED;
      this.completed_at = new Date();
    } else if (percentage > 0 && this.status === TrainingStatus.NOT_STARTED) {
      this.status = TrainingStatus.IN_PROGRESS;
    }
  }

  addChild(child: TrainingItem): void {
    child.parent_id = this.id;
    child.level = this.level + 1;
    child.order_index = this.children?.length || 0;
    this.children = this.children || [];
    this.children.push(child);
  }

  removeChild(childId: string): void {
    if (this.children) {
      this.children = this.children.filter((child) => child.id !== childId);
      // Reorder remaining children
      this.children.forEach((child, index) => {
        child.order_index = index;
      });
    }
  }

  getTotalEstimatedTime(): number {
    let total = this.estimated_duration_minutes;
    if (this.children) {
      total += this.children.reduce((sum, child) => sum + child.getTotalEstimatedTime(), 0);
    }
    return total;
  }

  getOverallProgress(): number {
    if (!this.children || this.children.length === 0) {
      return this.progress_percentage;
    }

    const totalWeight = this.children.length + 1; // Include self
    const childrenProgress = this.children.reduce(
      (sum, child) => sum + child.getOverallProgress(),
      0
    );

    return (this.progress_percentage + childrenProgress) / totalWeight;
  }
}
