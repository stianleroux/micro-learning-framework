export interface ITeamComment {
  id: string;
  training_item_id?: string;
  user_id?: string; // The user being commented on
  review_period_id?: string;
  author_id: string; // The person making the comment
  content: string;
  type: CommentType;
  visibility: CommentVisibility;

  // Threading support
  parent_comment_id?: string;

  // Rating/assessment (optional)
  rating?: number; // 1-5 scale

  // Mentions and notifications
  mentioned_user_ids: string[];
  read_by: string[];
  is_private_note: boolean;

  // Metadata
  created_at: Date;
  updated_at: Date;
  is_archived: boolean;
}

export enum CommentType {
  GENERAL = 'general',
  FEEDBACK = 'feedback',
  QUESTION = 'question',
  SUGGESTION = 'suggestion',
  CONCERN = 'concern',
  APPROVAL = 'approval',
  MILESTONE = 'milestone',
}

export enum CommentVisibility {
  PRIVATE = 'private', // Only author can see
  TEAM = 'team', // Team members can see
  PUBLIC = 'public', // All users can see
}

export interface IRoadmap {
  id: string;
  title: string;
  description?: string;
  category: string;
  difficulty_level: string;
  estimated_weeks: number;

  // Source information
  source: RoadmapSource;
  source_url?: string;
  source_id?: string; // External ID from roadmap.sh or other sources

  // Content
  items: IRoadmapItem[];

  // Metadata
  created_at: Date;
  updated_at: Date;
  is_public: boolean;
  created_by?: string; // User ID if custom roadmap
}

export interface IRoadmapItem {
  id: string;
  roadmap_id: string;
  title: string;
  description?: string;
  category: string;
  level: number; // Tree depth
  order_index: number;
  parent_id?: string;

  // Learning details
  estimated_hours: number;
  learning_resources: ILearningResource[];
  prerequisites: string[];
  skills_gained: string[];

  // Import helpers
  children?: IRoadmapItem[];
}

export interface ILearningResource {
  title: string;
  url: string;
  type: ResourceType;
  is_free: boolean;
  estimated_minutes?: number;
}

export enum RoadmapSource {
  ROADMAP_SH = 'roadmap_sh',
  CUSTOM = 'custom',
  IMPORTED = 'imported',
  TEMPLATE = 'template',
}

export enum ResourceType {
  ARTICLE = 'article',
  VIDEO = 'video',
  COURSE = 'course',
  BOOK = 'book',
  DOCUMENTATION = 'documentation',
  TUTORIAL = 'tutorial',
  PRACTICE = 'practice',
  PROJECT = 'project',
}

export class TeamComment implements ITeamComment {
  id: string;
  training_item_id?: string;
  user_id?: string;
  review_period_id?: string;
  author_id: string;
  content: string;
  type: CommentType;
  visibility: CommentVisibility;
  parent_comment_id?: string;
  rating?: number;
  mentioned_user_ids: string[];
  read_by: string[];
  is_private_note: boolean;
  created_at: Date;
  updated_at: Date;
  is_archived: boolean;

  constructor(data: Partial<ITeamComment>) {
    this.id = data.id || this.generateId();
    this.training_item_id = data.training_item_id;
    this.user_id = data.user_id;
    this.review_period_id = data.review_period_id;
    this.author_id = data.author_id || '';
    this.content = data.content || '';
    this.type = data.type || CommentType.GENERAL;
    this.visibility = data.visibility || CommentVisibility.TEAM;
    this.parent_comment_id = data.parent_comment_id;
    this.rating = data.rating;
    this.mentioned_user_ids = data.mentioned_user_ids || [];
    this.read_by = data.read_by || [];
    this.is_private_note = data.is_private_note || false;
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
    this.is_archived = data.is_archived || false;
  }

  private generateId(): string {
    return 'comment_' + Math.random().toString(36).substr(2, 9);
  }

  canBeViewedBy(userId: string, isTeamLead: boolean): boolean {
    switch (this.visibility) {
      case CommentVisibility.PRIVATE:
        return userId === this.author_id;
      case CommentVisibility.TEAM:
        return userId === this.user_id || userId === this.author_id || isTeamLead;
      case CommentVisibility.PUBLIC:
        return true;
      default:
        return false;
    }
  }

  canBeEditedBy(userId: string): boolean {
    return userId === this.author_id;
  }

  isUnreadBy(userId: string): boolean {
    return !this.read_by.includes(userId);
  }

  addMention(userId: string): void {
    if (!this.mentioned_user_ids.includes(userId)) {
      this.mentioned_user_ids.push(userId);
    }
  }

  markReadBy(userId: string): void {
    if (!this.read_by.includes(userId)) {
      this.read_by.push(userId);
    }
  }

  archive(): void {
    this.is_archived = true;
    this.updated_at = new Date();
  }
}

export class Roadmap implements IRoadmap {
  id: string;
  title: string;
  description?: string;
  category: string;
  difficulty_level: string;
  estimated_weeks: number;
  source: RoadmapSource;
  source_url?: string;
  source_id?: string;
  items: IRoadmapItem[];
  created_at: Date;
  updated_at: Date;
  is_public: boolean;
  created_by?: string;

  constructor(data: Partial<IRoadmap>) {
    this.id = data.id || this.generateId();
    this.title = data.title || '';
    this.description = data.description;
    this.category = data.category || '';
    this.difficulty_level = data.difficulty_level || '';
    this.estimated_weeks = data.estimated_weeks || 0;
    this.source = data.source || RoadmapSource.CUSTOM;
    this.source_url = data.source_url;
    this.source_id = data.source_id;
    this.items = data.items || [];
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
    this.is_public = data.is_public || false;
    this.created_by = data.created_by;
  }

  private generateId(): string {
    return 'roadmap_' + Math.random().toString(36).substr(2, 9);
  }

  getTotalItems(): number {
    return this.items.length;
  }

  getTotalEstimatedHours(): number {
    return this.items.reduce((total, item) => total + (item.estimated_hours || 0), 0);
  }

  getItemsByLevel(level: number): IRoadmapItem[] {
    return this.items.filter((item) => item.level === level);
  }

  buildTree(): IRoadmapItem[] {
    const itemMap = new Map<string, IRoadmapItem>();
    const rootItems: IRoadmapItem[] = [];

    // Create a map of all items
    this.items.forEach((item) => {
      itemMap.set(item.id, { ...item, children: [] });
    });

    // Build the tree structure
    this.items.forEach((item) => {
      const itemWithChildren = itemMap.get(item.id)!;

      if (item.parent_id) {
        const parent = itemMap.get(item.parent_id);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(itemWithChildren);
        }
      } else {
        rootItems.push(itemWithChildren);
      }
    });

    // Sort by order_index
    const sortItems = (items: IRoadmapItem[]) => {
      items.sort((a, b) => a.order_index - b.order_index);
      items.forEach((item) => {
        if (item.children) {
          sortItems(item.children);
        }
      });
    };

    sortItems(rootItems);
    return rootItems;
  }
}
