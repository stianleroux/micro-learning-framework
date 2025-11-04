import { Injectable } from '@angular/core';
import { Observable, catchError, throwError, map, from } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import {
  TrainingItem,
  SkillCategory,
  SkillType,
  DifficultyLevel,
  TrainingStatus,
  TrainingSource,
} from '../models/training-item.model';

export interface RoadmapData {
  id: string;
  title: string;
  description: string;
  url: string;
  roadmapData: any;
}

export interface RoadmapNode {
  id: string;
  title: string;
  description?: string;
  type: 'skill' | 'topic' | 'resource' | 'project';
  level: 'beginner' | 'intermediate' | 'advanced';
  children?: RoadmapNode[];
  links?: string[];
  estimatedHours?: number;
}

export interface ImportResult {
  success: boolean;
  itemsImported: number;
  errors: string[];
  rootItem?: TrainingItem;
}

export interface SpeckitCSVRow {
  topic_title: string;
  concept: string;
  unit_title: string;
  estimated_minutes: number;
  difficulty: string;
  category: string;
  prerequisites?: string;
  learning_resources?: string;
  order_index: number;
  description?: string;
}

export interface SpeckitJSONData {
  topic: {
    title: string;
    description?: string;
    estimatedWeeks?: number;
    skillType: 'hard_skill' | 'soft_skill';
    category: string;
    difficulty: string;
  };
  concepts: Array<{
    name: string;
    description?: string;
    units: Array<{
      title: string;
      description?: string;
      estimatedMinutes: number;
      learningResources?: Array<{
        type: string;
        title: string;
        url?: string;
        duration?: string;
      }>;
      practiceExercises?: Array<{
        title: string;
        description?: string;
        estimatedMinutes?: number;
      }>;
    }>;
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class RoadmapImport {
  private readonly roadmapApiBase = 'https://roadmap.sh/api';
  private readonly githubApiBase =
    'https://api.github.com/repos/kamranahmedse/developer-roadmap/contents';

  constructor(private http: HttpClient) {}

  /**
   * Get list of available roadmaps from roadmap.sh
   */
  getAvailableRoadmaps(): Observable<RoadmapData[]> {
    // Common roadmaps based on roadmap.sh structure
    const roadmaps: RoadmapData[] = [
      {
        id: 'frontend',
        title: 'Frontend Developer',
        description: 'Step by step guide to becoming a modern frontend developer',
        url: 'https://roadmap.sh/frontend',
        roadmapData: null,
      },
      {
        id: 'backend',
        title: 'Backend Developer',
        description: 'Step by step guide to becoming a modern backend developer',
        url: 'https://roadmap.sh/backend',
        roadmapData: null,
      },
      {
        id: 'react',
        title: 'React Developer',
        description: 'Everything you need to learn React',
        url: 'https://roadmap.sh/react',
        roadmapData: null,
      },
      {
        id: 'nodejs',
        title: 'Node.js Developer',
        description: 'Step by step guide to becoming a Node.js developer',
        url: 'https://roadmap.sh/nodejs',
        roadmapData: null,
      },
      {
        id: 'typescript',
        title: 'TypeScript',
        description: 'Learn TypeScript with this interactive roadmap',
        url: 'https://roadmap.sh/typescript',
        roadmapData: null,
      },
      {
        id: 'angular',
        title: 'Angular Developer',
        description: 'Step by step guide to becoming an Angular developer',
        url: 'https://roadmap.sh/angular',
        roadmapData: null,
      },
      {
        id: 'devops',
        title: 'DevOps Engineer',
        description: 'Step by step guide to becoming a DevOps engineer',
        url: 'https://roadmap.sh/devops',
        roadmapData: null,
      },
      {
        id: 'fullstack',
        title: 'Full Stack Developer',
        description: 'Step by step guide to becoming a full stack developer',
        url: 'https://roadmap.sh/full-stack',
        roadmapData: null,
      },
    ];

    return from(Promise.resolve(roadmaps));
  }

  /**
   * Fetch roadmap data from GitHub (fallback method)
   */
  fetchRoadmapFromGitHub(roadmapId: string): Observable<any> {
    const url = `${this.githubApiBase}/src/data/roadmaps/${roadmapId}/${roadmapId}.md`;

    return this.http.get(url).pipe(
      catchError((error) => {
        console.error(`Failed to fetch roadmap ${roadmapId}:`, error);
        return throwError(() => new Error(`Failed to fetch roadmap: ${error.message}`));
      })
    );
  }

  /**
   * Parse roadmap content and convert to our format
   */
  parseRoadmapContent(content: string, roadmapId: string): RoadmapNode[] {
    const lines = content.split('\n');
    const nodes: RoadmapNode[] = [];
    let currentSection: RoadmapNode | null = null;
    let currentSubsection: RoadmapNode | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and metadata
      if (
        !trimmed ||
        trimmed.startsWith('---') ||
        trimmed.startsWith('briefTitle:') ||
        trimmed.startsWith('briefDescription:')
      ) {
        continue;
      }

      // Main sections (## heading)
      if (trimmed.startsWith('## ')) {
        currentSection = {
          id: this.generateId(trimmed.substring(3)),
          title: trimmed.substring(3).trim(),
          type: 'topic',
          level: 'intermediate',
          children: [],
        };
        nodes.push(currentSection);
        currentSubsection = null;
      }
      // Subsections (### heading)
      else if (trimmed.startsWith('### ')) {
        if (currentSection) {
          currentSubsection = {
            id: this.generateId(trimmed.substring(4)),
            title: trimmed.substring(4).trim(),
            type: 'skill',
            level: 'beginner',
            children: [],
          };
          currentSection.children = currentSection.children || [];
          currentSection.children.push(currentSubsection);
        }
      }
      // Skills/topics (- item)
      else if (trimmed.startsWith('- ')) {
        const item: RoadmapNode = {
          id: this.generateId(trimmed.substring(2)),
          title: trimmed.substring(2).trim(),
          type: 'skill',
          level: 'beginner',
          estimatedHours: 2,
        };

        if (currentSubsection) {
          currentSubsection.children = currentSubsection.children || [];
          currentSubsection.children.push(item);
        } else if (currentSection) {
          currentSection.children = currentSection.children || [];
          currentSection.children.push(item);
        } else {
          nodes.push(item);
        }
      }
      // Links and resources
      else if (trimmed.match(/\[.*\]\(.*\)/)) {
        const linkMatch = trimmed.match(/\[(.*?)\]\((.*?)\)/);
        if (linkMatch && (currentSubsection || currentSection)) {
          const target = currentSubsection || currentSection;
          target!.links = target!.links || [];
          target!.links.push(linkMatch[2]);
        }
      }
    }

    return nodes;
  }

  /**
   * Convert RoadmapNode to TrainingItem
   */
  convertToTrainingItems(
    nodes: RoadmapNode[],
    userId: string,
    parentId?: string,
    depth: number = 0
  ): TrainingItem[] {
    return nodes.map((node, index) => {
      const trainingItem = new TrainingItem({
        id: node.id,
        user_id: userId,
        parent_id: parentId,
        title: node.title,
        description: node.description || `Learn ${node.title}`,
        category: this.mapRoadmapTypeToCategory(node.type),
        skill_type: node.type === 'skill' ? SkillType.HARD_SKILL : SkillType.SOFT_SKILL,
        difficulty_level: this.mapRoadmapLevelToDifficulty(node.level),
        estimated_duration_minutes: (node.estimatedHours || 1) * 60,
        status: TrainingStatus.NOT_STARTED,
        progress_percentage: 0,
        source: TrainingSource.ROADMAP_SH,
        source_url: node.links?.[0],
        tags: ['roadmap', 'imported'],
        level: depth,
        order_index: index,
      });

      // Convert children
      if (node.children && node.children.length > 0) {
        const children = this.convertToTrainingItems(
          node.children,
          userId,
          trainingItem.id,
          depth + 1
        );
        trainingItem.children = children;
      }

      return trainingItem;
    });
  }

  /**
   * Import roadmap as training items
   */
  importRoadmap(roadmapId: string, userId: string, title?: string): Observable<ImportResult> {
    return this.fetchRoadmapFromGitHub(roadmapId).pipe(
      map((response) => {
        // Decode base64 content if needed
        const content =
          typeof response === 'object' && response.content
            ? atob(response.content.replace(/\s/g, ''))
            : response;

        const nodes = this.parseRoadmapContent(content, roadmapId);
        const trainingItems = this.convertToTrainingItems(nodes, userId);

        // Create root item for the roadmap
        const rootItem = new TrainingItem({
          id: `roadmap-${roadmapId}-${Date.now()}`,
          user_id: userId,
          parent_id: undefined,
          title: title || `${roadmapId.charAt(0).toUpperCase() + roadmapId.slice(1)} Roadmap`,
          description: `Imported roadmap from roadmap.sh/${roadmapId}`,
          category: SkillCategory.LEARNING,
          skill_type: SkillType.HARD_SKILL,
          difficulty_level: DifficultyLevel.INTERMEDIATE,
          estimated_duration_minutes: trainingItems.reduce(
            (sum, item) => sum + item.getTotalEstimatedTime(),
            0
          ),
          status: TrainingStatus.NOT_STARTED,
          progress_percentage: 0,
          source: TrainingSource.ROADMAP_SH,
          source_url: `https://roadmap.sh/${roadmapId}`,
          tags: ['roadmap', 'imported', roadmapId],
          level: 0,
          order_index: 0,
          children: trainingItems,
        });

        // Update parent IDs for direct children
        trainingItems.forEach((item) => {
          if (!item.parent_id) {
            item.parent_id = rootItem.id;
          }
        });

        return {
          success: true,
          itemsImported: trainingItems.length + 1, // +1 for root
          errors: [],
          rootItem: rootItem,
        };
      }),
      catchError((error) => {
        return from(
          Promise.resolve({
            success: false,
            itemsImported: 0,
            errors: [error.message],
            rootItem: undefined,
          })
        );
      })
    );
  }

  /**
   * Import from CSV format
   */
  importFromCSV(csvContent: string, userId: string): Observable<ImportResult> {
    try {
      const lines = csvContent.split('\n');
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

      const trainingItems: TrainingItem[] = [];
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map((v) => v.trim());
        if (values.length < 2) continue; // Skip empty lines

        try {
          const item = new TrainingItem({
            id: `csv-import-${Date.now()}-${i}`,
            user_id: userId,
            title: values[headers.indexOf('title')] || values[0],
            description: values[headers.indexOf('description')] || '',
            category: this.parseCategory(values[headers.indexOf('category')] || 'technical'),
            skill_type: this.parseSkillType(values[headers.indexOf('skill_type')] || 'hard_skill'),
            difficulty_level: this.parseDifficultyLevel(
              values[headers.indexOf('level')] || 'beginner'
            ),
            estimated_duration_minutes: parseInt(values[headers.indexOf('minutes')] || '60'),
            status: TrainingStatus.NOT_STARTED,
            progress_percentage: 0,
            source: TrainingSource.IMPORTED_CSV,
            tags: ['csv', 'imported'],
            level: 0,
            order_index: i - 1,
          });
          trainingItems.push(item);
        } catch (error) {
          errors.push(`Line ${i}: ${error}`);
        }
      }

      return from(
        Promise.resolve({
          success: true,
          itemsImported: trainingItems.length,
          errors: errors,
          rootItem: undefined,
        })
      );
    } catch (error) {
      return throwError(() => new Error(`CSV parsing failed: ${error}`));
    }
  }

