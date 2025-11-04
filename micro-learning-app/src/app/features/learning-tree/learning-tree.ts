import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TrainingService } from '../../core/services/training.service';
import {
  TrainingItem,
  SkillCategory,
  SkillType,
  DifficultyLevel,
  TrainingStatus,
  TrainingSource,
} from '../../core/models/training-item.model';
import { Subject, takeUntil } from 'rxjs';

interface TreeNode {
  item: TrainingItem;
  isExpanded: boolean;
  isEditing: boolean;
  children: TreeNode[];
  parent: TreeNode | null;
  depth: number;
}

interface TreeState {
  rootNodes: TreeNode[];
  selectedNode: TreeNode | null;
  draggedNode: TreeNode | null;
  searchQuery: string;
  showCompleted: boolean;
  filterByCategory: SkillCategory | null;
}

@Component({
  selector: 'app-learning-tree',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './learning-tree.html',
  styleUrl: './learning-tree.scss',
})
export class LearningTree implements OnInit, OnDestroy {
  private trainingService = inject(TrainingService);
  private destroy$ = new Subject<void>();

  // Expose enums for template
  readonly SkillCategory = SkillCategory;
  readonly SkillType = SkillType;
  readonly DifficultyLevel = DifficultyLevel;
  readonly TrainingStatus = TrainingStatus;

  // Tree state management
  treeState = signal<TreeState>({
    rootNodes: [],
    selectedNode: null,
    draggedNode: null,
    searchQuery: '',
    showCompleted: true,
    filterByCategory: null,
  });

  // New item form
  newItemForm = signal({
    title: '',
    description: '',
    category: SkillCategory.TECHNICAL,
    skillType: SkillType.HARD_SKILL,
    difficultyLevel: DifficultyLevel.BEGINNER,
    estimatedMinutes: 60,
    parentId: null as string | null,
  });

