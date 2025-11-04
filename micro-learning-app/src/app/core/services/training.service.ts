import { Injectable } from '@angular/core';
import { Observable, map, catchError, of, BehaviorSubject } from 'rxjs';
import { SupabaseService } from './supabase.service';
import {
  TrainingItem,
  ITrainingItem,
  TrainingStatus,
  SkillType,
} from '../models/training-item.model';

@Injectable({
  providedIn: 'root',
})
export class TrainingService {
  private trainingItemsSubject = new BehaviorSubject<TrainingItem[]>([]);
  public trainingItems$ = this.trainingItemsSubject.asObservable();

  constructor(private supabase: SupabaseService) {
    this.loadUserTrainingItems();
  }

  private loadUserTrainingItems(): void {
    this.supabase.currentUser$.subscribe((user) => {
      if (user) {
        this.getTrainingItems(user.id).subscribe((items) => {
          this.trainingItemsSubject.next(items);
        });
      } else {
        this.trainingItemsSubject.next([]);
      }
    });
  }

  refreshTrainingItems(): void {
    const currentUser = this.supabase.currentUser;
    if (currentUser) {
      this.getTrainingItems(currentUser.id).subscribe((items) => {
        this.trainingItemsSubject.next(items);
      });
    }
  }

  getTrainingItems(userId?: string): Observable<TrainingItem[]> {
    const filters = userId ? { user_id: userId } : {};

    return this.supabase.select<ITrainingItem>('training_items', '*', filters).pipe(
      map((items) =>
        items.map(
          (item) =>
            new TrainingItem({
              ...item,
              created_at: new Date(item.created_at),
              updated_at: new Date(item.updated_at),
              completed_at: item.completed_at ? new Date(item.completed_at) : undefined,
              last_practiced_at: item.last_practiced_at
                ? new Date(item.last_practiced_at)
                : undefined,
            })
        )
      ),
      map((items) => this.buildTrainingTree(items)),
      catchError((error) => {
        console.error('Error fetching training items:', error);
        return of([]);
      })
    );
  }

  getTrainingItem(id: string): Observable<TrainingItem | null> {
    return this.supabase.select<ITrainingItem>('training_items', '*', { id }).pipe(
      map((items) => {
        if (items.length === 0) return null;
        const item = items[0];
        return new TrainingItem({
          ...item,
          created_at: new Date(item.created_at),
          updated_at: new Date(item.updated_at),
          completed_at: item.completed_at ? new Date(item.completed_at) : undefined,
          last_practiced_at: item.last_practiced_at ? new Date(item.last_practiced_at) : undefined,
        });
      }),
      catchError((error) => {
        console.error('Error fetching training item:', error);
        return of(null);
      })
    );
  }

  createTrainingItem(item: Partial<ITrainingItem>): Observable<TrainingItem | null> {
    const newItem: Partial<ITrainingItem> = {
      ...item,
      created_at: new Date(),
      updated_at: new Date(),
      status: item.status || TrainingStatus.NOT_STARTED,
      progress_percentage: item.progress_percentage || 0,
    };

    return this.supabase.insert<ITrainingItem>('training_items', newItem).pipe(
      map(
        (result) =>
          new TrainingItem({
            ...result,
            created_at: new Date(result.created_at),
            updated_at: new Date(result.updated_at),
            completed_at: result.completed_at ? new Date(result.completed_at) : undefined,
            last_practiced_at: result.last_practiced_at
              ? new Date(result.last_practiced_at)
              : undefined,
          })
      ),
      catchError((error) => {
        console.error('Error creating training item:', error);
        return of(null);
      })
    );
  }

  updateTrainingItem(id: string, updates: Partial<ITrainingItem>): Observable<TrainingItem | null> {
    return this.supabase.update<ITrainingItem>('training_items', id, updates).pipe(
      map(
        (result) =>
          new TrainingItem({
            ...result,
            created_at: new Date(result.created_at),
            updated_at: new Date(result.updated_at),
            completed_at: result.completed_at ? new Date(result.completed_at) : undefined,
            last_practiced_at: result.last_practiced_at
              ? new Date(result.last_practiced_at)
              : undefined,
          })
      ),
      catchError((error) => {
        console.error('Error updating training item:', error);
        return of(null);
      })
    );
  }

  updateProgress(id: string, progressPercentage: number): Observable<TrainingItem | null> {
    const updates: Partial<ITrainingItem> = {
      progress_percentage: Math.max(0, Math.min(100, progressPercentage)),
      last_practiced_at: new Date(),
      updated_at: new Date(),
    };

    // Update status based on progress
    if (progressPercentage >= 100) {
      updates.status = TrainingStatus.COMPLETED;
      updates.completed_at = new Date();
    } else if (progressPercentage > 0) {
      updates.status = TrainingStatus.IN_PROGRESS;
    }

    return this.updateTrainingItem(id, updates);
  }