  // Helper methods
  private generateId(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  }

  private mapRoadmapTypeToCategory(type: string): SkillCategory {
    switch (type) {
      case 'project':
        return SkillCategory.PROJECT_MANAGEMENT;
      case 'resource':
        return SkillCategory.LEARNING;
      case 'topic':
        return SkillCategory.LEARNING;
      default:
        return SkillCategory.TECHNICAL;
    }
  }

  private mapRoadmapLevelToDifficulty(level: string): DifficultyLevel {
    switch (level) {
      case 'advanced':
        return DifficultyLevel.ADVANCED;
      case 'intermediate':
        return DifficultyLevel.INTERMEDIATE;
      default:
        return DifficultyLevel.BEGINNER;
    }
  }

  private parseCategory(category: string): SkillCategory {
    const categoryMap: { [key: string]: SkillCategory } = {
      technical: SkillCategory.TECHNICAL,
      leadership: SkillCategory.LEADERSHIP,
      communication: SkillCategory.COMMUNICATION,
      problem_solving: SkillCategory.PROBLEM_SOLVING,
      creativity: SkillCategory.CREATIVITY,
      project_management: SkillCategory.PROJECT_MANAGEMENT,
      collaboration: SkillCategory.COLLABORATION,
      learning: SkillCategory.LEARNING,
    };
    return categoryMap[category.toLowerCase()] || SkillCategory.TECHNICAL;
  }

