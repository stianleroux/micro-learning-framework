# Code Standards - Micro Learning Framework

## Overview
This document outlines the coding standards for the Micro Learning Framework Angular PWA. These standards ensure maintainability, readability, and consistency across the codebase.

## Naming Conventions

### Files and Folders
- **Components**: `kebab-case` (e.g., `learning-dashboard.component.ts`)
- **Services**: `kebab-case` with `.service` suffix (e.g., `roadmap-import.service.ts`)
- **Models**: `kebab-case` with `.model` suffix (e.g., `training-item.model.ts`)
- **Interfaces**: `kebab-case` with `.interface` suffix (e.g., `user-progress.interface.ts`)
- **Enums**: `kebab-case` with `.enum` suffix (e.g., `skill-level.enum.ts`)
- **Folders**: `kebab-case` (e.g., `shared/components`, `core/services`)

### Code Elements
- **Classes**: `PascalCase` (e.g., `LearningDashboardComponent`, `RoadmapImportService`)
- **Interfaces**: `PascalCase` with `I` prefix (e.g., `IUserProgress`, `ITrainingItem`)
- **Enums**: `PascalCase` (e.g., `SkillLevel`, `ReviewStatus`)
- **Methods/Functions**: `camelCase` (e.g., `updateProgress()`, `importRoadmap()`)
- **Variables**: `camelCase` (e.g., `currentUser`, `trainingItems`)
- **Constants**: `SCREAMING_SNAKE_CASE` (e.g., `DEFAULT_REVIEW_PERIOD`, `MAX_RETRY_ATTEMPTS`)

## File Layout Structure

### Component Structure
```typescript
// 1. Imports (Angular core first, then third-party, then local)
import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { UserService } from '../core/services/user.service';

// 2. Component decorator
@Component({
  selector: 'app-learning-dashboard',
  templateUrl: './learning-dashboard.component.html',
  styleUrls: ['./learning-dashboard.component.scss']
})
// 3. Export class with implements
export class LearningDashboardComponent implements OnInit {
  // 4. Public properties first
  currentUser$: Observable<User>;
  trainingItems: TrainingItem[] = [];
  
  // 5. Private properties
  private readonly destroySubject = new Subject<void>();
  
  // 6. Constructor with dependency injection
  constructor(
    private userService: UserService,
    private trainingService: TrainingService
  ) {}
  
  // 7. Lifecycle hooks
  ngOnInit(): void {
    this.initializeComponent();
  }
  
  ngOnDestroy(): void {
    this.destroySubject.next();
    this.destroySubject.complete();
  }
  
  // 8. Public methods
  onProgressUpdate(item: TrainingItem): void {
    // Implementation
  }
  
  // 9. Private methods
  private initializeComponent(): void {
    // Implementation
  }
}
```

### Service Structure
```typescript
// 1. Imports
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

// 2. Injectable decorator
@Injectable({
  providedIn: 'root'
})
// 3. Export class
export class TrainingService {
  // 4. Private properties
  private readonly apiUrl = environment.supabaseUrl;
  
  // 5. Constructor
  constructor(private supabase: SupabaseClient) {}
  
  // 6. Public methods (CRUD operations first)
  getTrainingItems(): Observable<TrainingItem[]> {
    // Implementation
  }
  
  createTrainingItem(item: TrainingItem): Observable<TrainingItem> {
    // Implementation
  }
  
  // 7. Private utility methods
  private handleError(error: any): Observable<never> {
    // Error handling
  }
}
```

## Error Handling

### Service Layer
```typescript
// Always wrap API calls in try-catch
async getTrainingItems(): Promise<TrainingItem[]> {
  try {
    const { data, error } = await this.supabase
      .from('training_items')
      .select('*');
    
    if (error) {
      throw new Error(`Failed to fetch training items: ${error.message}`);
    }
    
    return data as TrainingItem[];
  } catch (error) {
    this.logger.error('Error fetching training items', error);
    throw error;
  }
}
```

### Component Layer
```typescript
// Handle errors gracefully with user feedback
onSaveProgress(): void {
  this.trainingService.updateProgress(this.currentItem)
    .pipe(
      takeUntil(this.destroySubject),
      catchError(error => {
        this.notificationService.showError('Failed to save progress');
        this.logger.error('Progress save failed', error);
        return EMPTY;
      })
    )
    .subscribe(result => {
      this.notificationService.showSuccess('Progress saved successfully');
    });
}
```

## Logging Standards

### Logger Service
```typescript
@Injectable({ providedIn: 'root' })
export class LoggerService {
  private readonly isDevelopment = !environment.production;
  
  info(message: string, data?: any): void {
    if (this.isDevelopment) {
      console.log(`[INFO] ${message}`, data);
    }
    // Send to monitoring service in production
  }
  
  error(message: string, error?: any): void {
    console.error(`[ERROR] ${message}`, error);
    // Always log errors, send to monitoring service
  }
  
  warn(message: string, data?: any): void {
    console.warn(`[WARN] ${message}`, data);
  }
}
```

## Testing Standards