  deleteTrainingItem(id: string): Observable<boolean> {
    return this.supabase.delete('training_items', id).pipe(
      catchError((error) => {
        console.error('Error deleting training item:', error);
        return of(false);
      })
    );
  }

  // Tree structure helpers
  private buildTrainingTree(items: TrainingItem[]): TrainingItem[] {
    const itemMap = new Map<string, TrainingItem>();
    const rootItems: TrainingItem[] = [];

    // Create a map of all items
    items.forEach((item) => {
      itemMap.set(item.id, item);
    });

    // Build the tree structure
    items.forEach((item) => {
      if (item.parent_id) {
        const parent = itemMap.get(item.parent_id);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(item);
        }
      } else {
        rootItems.push(item);
      }
    });

    // Sort by order_index
    const sortItems = (itemsToSort: TrainingItem[]) => {
      itemsToSort.sort((a, b) => a.order_index - b.order_index);
      itemsToSort.forEach((item) => {
        if (item.children) {
          sortItems(item.children);
        }
      });
    };

    sortItems(rootItems);
    return rootItems;
  }

  moveTrainingItem(
    itemId: string,
    newParentId: string | null,
    newOrderIndex: number
  ): Observable<TrainingItem | null> {
    const updates: Partial<ITrainingItem> = {
      parent_id: newParentId || undefined,
      order_index: newOrderIndex,
      updated_at: new Date(),
    };

    return this.updateTrainingItem(itemId, updates);
  }

  // Analytics and reporting
  getUserStats(userId: string): Observable<{
    totalItems: number;
    completedItems: number;
    inProgressItems: number;
    totalEstimatedHours: number;
    hardSkillsCount: number;
    softSkillsCount: number;
    completionRate: number;
  }> {
    return this.getTrainingItems(userId).pipe(
      map((items) => {
        const flatItems = this.flattenTree(items);
        const completedItems = flatItems.filter((item) => item.isCompleted());
        const inProgressItems = flatItems.filter(
          (item) => item.status === TrainingStatus.IN_PROGRESS
        );
        const hardSkills = flatItems.filter((item) => item.skill_type === SkillType.HARD_SKILL);
        const softSkills = flatItems.filter((item) => item.skill_type === SkillType.SOFT_SKILL);

        return {
          totalItems: flatItems.length,
          completedItems: completedItems.length,
          inProgressItems: inProgressItems.length,
          totalEstimatedHours: flatItems.reduce(
            (total, item) => total + item.estimated_duration_minutes / 60,
            0
          ),
          hardSkillsCount: hardSkills.length,
          softSkillsCount: softSkills.length,
          completionRate:
            flatItems.length > 0 ? (completedItems.length / flatItems.length) * 100 : 0,
        };
      }),
      catchError((error) => {
        console.error('Error calculating user stats:', error);
        return of({
          totalItems: 0,
          completedItems: 0,
          inProgressItems: 0,
          totalEstimatedHours: 0,
          hardSkillsCount: 0,
          softSkillsCount: 0,
          completionRate: 0,
        });
      })
    );
  }

  private flattenTree(items: TrainingItem[]): TrainingItem[] {
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

  // Bulk operations
  importTrainingItems(items: Partial<ITrainingItem>[]): Observable<TrainingItem[]> {
    const createObservables = items.map((item) => this.createTrainingItem(item));

    return new Observable<TrainingItem[]>((observer) => {
      const results: TrainingItem[] = [];
      let completed = 0;

      createObservables.forEach((obs, index) => {
        obs.subscribe({
          next: (result) => {
            if (result) {
              results[index] = result;
            }
            completed++;
            if (completed === createObservables.length) {
              observer.next(results.filter((r) => r !== undefined));
              observer.complete();
            }
          },
          error: (error) => {
            console.error(`Error importing item ${index}:`, error);
            completed++;
            if (completed === createObservables.length) {
              observer.next(results.filter((r) => r !== undefined));
              observer.complete();
            }
          },
        });
      });
    });
  }

  // Real-time updates
  subscribeToTrainingUpdates(userId: string, callback: (item: TrainingItem) => void): () => void {
    return this.supabase.subscribe(
      'training_items',
      (payload) => {
        if (payload.new && payload.new.user_id === userId) {
          const item = new TrainingItem({
            ...payload.new,
            created_at: new Date(payload.new.created_at),
            updated_at: new Date(payload.new.updated_at),
            completed_at: payload.new.completed_at ? new Date(payload.new.completed_at) : undefined,
            last_practiced_at: payload.new.last_practiced_at
              ? new Date(payload.new.last_practiced_at)
              : undefined,
          });
          callback(item);
        }
      },
      { user_id: userId }
    );
  }
}