  private parseSkillType(type: string): SkillType {
    return type.toLowerCase() === 'soft_skill' ? SkillType.SOFT_SKILL : SkillType.HARD_SKILL;
  }

  private parseDifficultyLevel(level: string): DifficultyLevel {
    const levelMap: { [key: string]: DifficultyLevel } = {
      beginner: DifficultyLevel.BEGINNER,
      intermediate: DifficultyLevel.INTERMEDIATE,
      advanced: DifficultyLevel.ADVANCED,
      expert: DifficultyLevel.EXPERT,
    };
    return levelMap[level.toLowerCase()] || DifficultyLevel.BEGINNER;
  }

  /**
   * Import learning structure from Speckit CSV format
   */
  importFromSpeckitCSV(csvContent: string, userId: string): Observable<ImportResult> {
    try {
      const rows = this.parseCSVContent(csvContent);
      const trainingItems = this.convertSpeckitCSVToTrainingItems(rows, userId);

      return from(
        Promise.resolve({
          success: true,
          itemsImported: trainingItems.length,
          errors: [],
          rootItem: trainingItems[0],
        })
      );
    } catch (error) {
      return from(
        Promise.resolve({
          success: false,
          itemsImported: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error during CSV import'],
        })
      );
    }
  }

  /**
   * Import learning structure from Speckit JSON format
   */
  importFromSpeckitJSON(jsonData: SpeckitJSONData, userId: string): Observable<ImportResult> {
    try {
      const trainingItems = this.convertSpeckitJSONToTrainingItems(jsonData, userId);

      return from(
        Promise.resolve({
          success: true,
          itemsImported: trainingItems.length,
          errors: [],
          rootItem: trainingItems[0],
        })
      );
    } catch (error) {
      return from(
        Promise.resolve({
          success: false,
          itemsImported: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error during JSON import'],
        })
      );
    }
  }

