import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard';
import { RoadmapImport } from './features/roadmap-import/roadmap-import';
import { LearningTree } from './features/learning-tree/learning-tree';
import { TeamComments } from './features/team-comments/team-comments';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'tree', component: LearningTree },
  { path: 'import', component: RoadmapImport },
  { path: 'comments', component: TeamComments },
  { path: '**', redirectTo: '/dashboard' },
];