  ngOnInit() {
    this.loadTrainingItems();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadTrainingItems() {
    this.trainingService.trainingItems$.pipe(takeUntil(this.destroy$)).subscribe((items) => {
      const treeNodes = this.buildTreeStructure(items);
      this.treeState.update((state) => ({
        ...state,
        rootNodes: treeNodes,
      }));
    });
  }

  private buildTreeStructure(items: TrainingItem[]): TreeNode[] {
    const nodeMap = new Map<string, TreeNode>();
    const rootNodes: TreeNode[] = [];

    // Create nodes for all items
    items.forEach((item) => {
      const node: TreeNode = {
        item,
        isExpanded: false,
        isEditing: false,
        children: [],
        parent: null,
        depth: 0,
      };
      nodeMap.set(item.id, node);
    });

    // Build parent-child relationships
    items.forEach((item) => {
      const node = nodeMap.get(item.id);
      if (!node) return;

      if (item.parent_id) {
        const parent = nodeMap.get(item.parent_id);
        if (parent) {
          node.parent = parent;
          node.depth = parent.depth + 1;
          parent.children.push(node);
          // Sort children by order_index
          parent.children.sort((a, b) => a.item.order_index - b.item.order_index);
        }
      } else {
        rootNodes.push(node);
      }
    });

    // Sort root nodes by order_index
    rootNodes.sort((a, b) => a.item.order_index - b.item.order_index);
    return rootNodes;
  }

  toggleExpanded(node: TreeNode) {
    node.isExpanded = !node.isExpanded;
  }

  selectNode(node: TreeNode) {
    this.treeState.update((state) => ({
      ...state,
      selectedNode: state.selectedNode === node ? null : node,
    }));
  }

  startEditing(node: TreeNode) {
    node.isEditing = true;
  }

  cancelEditing(node: TreeNode) {
    node.isEditing = false;
  }

  saveNode(node: TreeNode, formData: any) {
    const updates = {
      title: formData.title,
      description: formData.description,
      category: formData.category,
      skill_type: formData.skillType,
      difficulty_level: formData.difficultyLevel,
      estimated_duration_minutes: formData.estimatedMinutes,
      updated_at: new Date(),
    };

    this.trainingService.updateTrainingItem(node.item.id, updates).subscribe({
      next: (updatedItem) => {
        if (updatedItem) {
          Object.assign(node.item, updates);
        }
        node.isEditing = false;
      },
      error: (error) => {
        console.error('Failed to update item:', error);
      },
    });
  }

  deleteNode(node: TreeNode) {
    if (!confirm(`Are you sure you want to delete "${node.item.title}" and all its children?`)) {
      return;
    }

    this.trainingService.deleteTrainingItem(node.item.id).subscribe({
      next: () => {
        // Remove from parent's children or root nodes
        if (node.parent) {
          const index = node.parent.children.indexOf(node);
          if (index > -1) {
            node.parent.children.splice(index, 1);
          }
        } else {
          this.treeState.update((state) => ({
            ...state,
            rootNodes: state.rootNodes.filter((n) => n !== node),
          }));
        }
      },
      error: (error) => {
        console.error('Failed to delete item:', error);
      },
    });
  }

  addChildNode(parentNode: TreeNode) {
    this.newItemForm.update((form) => ({
      ...form,
      parentId: parentNode.item.id,
    }));
  }

  addRootNode() {
    this.newItemForm.update((form) => ({
      ...form,
      parentId: null,
    }));
  }

  createNewItem() {
    const form = this.newItemForm();
    if (!form.title.trim()) return;

    const newItem = new TrainingItem({
      title: form.title,
      description: form.description,
      category: form.category,
      skill_type: form.skillType,
      difficulty_level: form.difficultyLevel,
      estimated_duration_minutes: form.estimatedMinutes,
      user_id: '', // Will be set by service
      parent_id: form.parentId || undefined,
      level: form.parentId ? 1 : 0, // Will be calculated properly
      order_index: 0, // Will be calculated properly
      status: TrainingStatus.NOT_STARTED,
      progress_percentage: 0,
      source: TrainingSource.MANUAL,
      tags: [],
    });

    this.trainingService.createTrainingItem(newItem).subscribe({
      next: (createdItem) => {
        // Reset form
        this.newItemForm.set({
          title: '',
          description: '',
          category: SkillCategory.TECHNICAL,
          skillType: SkillType.HARD_SKILL,
          difficultyLevel: DifficultyLevel.BEGINNER,
          estimatedMinutes: 60,
          parentId: null,
        });
        // Tree will be updated automatically via subscription
      },
      error: (error) => {
        console.error('Failed to create item:', error);
      },
    });
  }

  updateProgress(node: TreeNode, progress: number) {
    node.item.updateProgress(progress);

    this.trainingService
      .updateTrainingItem(node.item.id, {
        progress_percentage: progress,
        status: node.item.status,
        last_practiced_at: node.item.last_practiced_at,
        completed_at: node.item.completed_at,
        updated_at: new Date(),
      })
      .subscribe({
        next: () => {
          // Progress updated successfully
        },
        error: (error) => {
          console.error('Failed to update progress:', error);
        },
      });
  }

  // Drag and drop functionality
  onDragStart(event: DragEvent, node: TreeNode) {
    event.dataTransfer?.setData('text/plain', node.item.id);
    this.treeState.update((state) => ({
      ...state,
      draggedNode: node,
    }));
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  onDrop(event: DragEvent, targetNode: TreeNode) {
    event.preventDefault();
    const draggedNode = this.treeState().draggedNode;
    if (!draggedNode || draggedNode === targetNode) return;

    // Prevent dropping a parent onto its own child
    if (this.isDescendant(targetNode, draggedNode)) return;

    // Update the dragged item's parent
    const updates = {
      parent_id: targetNode.item.id,
      level: targetNode.depth + 1,
      updated_at: new Date(),
    };

    this.trainingService.updateTrainingItem(draggedNode.item.id, updates).subscribe({
      next: () => {
        // Tree will be rebuilt automatically
        this.treeState.update((state) => ({
          ...state,
          draggedNode: null,
        }));
      },
      error: (error) => {
        console.error('Failed to move item:', error);
      },
    });
  }

  private isDescendant(node: TreeNode, ancestor: TreeNode): boolean {
    let current = node.parent;
    while (current) {
      if (current === ancestor) return true;
      current = current.parent;
    }
    return false;
  }

  // Filtering functionality
  updateSearchQuery(query: string) {
    this.treeState.update((state) => ({
      ...state,
      searchQuery: query,
    }));
  }

  toggleShowCompleted() {
    this.treeState.update((state) => ({
      ...state,
      showCompleted: !state.showCompleted,
    }));
  }

  setFilterCategory(category: SkillCategory | null) {
    this.treeState.update((state) => ({
      ...state,
      filterByCategory: category,
    }));
  }

  // Check if node should be visible based on filters
  isNodeVisible(node: TreeNode): boolean {
    const state = this.treeState();

    // Check completion filter
    if (!state.showCompleted && node.item.isCompleted()) {
      return false;
    }

    // Check category filter
    if (state.filterByCategory && node.item.category !== state.filterByCategory) {
      return false;
    }

    // Check search query
    if (state.searchQuery.trim()) {
      const query = state.searchQuery.toLowerCase();
      const matchesTitle = node.item.title.toLowerCase().includes(query);
      const matchesDescription = node.item.description?.toLowerCase().includes(query) || false;
      const matchesTags = node.item.tags.some((tag) => tag.toLowerCase().includes(query));

      if (!matchesTitle && !matchesDescription && !matchesTags) {
        return false;
      }
    }

    return true;
  }

  getProgressBarWidth(progress: number): string {
    return `${Math.min(100, Math.max(0, progress))}%`;
  }

  getStatusColor(status: TrainingStatus): string {
    switch (status) {
      case TrainingStatus.COMPLETED:
        return '#28a745';
      case TrainingStatus.IN_PROGRESS:
        return '#007bff';
      case TrainingStatus.PAUSED:
        return '#ffc107';
      case TrainingStatus.ARCHIVED:
        return '#6c757d';
      default:
        return '#dee2e6';
    }
  }

  getCategoryIcon(category: SkillCategory): string {
    switch (category) {
      case SkillCategory.TECHNICAL:
        return '💻';
      case SkillCategory.LEADERSHIP:
        return '👑';
      case SkillCategory.COMMUNICATION:
        return '💬';
      case SkillCategory.PROBLEM_SOLVING:
        return '🧩';
      case SkillCategory.CREATIVITY:
        return '🎨';
      case SkillCategory.PROJECT_MANAGEMENT:
        return '📋';
      case SkillCategory.COLLABORATION:
        return '🤝';
      case SkillCategory.LEARNING:
        return '📚';
      default:
        return '📁';
    }
  }

  closeNewItemForm() {
    this.newItemForm.set({
      title: '',
      description: '',
      category: SkillCategory.TECHNICAL,
      skillType: SkillType.HARD_SKILL,
      difficultyLevel: DifficultyLevel.BEGINNER,
      estimatedMinutes: 60,
      parentId: null,
    });
  }
}
