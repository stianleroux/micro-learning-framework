export interface IUser {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;

  // Profile information
  my_why?: string;
  about_me?: string;
  current_hard_skill?: string;
  current_soft_skill?: string;

  // Preferences
  notification_preferences: INotificationPreferences;
  review_period_months: number; // Default 6 months
}

export enum UserRole {
  USER = 'user',
  TEAM_LEAD = 'team_lead',
  ADMIN = 'admin',
}

export interface INotificationPreferences {
  enable_web_push: boolean;
  enable_email: boolean;
  lunchtime_reminders: boolean;
  review_reminders: boolean;
  preferred_time: string; // HH:mm format
  timezone: string;
}

export class User implements IUser {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
  my_why?: string;
  about_me?: string;
  current_hard_skill?: string;
  current_soft_skill?: string;
  notification_preferences: INotificationPreferences;
  review_period_months: number;

  constructor(data: Partial<IUser>) {
    this.id = data.id || '';
    this.email = data.email || '';
    this.full_name = data.full_name;
    this.avatar_url = data.avatar_url;
    this.role = data.role || UserRole.USER;
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
    this.my_why = data.my_why;
    this.about_me = data.about_me;
    this.current_hard_skill = data.current_hard_skill;
    this.current_soft_skill = data.current_soft_skill;
    this.review_period_months = data.review_period_months || 6;

    this.notification_preferences = {
      enable_web_push: true,
      enable_email: true,
      lunchtime_reminders: true,
      review_reminders: true,
      preferred_time: '12:00',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...data.notification_preferences,
    };
  }

  getDisplayName(): string {
    return this.full_name || this.email.split('@')[0];
  }

  isTeamLead(): boolean {
    return this.role === UserRole.TEAM_LEAD || this.role === UserRole.ADMIN;
  }
}