  /**
   * Parse CSV content into structured data
   */
  private parseCSVContent(csvContent: string): SpeckitCSVRow[] {
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
    const rows: SpeckitCSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length >= headers.length) {
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });

        // Convert and validate required fields
        row.estimated_minutes = parseInt(row.estimated_minutes) || 15;
        row.order_index = parseInt(row.order_index) || i;

        rows.push(row as SpeckitCSVRow);
      }
    }

    return rows;
  }

  /**
   * Parse a single CSV line handling quoted values
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  /**
   * Convert Speckit CSV data to TrainingItem tree structure
   */
  private convertSpeckitCSVToTrainingItems(rows: SpeckitCSVRow[], userId: string): TrainingItem[] {
    const topicGroups = new Map<string, SpeckitCSVRow[]>();

    // Group by topic
    rows.forEach((row) => {
      if (!topicGroups.has(row.topic_title)) {
        topicGroups.set(row.topic_title, []);
      }
      topicGroups.get(row.topic_title)!.push(row);
    });

    const trainingItems: TrainingItem[] = [];
    let topicIndex = 0;

    // Convert each topic group
    for (const [topicTitle, topicRows] of topicGroups.entries()) {
      const rootItem = this.createTopicRootItem(topicTitle, topicRows[0], userId, topicIndex);
      const conceptGroups = this.groupByConcept(topicRows);

      let conceptIndex = 0;
      for (const [conceptName, conceptRows] of conceptGroups.entries()) {
        const conceptItem = this.createConceptItem(
          conceptName,
          conceptRows[0],
          userId,
          rootItem.id,
          conceptIndex
        );

        // Create unit items
        conceptRows.forEach((row, unitIndex) => {
          const unitItem = this.createUnitItem(row, userId, conceptItem.id, unitIndex);
          // In a real implementation, you'd add to the tree structure here
        });

        conceptIndex++;
      }

      trainingItems.push(rootItem);
      topicIndex++;
    }

    return trainingItems;
  }

  /**
   * Convert Speckit JSON data to TrainingItem tree structure
   */
  private convertSpeckitJSONToTrainingItems(data: SpeckitJSONData, userId: string): TrainingItem[] {
    const rootItem = new TrainingItem({
      user_id: userId,
      title: data.topic.title,
      description: data.topic.description || '',
      category: this.mapStringToCategory(data.topic.category),
      skill_type:
        data.topic.skillType === 'hard_skill' ? SkillType.HARD_SKILL : SkillType.SOFT_SKILL,
      difficulty_level: this.mapStringToDifficulty(data.topic.difficulty),
      estimated_duration_minutes: (data.topic.estimatedWeeks || 1) * 7 * 30, // Convert weeks to minutes
      source: TrainingSource.IMPORTED_JSON,
      level: 0,
      order_index: 0,
    });

    const allItems = [rootItem];
    let conceptIndex = 0;

    data.concepts.forEach((concept) => {
      const conceptItem = new TrainingItem({
        user_id: userId,
        parent_id: rootItem.id,
        title: concept.name,
        description: concept.description || '',
        category: rootItem.category,
        skill_type: rootItem.skill_type,
        difficulty_level: rootItem.difficulty_level,
        estimated_duration_minutes: 30, // Default for concept overview
        source: TrainingSource.IMPORTED_JSON,
        level: 1,
        order_index: conceptIndex,
      });

      allItems.push(conceptItem);

      // Create unit items
      concept.units.forEach((unit, unitIndex) => {
        const unitItem = new TrainingItem({
          user_id: userId,
          parent_id: conceptItem.id,
          title: unit.title,
          description: unit.description || '',
          category: rootItem.category,
          skill_type: rootItem.skill_type,
          difficulty_level: rootItem.difficulty_level,
          estimated_duration_minutes: unit.estimatedMinutes,
          source: TrainingSource.IMPORTED_JSON,
          tags: unit.learningResources?.map((r) => r.type) || [],
          level: 2,
          order_index: unitIndex,
        });

        allItems.push(unitItem);
      });

      conceptIndex++;
    });

    return allItems;
  }

  /**
   * Group CSV rows by concept
   */
  private groupByConcept(rows: SpeckitCSVRow[]): Map<string, SpeckitCSVRow[]> {
    const conceptGroups = new Map<string, SpeckitCSVRow[]>();

    rows.forEach((row) => {
      if (!conceptGroups.has(row.concept)) {
        conceptGroups.set(row.concept, []);
      }
      conceptGroups.get(row.concept)!.push(row);
    });

    return conceptGroups;
  }

  /**
   * Create a root topic training item
   */
  private createTopicRootItem(
    title: string,
    sampleRow: SpeckitCSVRow,
    userId: string,
    index: number
  ): TrainingItem {
    return new TrainingItem({
      user_id: userId,
      title: title,
      description: `Learning topic: ${title}`,
      category: this.mapStringToCategory(sampleRow.category),
      skill_type: SkillType.HARD_SKILL, // Default, could be determined from data
      difficulty_level: this.mapStringToDifficulty(sampleRow.difficulty),
      estimated_duration_minutes: 60, // Topic overview
      source: TrainingSource.IMPORTED_CSV,
      level: 0,
      order_index: index,
    });
  }

  /**
   * Create a concept training item
   */
  private createConceptItem(
    name: string,
    sampleRow: SpeckitCSVRow,
    userId: string,
    parentId: string,
    index: number
  ): TrainingItem {
    return new TrainingItem({
      user_id: userId,
      parent_id: parentId,
      title: name,
      description: `Learning concept: ${name}`,
      category: this.mapStringToCategory(sampleRow.category),
      skill_type: SkillType.HARD_SKILL,
      difficulty_level: this.mapStringToDifficulty(sampleRow.difficulty),
      estimated_duration_minutes: 30, // Concept overview
      source: TrainingSource.IMPORTED_CSV,
      level: 1,
      order_index: index,
    });
  }

  /**
   * Create a unit training item
   */
  private createUnitItem(
    row: SpeckitCSVRow,
    userId: string,
    parentId: string,
    index: number
  ): TrainingItem {
    return new TrainingItem({
      user_id: userId,
      parent_id: parentId,
      title: row.unit_title,
      description: row.description || `Learning unit: ${row.unit_title}`,
      category: this.mapStringToCategory(row.category),
      skill_type: SkillType.HARD_SKILL,
      difficulty_level: this.mapStringToDifficulty(row.difficulty),
      estimated_duration_minutes: row.estimated_minutes,
      source: TrainingSource.IMPORTED_CSV,
      tags: row.prerequisites ? [row.prerequisites] : [],
      level: 2,
      order_index: index,
    });
  }

  /**
   * Map string category to enum
   */
  private mapStringToCategory(category: string): SkillCategory {
    switch (category.toLowerCase()) {
      case 'technical':
        return SkillCategory.TECHNICAL;
      case 'leadership':
        return SkillCategory.LEADERSHIP;
      case 'communication':
        return SkillCategory.COMMUNICATION;
      case 'problem_solving':
        return SkillCategory.PROBLEM_SOLVING;
      case 'creativity':
        return SkillCategory.CREATIVITY;
      case 'project_management':
        return SkillCategory.PROJECT_MANAGEMENT;
      case 'collaboration':
        return SkillCategory.COLLABORATION;
      case 'learning':
        return SkillCategory.LEARNING;
      default:
        return SkillCategory.TECHNICAL;
    }
  }

  /**
   * Map string difficulty to enum
   */
  private mapStringToDifficulty(difficulty: string): DifficultyLevel {
    switch (difficulty.toLowerCase()) {
      case 'beginner':
        return DifficultyLevel.BEGINNER;
      case 'intermediate':
        return DifficultyLevel.INTERMEDIATE;
      case 'advanced':
        return DifficultyLevel.ADVANCED;
      case 'expert':
        return DifficultyLevel.EXPERT;
      default:
        return DifficultyLevel.BEGINNER;
    }
  }

  /**
   * Generate sample Speckit CSV format
   */
  generateSampleSpeckitCSV(): string {
    return `learning_plan_title,week,day,session_title,content_type,duration_minutes,description,resources
"Software Design & Architecture",1,1,"SOLID Principles Deep Dive",theory_practice,45,"Learn SRP with real-world examples and code refactoring","roadmap.sh/software-design-architecture, Clean Code book"
"Software Design & Architecture",1,2,"Open/Closed & Liskov Substitution",comparative_analysis,45,"Design extensible payment system following OCP and LSP","Design Patterns book, payment system examples"  
"Software Design & Architecture",1,3,"Interface Segregation & Dependency Inversion",design_exercise,45,"Split fat interfaces and implement dependency injection","DI container documentation, interface examples"
"Software Design & Architecture",1,4,"Creational Patterns",pattern_implementation,45,"Implement Factory, Builder, and Singleton patterns","Gang of Four patterns, creational pattern examples"
"Software Design & Architecture",1,5,"Structural Patterns Review",synthesis,45,"Combine Adapter, Decorator, and Facade patterns","Pattern examples repository, structural pattern guide"
"Software Design & Architecture",2,6,"Monolithic vs Microservices Architecture",comparative_analysis,45,"Design e-commerce system in both architectural styles","Martin Fowler articles, microservices patterns"
"Software Design & Architecture",2,7,"Database Design & Scaling",hands_on_design,45,"Design database schema for 1M+ user social platform","Database design principles, sharding strategies"
"Software Design & Architecture",2,8,"Caching & Performance",performance_optimization,45,"Implement multi-level caching strategy for APIs","Redis documentation, cache patterns"
"Software Design & Architecture",2,9,"Load Balancing & CDN",infrastructure_design,45,"Design global content delivery for media streaming","AWS/Azure architecture guides, CDN best practices"
"Software Design & Architecture",2,10,"API Design & Documentation",api_design_practice,45,"Create RESTful APIs for project management system","REST API best practices, OpenAPI specification"
"Software Design & Architecture",3,11,"Security Patterns & Best Practices",security_implementation,45,"Implement OAuth 2.0 and protect against OWASP Top 10","OWASP guidelines, OAuth 2.0 specification"
"Software Design & Architecture",3,12,"Testing Strategies & Automation",test_driven_development,45,"Create comprehensive testing strategy for microservices","Testing pyramid guide, contract testing"
"Software Design & Architecture",3,13,"Code Quality & Technical Debt",quality_assessment,45,"Establish quality metrics and systematic refactoring","Code quality tools, refactoring strategies"
"Software Design & Architecture",3,14,"Monitoring & Observability",operations_setup,45,"Design monitoring for distributed system health","Observability best practices, monitoring tools"
"Software Design & Architecture",3,15,"DevOps & Deployment Strategies",deployment_automation,45,"Implement CI/CD with zero-downtime deployments","DevOps pipeline guides, deployment patterns"
"Software Design & Architecture",4,16,"Capstone: Architecture Design",project_based,45,"Design complete e-learning platform architecture","All previous week learnings, architecture patterns"
"Software Design & Architecture",4,17,"Capstone: API & Security Implementation",project_based,45,"Implement secure APIs for e-learning platform","Security patterns, API design principles"
"Software Design & Architecture",4,18,"Capstone: Scalability & Performance",project_based,45,"Optimize e-learning platform for scale","Caching strategies, performance patterns"
"Software Design & Architecture",4,19,"Capstone: Testing & Quality Assurance",project_based,45,"Create comprehensive test suite","Testing strategies, quality frameworks"
"Software Design & Architecture",4,20,"Capstone: Deployment & Monitoring",project_based,45,"Deploy and monitor complete system","DevOps practices, monitoring implementation"`;
  }

  /**
   * Generate sample Speckit JSON format for Software Design & Architecture
   */
  generateSampleSpeckitJSON(): SpeckitJSONData {
    return {
      topic: {
        title: 'Software Design & Architecture Fundamentals',
        description:
          'Master software design patterns, architectural principles, and scalability concepts based on roadmap.sh',
        estimatedWeeks: 4,
        skillType: 'hard_skill',
        category: 'technical',
        difficulty: 'intermediate',
      },
      concepts: [
        {
          name: 'SOLID Principles & Design Patterns',
          description: 'Master fundamental design principles and common patterns',
          units: [
            {
              title: 'SOLID Principles Deep Dive',
              description:
                'Learn and apply all five SOLID principles with real-world code examples and refactoring exercises',
              estimatedMinutes: 45,
              learningResources: [
                {
                  type: 'article',
                  title: 'SOLID Principles Complete Guide',
                  url: 'https://roadmap.sh/guides/solid-principles',
                  duration: '15 minutes',
                },
                {
                  type: 'video',
                  title: 'SOLID Principles in Action',
                  url: 'https://example.com/solid-video',
                  duration: '20 minutes',
                },
                {
                  type: 'exercise',
                  title: 'Refactor UserManager Class',
                  url: 'https://github.com/examples/solid-refactoring',
                  duration: '10 minutes',
                },
              ],
              practiceExercises: [
                {
                  title: 'SRP Violation Detection',
                  description:
                    'Identify and fix Single Responsibility Principle violations in given code',
                  estimatedMinutes: 15,
                },
                {
                  title: 'Strategy Pattern Implementation',
                  description:
                    'Implement Open/Closed Principle using Strategy pattern for payment processing',
                  estimatedMinutes: 20,
                },
              ],
            },
            {
              title: 'Creational Design Patterns',
              description:
                'Master Factory, Builder, and Singleton patterns with thread-safe implementations',
              estimatedMinutes: 45,
              learningResources: [
                {
                  type: 'book',
                  title: 'Gang of Four Design Patterns',
                  url: 'https://example.com/gof-patterns',
                  duration: '30 minutes',
                },
                {
                  type: 'tutorial',
                  title: 'Creational Patterns in C#',
                  url: 'https://example.com/creational-csharp',
                  duration: '15 minutes',
                },
              ],
              practiceExercises: [
                {
                  title: 'E-commerce Product Factory',
                  description:
                    'Create product catalog system using Factory and Abstract Factory patterns',
                  estimatedMinutes: 25,
                },
                {
                  title: 'Configuration Builder',
                  description: 'Implement Builder pattern for complex configuration objects',
                  estimatedMinutes: 20,
                },
              ],
            },
          ],
        },
        {
          name: 'System Architecture & Scalability',
          description: 'Learn architectural patterns, microservices, and scalability strategies',
          units: [
            {
              title: 'Monolithic vs Microservices Architecture',
              description:
                'Design and compare different architectural approaches for scalable systems',
              estimatedMinutes: 45,
              learningResources: [
                {
                  type: 'article',
                  title: 'Microservices Architecture Guide',
                  url: 'https://martinfowler.com/microservices/',
                  duration: '25 minutes',
                },
                {
                  type: 'case_study',
                  title: 'Netflix Microservices Migration',
                  url: 'https://example.com/netflix-case-study',
                  duration: '20 minutes',
                },
              ],
              practiceExercises: [
                {
                  title: 'E-commerce Architecture Design',
                  description:
                    'Design both monolithic and microservices versions of an e-commerce platform',
                  estimatedMinutes: 30,
                },
                {
                  title: 'Service Boundary Identification',
                  description:
                    'Define service boundaries and data ownership for a social media platform',
                  estimatedMinutes: 15,
                },
              ],
            },
            {
              title: 'Caching & Performance Optimization',
              description:
                'Implement multi-level caching strategies and performance optimization techniques',
              estimatedMinutes: 45,
              learningResources: [
                {
                  type: 'documentation',
                  title: 'Redis Caching Patterns',
                  url: 'https://redis.io/documentation',
                  duration: '20 minutes',
                },
                {
                  type: 'tutorial',
                  title: 'CDN and Load Balancing',
                  url: 'https://example.com/cdn-tutorial',
                  duration: '25 minutes',
                },
              ],
              practiceExercises: [
                {
                  title: 'API Caching Strategy',
                  description: 'Design and implement cache-aside pattern for REST APIs',
                  estimatedMinutes: 25,
                },
                {
                  title: 'Global CDN Design',
                  description: 'Create content delivery strategy for media streaming service',
                  estimatedMinutes: 20,
                },
              ],
            },
          ],
        },
        {
          name: 'Capstone Project',
          description: 'Apply all learned concepts in a comprehensive real-world project',
          units: [
            {
              title: 'E-Learning Platform Architecture',
              description:
                'Design complete scalable e-learning platform demonstrating all learned patterns and principles',
              estimatedMinutes: 225, // 5 sessions × 45 minutes
              learningResources: [
                {
                  type: 'reference',
                  title: 'All Previous Week Learnings',
                  url: 'https://course.example.com/resources',
                  duration: 'Self-paced',
                },
                {
                  type: 'template',
                  title: 'Architecture Documentation Template',
                  url: 'https://example.com/arch-template',
                  duration: '10 minutes',
                },
              ],
              practiceExercises: [
                {
                  title: 'System Architecture Design',
                  description:
                    'Create complete architecture document with component diagrams and technology decisions',
                  estimatedMinutes: 45,
                },
                {
                  title: 'Security Implementation',
                  description: 'Implement OAuth 2.0 authentication and OWASP security practices',
                  estimatedMinutes: 45,
                },
                {
                  title: 'Scalability & Performance',
                  description:
                    'Optimize system for scale with caching, load balancing, and monitoring',
                  estimatedMinutes: 45,
                },
                {
                  title: 'Testing Strategy',
                  description:
                    'Create comprehensive test suite covering unit, integration, and contract tests',
                  estimatedMinutes: 45,
                },
                {
                  title: 'Deployment & Monitoring',
                  description:
                    'Set up CI/CD pipeline with zero-downtime deployment and comprehensive monitoring',
                  estimatedMinutes: 45,
                },
              ],
            },
          ],
        },
      ],
    };
  }
}
