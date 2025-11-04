import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  RoadmapImport as RoadmapImportService,
  RoadmapData,
  ImportResult,
} from '../../core/services/roadmap-import';
import { TrainingService } from '../../core/services/training.service';
import { TrainingItem } from '../../core/models/training-item.model';
import { SupabaseService } from '../../core/services/supabase.service';
import { finalize, switchMap } from 'rxjs/operators';

interface ImportState {
  isLoading: boolean;
  selectedRoadmap: string | null;
  importMode: 'roadmap' | 'speckit-csv' | 'speckit-json' | 'generic-csv';
  csvContent: string;
  jsonContent: string;
  lastResult: ImportResult | null;
  showSampleData: boolean;
}

@Component({
  selector: 'app-roadmap-import',
  imports: [CommonModule, FormsModule],
  templateUrl: './roadmap-import.html',
  styleUrl: './roadmap-import.scss',
})
export class RoadmapImport {
  private roadmapImportService = inject(RoadmapImportService);
  private trainingService = inject(TrainingService);
  private supabaseService = inject(SupabaseService);

  // Signals for reactive state
  availableRoadmaps = signal<RoadmapData[]>([]);
  importState = signal<ImportState>({
    isLoading: false,
    selectedRoadmap: null,
    importMode: 'roadmap',
    csvContent: '',
    jsonContent: '',
    lastResult: null,
    showSampleData: false,
  });

  ngOnInit() {
    this.loadAvailableRoadmaps();
  }

  loadAvailableRoadmaps() {
    this.roadmapImportService.getAvailableRoadmaps().subscribe({
      next: (roadmaps) => {
        this.availableRoadmaps.set(roadmaps);
      },
      error: (error) => {
        console.error('Failed to load roadmaps:', error);
      },
    });
  }

  selectImportMode(mode: 'roadmap' | 'speckit-csv' | 'speckit-json' | 'generic-csv') {
    this.importState.update((state) => ({
      ...state,
      importMode: mode,
      selectedRoadmap: null,
      csvContent: '',
      jsonContent: '',
      lastResult: null,
      showSampleData: false,
    }));
  }

  selectRoadmap(roadmapId: string) {
    this.importState.update((state) => ({
      ...state,
      selectedRoadmap: roadmapId,
    }));
  }

  importSelectedRoadmap() {
    const state = this.importState();
    if (!state.selectedRoadmap) return;

    const user = this.supabaseService.currentUser;
    if (!user) {
      console.error('User not authenticated');
      return;
    }

    this.importState.update((s) => ({ ...s, isLoading: true }));

    const selectedRoadmap = this.availableRoadmaps().find((r) => r.id === state.selectedRoadmap);
    const title = selectedRoadmap?.title;

    this.roadmapImportService
      .importRoadmap(state.selectedRoadmap, user.id, title)
      .pipe(
        switchMap((result) => {
          if (result.success && result.rootItem) {
            // Save to database
            return this.trainingService.createTrainingItem(result.rootItem).pipe(
              switchMap(() => {
                // Save all children recursively
                return this.saveChildrenRecursively(result.rootItem!.children || []);
              })
            );
          } else {
            throw new Error('Import failed: ' + result.errors.join(', '));
          }
        }),
        finalize(() => {
          this.importState.update((s) => ({ ...s, isLoading: false }));
        })
      )
      .subscribe({
        next: () => {
          this.importState.update((s) => ({
            ...s,
            lastResult: {
              success: true,
              itemsImported: 1,
              errors: [],
              rootItem: undefined,
            },
          }));
          // Refresh training items in the training service
          this.trainingService.refreshTrainingItems();
        },
        error: (error) => {
          console.error('Import failed:', error);
          this.importState.update((s) => ({
            ...s,
            lastResult: {
              success: false,
              itemsImported: 0,
              errors: [error.message],
              rootItem: undefined,
            },
          }));
        },
      });
  }

  importFromCSV() {
    const state = this.importState();
    if (!state.csvContent.trim()) return;

    const user = this.supabaseService.currentUser;
    if (!user) {
      console.error('User not authenticated');
      return;
    }

    this.importState.update((s) => ({ ...s, isLoading: true }));

    this.roadmapImportService
      .importFromCSV(state.csvContent, user.id)
      .pipe(
        finalize(() => {
          this.importState.update((s) => ({ ...s, isLoading: false }));
        })
      )
      .subscribe({
        next: (result) => {
          this.importState.update((s) => ({ ...s, lastResult: result }));
          if (result.success) {
            // Refresh training items
            this.trainingService.refreshTrainingItems();
          }
        },
        error: (error) => {
          console.error('CSV import failed:', error);
          this.importState.update((s) => ({
            ...s,
            lastResult: {
              success: false,
              itemsImported: 0,
              errors: [error.message],
              rootItem: undefined,
            },
          }));
        },
      });
  }