### Unit Test Structure
```typescript
describe('TrainingService', () => {
  let service: TrainingService;
  let supabaseMock: jasmine.SpyObj<SupabaseClient>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('SupabaseClient', ['from']);
    
    TestBed.configureTestingModule({
      providers: [
        TrainingService,
        { provide: SupabaseClient, useValue: spy }
      ]
    });
    
    service = TestBed.inject(TrainingService);
    supabaseMock = TestBed.inject(SupabaseClient) as jasmine.SpyObj<SupabaseClient>;
  });

  describe('getTrainingItems', () => {
    it('should return training items when successful', async () => {
      // Arrange
      const mockItems = [{ id: '1', title: 'Test Item' }];
      supabaseMock.from.and.returnValue({
        select: () => Promise.resolve({ data: mockItems, error: null })
      } as any);

      // Act
      const result = await service.getTrainingItems();

      // Assert
      expect(result).toEqual(mockItems);
    });
    
    it('should throw error when API fails', async () => {
      // Arrange
      const mockError = { message: 'Network error' };
      supabaseMock.from.and.returnValue({
        select: () => Promise.resolve({ data: null, error: mockError })
      } as any);

      // Act & Assert
      await expectAsync(service.getTrainingItems())
        .toBeRejectedWithError('Failed to fetch training items: Network error');
    });
  });
});
```

## SOLID Principles Summary

### Single Responsibility Principle (SRP)
- Each class/service should have one reason to change
- Components handle UI logic only
- Services handle business logic only
- Models represent data structures only

### Open/Closed Principle (OCP)
- Use interfaces and abstract classes for extensibility
- Implement strategy pattern for different roadmap importers
- Use dependency injection for configurable behaviors

### Liskov Substitution Principle (LSP)
- Derived classes must be substitutable for base classes
- Interfaces should be implemented completely
- Mock objects should behave like real objects in tests

### Interface Segregation Principle (ISP)
- Create focused, specific interfaces
- Don't force classes to implement unused methods
- Split large interfaces into smaller, cohesive ones

### Dependency Inversion Principle (DIP)
- Depend on abstractions, not concretions
- Use Angular DI container
- Inject interfaces, not concrete classes

## DRY (Don't Repeat Yourself)

### Shared Utilities
```typescript
// Create reusable utility functions
export class DateUtils {
  static getNextReviewDate(lastReview: Date, periodMonths: number = 6): Date {
    const next = new Date(lastReview);
    next.setMonth(next.getMonth() + periodMonths);
    return next;
  }
  
  static formatProgressDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}
```

### Shared Components
```typescript
// Reusable progress bar component
@Component({
  selector: 'app-progress-bar',
  template: `
    <div class="progress-container">
      <div class="progress-bar" [style.width.%]="percentage">
        <span class="progress-text">{{percentage}}%</span>
      </div>
    </div>
  `
})
export class ProgressBarComponent {
  @Input() percentage: number = 0;
  @Input() color: string = '#007bff';
}
```

## YAGNI (You Aren't Gonna Need It)

### Guidelines
- Implement features only when requirements are clear
- Avoid over-engineering for "future needs"
- Start with simple localStorage, upgrade to Supabase when needed
- Don't create abstractions until you have 3+ similar implementations
- Remove unused code regularly

### Examples
```typescript
// ❌ Over-engineered (YAGNI violation)
abstract class BaseImporter {
  abstract import(data: any): Observable<any>;
  abstract validate(data: any): boolean;
  abstract transform(data: any): any;
  abstract cleanup(data: any): void;
}

// ✅ Simple, focused (YAGNI compliant)
interface RoadmapImporter {
  import(roadmapData: RoadmapData): Observable<TrainingItem[]>;
}
```

## Atomic Design Principles

### Atoms
- Basic building blocks (buttons, inputs, labels)
- No business logic
- Highly reusable

```typescript
@Component({
  selector: 'app-button',
  template: `
    <button 
      [class]="'btn btn-' + variant" 
      [disabled]="disabled"
      (click)="onClick.emit()">
      <ng-content></ng-content>
    </button>
  `
})
export class ButtonComponent {
  @Input() variant: 'primary' | 'secondary' | 'danger' = 'primary';
  @Input() disabled: boolean = false;
  @Output() onClick = new EventEmitter<void>();
}
```

### Molecules
- Combinations of atoms
- Single responsibility
- Reusable across pages

```typescript
@Component({
  selector: 'app-skill-card',
  template: `
    <div class="skill-card">
      <h3>{{ skill.name }}</h3>
      <app-progress-bar [percentage]="skill.progress"></app-progress-bar>
      <app-button 
        variant="primary" 
        (onClick)="onPractice.emit(skill)">
        Practice
      </app-button>
    </div>
  `
})
export class SkillCardComponent {
  @Input() skill: Skill;
  @Output() onPractice = new EventEmitter<Skill>();
}
```

### Organisms
- Complex UI components
- Contain molecules and atoms
- Specific business logic

```typescript
@Component({
  selector: 'app-skills-grid',
  template: `
    <div class="skills-grid">
      <app-skill-card 
        *ngFor="let skill of skills" 
        [skill]="skill"
        (onPractice)="handlePractice($event)">
      </app-skill-card>
    </div>
  `
})
export class SkillsGridComponent {
  @Input() skills: Skill[] = [];
  
  handlePractice(skill: Skill): void {
    // Business logic for practice session
  }
}
```

### Templates
- Page-level layouts
- Combine organisms
- Handle routing and state

### Pages
- Specific page implementations
- Connect to services
- Handle user interactions

## Enforcement Guidelines

1. **Code Reviews**: All code must pass review before merging
2. **Linting**: ESLint rules enforce naming and structure
3. **Testing**: Minimum 80% code coverage required
4. **Documentation**: All public APIs must have JSDoc comments
5. **Performance**: Bundle analyzer checks for size limits
6. **Accessibility**: WCAG 2.1 AA compliance required

## Tools and Automation

- **ESLint**: Enforce code style and naming conventions
- **Prettier**: Automatic code formatting
- **Husky**: Pre-commit hooks for linting and testing
- **Angular CLI**: Generate components following standards
- **SonarQube**: Code quality and security analysis
- **Bundle Analyzer**: Monitor build size and optimization