import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { IUser, User as AppUser, UserRole } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private currentUserSubject = new BehaviorSubject<AppUser | null>(null);
  private sessionSubject = new BehaviorSubject<Session | null>(null);

  constructor() {
    this.supabase = createClient(environment.supabase.url, environment.supabase.anonKey);

    // Listen for auth changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      this.sessionSubject.next(session);
      if (session?.user) {
        this.loadUserProfile(session.user.id);
      } else {
        this.currentUserSubject.next(null);
      }
    });

    // Initialize session
    this.supabase.auth.getSession().then(({ data: { session } }) => {
      this.sessionSubject.next(session);
      if (session?.user) {
        this.loadUserProfile(session.user.id);
      }
    });
  }

  get currentUser$(): Observable<AppUser | null> {
    return this.currentUserSubject.asObservable();
  }

  get currentUser(): AppUser | null {
    return this.currentUserSubject.value;
  }

  get session$(): Observable<Session | null> {
    return this.sessionSubject.asObservable();
  }

  get isAuthenticated$(): Observable<boolean> {
    return this.session$.pipe(map((session) => !!session));
  }

  // Expose the Supabase client for advanced operations
  get client(): SupabaseClient {
    return this.supabase;
  }

  // Authentication methods
  signUp(
    email: string,
    password: string,
    metadata?: any
  ): Observable<{ user: User | null; error: any }> {
    return from(
      this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      })
    ).pipe(
      tap(({ data, error }) => {
        if (data.user && !error) {
          // Create user profile
          this.createUserProfile(data.user, metadata);
        }
      }),
      map(({ data, error }) => ({ user: data.user, error })),
      catchError((error) => {
        console.error('Sign up error:', error);
        return of({ user: null, error });
      })
    );
  }

  signIn(email: string, password: string): Observable<{ user: User | null; error: any }> {
    return from(
      this.supabase.auth.signInWithPassword({
        email,
        password,
      })
    ).pipe(
      map(({ data, error }) => ({ user: data.user, error })),
      catchError((error) => {
        console.error('Sign in error:', error);
        return of({ user: null, error });
      })
    );
  }

  signInWithProvider(provider: 'github' | 'google'): Observable<{ data: any; error: any }> {
    return from(
      this.supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
    ).pipe(
      catchError((error) => {
        console.error('OAuth sign in error:', error);
        return of({ data: null, error });
      })
    );
  }

  signOut(): Observable<{ error: any }> {
    return from(this.supabase.auth.signOut()).pipe(
      tap(() => {
        this.currentUserSubject.next(null);
      }),
      catchError((error) => {
        console.error('Sign out error:', error);
        return of({ error });
      })
    );
  }

  // User profile methods
  private async createUserProfile(user: User, metadata?: any): Promise<void> {
    try {
      const userProfile: Partial<IUser> = {
        id: user.id,
        email: user.email!,
        full_name: metadata?.full_name || user.user_metadata?.['full_name'],
        avatar_url: user.user_metadata?.['avatar_url'],
        role: UserRole.USER,
        review_period_months: 6,
        notification_preferences: {
          enable_web_push: true,
          enable_email: true,
          lunchtime_reminders: true,
          review_reminders: true,
          preferred_time: '12:00',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };

      const { error } = await this.supabase.from('users').insert([userProfile]);

      if (error) {
        console.error('Error creating user profile:', error);
      } else {
        this.loadUserProfile(user.id);
      }
    } catch (error) {
      console.error('Error creating user profile:', error);
    }
  }

  private async loadUserProfile(userId: string): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error loading user profile:', error);
        return;
      }

      if (data) {
        const appUser = new AppUser({
          ...data,
          created_at: new Date(data.created_at),
          updated_at: new Date(data.updated_at),
        });
        this.currentUserSubject.next(appUser);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  }

  updateUserProfile(updates: Partial<IUser>): Observable<AppUser | null> {
    const currentUser = this.currentUserSubject.value;
    if (!currentUser) {
      return of(null);
    }

    const updatedData = {
      ...updates,
      updated_at: new Date(),
    };

    return from(
      this.supabase.from('users').update(updatedData).eq('id', currentUser.id).select().single()
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          console.error('Error updating user profile:', error);
          return null;
        }

        const updatedUser = new AppUser({
          ...data,
          created_at: new Date(data.created_at),
          updated_at: new Date(data.updated_at),
        });

        this.currentUserSubject.next(updatedUser);
        return updatedUser;
      }),
      catchError((error) => {
        console.error('Error updating user profile:', error);
        return of(null);
      })
    );
  }

  // Generic CRUD operations
  select<T>(table: string, query?: string, filters?: Record<string, any>): Observable<T[]> {
    let queryBuilder = this.supabase.from(table).select(query || '*');

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        queryBuilder = queryBuilder.eq(key, value);
      });
    }

    return from(queryBuilder).pipe(
      map(({ data, error }) => {
        if (error) {
          throw error;
        }
        return data as T[];
      }),
      catchError((error) => {
        console.error(`Error selecting from ${table}:`, error);
        throw error;
      })
    );
  }

  insert<T>(table: string, data: Partial<T>): Observable<T> {
    return from(this.supabase.from(table).insert([data]).select().single()).pipe(
      map(({ data: result, error }) => {
        if (error) {
          throw error;
        }
        return result as T;
      }),
      catchError((error) => {
        console.error(`Error inserting into ${table}:`, error);
        throw error;
      })
    );
  }

  update<T>(table: string, id: string, updates: Partial<T>): Observable<T> {
    return from(
      this.supabase
        .from(table)
        .update({
          ...updates,
          updated_at: new Date(),
        })
        .eq('id', id)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          throw error;
        }
        return data as T;
      }),
      catchError((error) => {
        console.error(`Error updating ${table}:`, error);
        throw error;
      })
    );
  }

  delete(table: string, id: string): Observable<boolean> {
    return from(this.supabase.from(table).delete().eq('id', id)).pipe(
      map(({ error }) => {
        if (error) {
          throw error;
        }
        return true;
      }),
      catchError((error) => {
        console.error(`Error deleting from ${table}:`, error);
        throw error;
      })
    );
  }

  // Real-time subscriptions
  subscribe<T>(
    table: string,
    callback: (payload: any) => void,
    filters?: Record<string, any>
  ): () => void {
    let channel = this.supabase.channel(`public:${table}`).on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: table,
        filter: filters
          ? Object.entries(filters)
              .map(([key, value]) => `${key}=eq.${value}`)
              .join(',')
          : undefined,
      },
      callback
    );

    channel.subscribe();

    return () => {
      this.supabase.removeChannel(channel);
    };
  }

  // File storage
  uploadFile(bucket: string, path: string, file: File): Observable<{ path: string; error: any }> {
    return from(this.supabase.storage.from(bucket).upload(path, file)).pipe(
      map(({ data, error }) => ({
        path: data?.path || '',
        error,
      })),
      catchError((error) => {
        console.error('File upload error:', error);
        return of({ path: '', error });
      })
    );
  }

  getPublicUrl(bucket: string, path: string): string {
    const { data } = this.supabase.storage.from(bucket).getPublicUrl(path);

    return data.publicUrl;
  }
}