  onFileSelected(event: Event, type: 'csv' | 'json') {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        this.importState.update((state) => ({
          ...state,
          [type + 'Content']: content,
        }));
      };
      reader.readAsText(file);
    }
  }

  private saveChildrenRecursively(children: any[]): any {
    if (!children || children.length === 0) {
      return Promise.resolve();
    }

    const savePromises = children.map((child) =>
      this.trainingService
        .createTrainingItem(child)
        .pipe(switchMap(() => this.saveChildrenRecursively(child.children || [])))
    );

    return Promise.all(savePromises);
  }

  clearResults() {
    this.importState.update((s) => ({ ...s, lastResult: null }));
  }

  clearCSVContent() {
    this.importState.update((s) => ({ ...s, csvContent: '' }));
  }

  clearJSONContent() {
    this.importState.update((s) => ({ ...s, jsonContent: '' }));
  }

  toggleSampleData() {
    this.importState.update((s) => ({ ...s, showSampleData: !s.showSampleData }));
  }

  loadSampleCSV() {
    const sampleCSV = this.roadmapImportService.generateSampleSpeckitCSV();
    this.importState.update((s) => ({ ...s, csvContent: sampleCSV }));
  }

  loadSampleJSON() {
    const sampleJSON = this.roadmapImportService.generateSampleSpeckitJSON();
    this.importState.update((s) => ({
      ...s,
      jsonContent: JSON.stringify(sampleJSON, null, 2),
    }));
  }

  importSpeckitCSV() {
    const state = this.importState();
    const user = this.supabaseService.currentUser;

    if (!state.csvContent || !user) {
      return;
    }

    this.importState.update((s) => ({ ...s, isLoading: true }));

    this.roadmapImportService
      .importFromSpeckitCSV(state.csvContent, user.id)
      .pipe(
        finalize(() => {
          this.importState.update((s) => ({ ...s, isLoading: false }));
        })
      )
      .subscribe({
        next: (result) => {
          this.importState.update((s) => ({ ...s, lastResult: result }));
          if (result.success && result.rootItem) {
            this.saveTrainingItem(result.rootItem);
          }
        },
        error: (error) => {
          console.error('Failed to import CSV:', error);
          this.importState.update((s) => ({
            ...s,
            lastResult: {
              success: false,
              itemsImported: 0,
              errors: [error.message || 'Unknown error during CSV import'],
            },
          }));
        },
      });
  }

  importSpeckitJSON() {
    const state = this.importState();
    const user = this.supabaseService.currentUser;

    if (!state.jsonContent || !user) {
      return;
    }

    try {
      const jsonData = JSON.parse(state.jsonContent);
      this.importState.update((s) => ({ ...s, isLoading: true }));

      this.roadmapImportService
        .importFromSpeckitJSON(jsonData, user.id)
        .pipe(
          finalize(() => {
            this.importState.update((s) => ({ ...s, isLoading: false }));
          })
        )
        .subscribe({
          next: (result) => {
            this.importState.update((s) => ({ ...s, lastResult: result }));
            if (result.success && result.rootItem) {
              this.saveTrainingItem(result.rootItem);
            }
          },
          error: (error) => {
            console.error('Failed to import JSON:', error);
            this.importState.update((s) => ({
              ...s,
              lastResult: {
                success: false,
                itemsImported: 0,
                errors: [error.message || 'Unknown error during JSON import'],
              },
            }));
          },
        });
    } catch (error) {
      this.importState.update((s) => ({
        ...s,
        lastResult: {
          success: false,
          itemsImported: 0,
          errors: ['Invalid JSON format'],
        },
      }));
    }
  }

  executeImport() {
    const state = this.importState();

    switch (state.importMode) {
      case 'roadmap':
        this.importSelectedRoadmap();
        break;
      case 'speckit-csv':
      case 'generic-csv':
        this.importSpeckitCSV();
        break;
      case 'speckit-json':
        this.importSpeckitJSON();
        break;
    }
  }

  private saveTrainingItem(item: TrainingItem) {
    this.trainingService.createTrainingItem(item).subscribe({
      next: (savedItem) => {
        console.log('Training item saved:', savedItem);
        // Navigate to the new item or show success message
      },
      error: (error) => {
        console.error('Failed to save training item:', error);
        this.importState.update((s) => ({
          ...s,
          lastResult: {
            success: false,
            itemsImported: 0,
            errors: ['Failed to save imported content to database'],
          },
        }));
      },
    });
  }
}
