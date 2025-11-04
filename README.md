# Micro Learning Framework

A comprehensive Progressive Web App (PWA) for managing professional development through structured micro-learning sessions. Built for busy professionals who want to develop skills during lunch breaks and maintain continuous learning habits with 6-month review cycles.

## 🎯 Project Vision

Help junior developers, intermediate professionals, and senior engineers maintain consistent learning habits while providing team leads with tools to track and support their team's growth.

## ✨ Key Features

### 🎯 **Focused Learning**
- Track **1 hard skill** + **1 soft skill** simultaneously
- **Micro-learning sessions** perfect for lunch breaks (15-30 min)
- **Personal motivation** tracking with "My Why" and "About" sections

### 📊 **Progress Tracking**
- **6-month review cycles** with structured goal setting
- **Daily streaks** and weekly progress monitoring
- **Visual dashboards** with progress bars and completion metrics
- **Annual records** for long-term career development

### 👥 **Team Collaboration**
- **Team lead comments** and feedback system
- **Role-based permissions** (user, team_lead, admin)
- **Progress visibility** for managers and mentors

### 🗂 **Content Management**
- **Tree-structured learning paths** with parent/child relationships
- **Roadmap.sh integration** for importing popular learning paths
- **Speckit/CSV import** for existing training materials
- **Drag-and-drop organization** of learning materials

### 📱 **PWA Features**
- **Offline support** for uninterrupted learning
- **Push notifications** for learning reminders
- **Mobile-responsive** design optimized for all devices
- **Install prompt** for native app experience

## 🏗 Architecture

### Tech Stack
- **Frontend**: Angular 20+ (Zoneless) with TypeScript
- **Backend**: Supabase (PostgreSQL + Real-time + Auth)
- **PWA**: Angular Service Worker with offline caching
- **Styling**: SCSS with Atomic Design principles
- **Authentication**: Supabase Auth (Email/Password + GitHub OAuth)
- **Deployment**: Vercel + Cloudflare Pages ready

### Code Quality
- **Strict TypeScript** configuration
- **SOLID principles** enforcement
- **Atomic Design** component architecture
- **Comprehensive testing** (Unit + E2E)
- **Code standards documentation** with automated linting
- **Accessibility compliance** (WCAG 2.1 AA)

## 📁 Project Structure

```
micro-learning-framework/
├── 📄 CODE_STANDARDS.md          # Comprehensive coding guidelines
├── 📄 supabase-schema.sql        # Complete database schema
├── 📄 sample-data.json           # Example data for testing
├── 📄 vercel.json               # Vercel deployment config
├── 📄 _wrangler.toml            # Cloudflare deployment config
├── 📄 lighthouserc.json         # Performance monitoring config
├── 📂 .github/workflows/        # CI/CD pipeline
├── 📂 micro-learning-app/       # Main Angular application
│   ├── 📂 src/app/
│   │   ├── 📂 core/
│   │   │   ├── 📂 models/       # TypeScript interfaces & classes
│   │   │   └── 📂 services/     # Business logic & API services
│   │   ├── 📂 features/
│   │   │   └── 📂 dashboard/    # Main dashboard feature
│   │   ├── 📂 shared/
│   │   │   └── 📂 components/   # Reusable UI components
│   │   └── 📂 environments/     # Configuration files
│   └── 📂 public/               # PWA assets & manifest
└── 📂 docs/                     # Additional documentation
```

## 🚀 Quick Start

### Prerequisites
```bash
# Required tools
Node.js 18+ and npm
Angular CLI: npm install -g @angular/cli
Supabase account (free tier available)
```

### 1. Clone & Setup
```bash
git clone https://github.com/stianleroux/micro-learning-framework.git
cd micro-learning-framework/micro-learning-app
npm install
```

### 2. Database Setup
```bash
# Create Supabase project at supabase.com
# Copy your project credentials

# Update environment configuration
# Edit: src/environments/environment.ts
export const environment = {
  supabase: {
    url: 'https://your-project.supabase.co',
    anonKey: 'your-anon-key'
  }
};

# Run database migration
psql -h db.your-project.supabase.co -U postgres -d postgres -f ../supabase-schema.sql
```

### 3. Development
```bash
# Start development server
ng serve

# Open browser
# Navigate to http://localhost:4200
```

### 4. Production Build
```bash
# Build optimized bundle
ng build --prod

# Deploy to Vercel (optional)
vercel --prod
```

## 📊 Data Models

### Core Entities
- **👤 Users**: Profiles with roles, preferences, and learning goals
- **📚 TrainingItems**: Learning tasks with tree structure and progress tracking  
- **📅 ReviewPeriods**: 6-month cycles with goals and assessments
- **📈 YearlyRecords**: Annual learning summaries and career progression
- **💬 TeamComments**: Manager feedback and progress annotations
- **🗺 Roadmaps**: Imported learning paths with hierarchical structure

### Key Relationships
```
User (1) ──→ (n) TrainingItems
User (1) ──→ (n) ReviewPeriods  
User (1) ──→ (n) YearlyRecords
TrainingItem (1) ──→ (n) TeamComments
Roadmap (1) ──→ (n) RoadmapItems
```

## 🔐 Security & Privacy

- **Row Level Security** (RLS) policies for data isolation
- **Role-based access control** (RBAC) for team features
- **JWT authentication** with Supabase Auth
- **HTTPS enforcement** and security headers
- **GDPR compliant** data handling

## 📱 PWA Capabilities

### Offline Support
- **Service Worker** caches critical app shell
- **Offline data sync** when connection restored
- **Background sync** for progress updates

### Notifications
- **Web Push** for learning reminders
- **Scheduled notifications** during lunch hours
- **Review period alerts** for 6-month cycles

### Installation
- **Add to Home Screen** on mobile devices
- **Desktop installation** via browser prompt
- **Native app behavior** with custom icons

## 🧪 Testing & Quality

### Automated Testing
```bash
# Unit tests with Jest
npm run test

# E2E tests with Cypress  
npm run e2e

# Code coverage report
npm run test:coverage
```

### Code Quality Tools
- **ESLint** with strict TypeScript rules
- **Prettier** for consistent formatting  
- **Husky** pre-commit hooks
- **SonarQube** integration for code analysis
- **Lighthouse CI** for performance monitoring

## 🚀 Deployment Options

### Vercel (Recommended)
```bash
# One-click deployment
vercel --prod

# Environment variables required:
# SUPABASE_URL, SUPABASE_ANON_KEY
```

### Cloudflare Pages
```bash
# Connect GitHub repository
# Build command: npm run build
# Output directory: dist/micro-learning-app/browser
```

### Self-Hosted
```bash
# Build static files
npm run build

# Serve from any static hosting
# (Nginx, Apache, S3, etc.)
```

## 📈 Analytics & Monitoring

### Performance Tracking
- **Lighthouse CI** for Core Web Vitals
- **Bundle analyzer** for optimization
- **Real User Monitoring** (RUM) ready
- **Error tracking** with Sentry integration

### Learning Analytics
- **Progress dashboards** with completion rates
- **Time tracking** for learning sessions  
- **Skill development** metrics over time
- **Team performance** insights for managers

## 🔮 Roadmap

### Phase 1: Core Features ✅
- ✅ Dashboard with skill tracking
- ✅ 6-month review cycles
- ✅ Team lead comments
- ✅ Tree-structured learning
- ✅ PWA capabilities

### Phase 2: Integration 🚧
- 🔄 Roadmap.sh import
- 🔄 Speckit/CSV import
- ⏳ Advanced notifications
- ⏳ Drag-and-drop organization

### Phase 3: Advanced Features ⏳
- ⏳ AI-powered recommendations
- ⏳ Gamification elements
- ⏳ Advanced analytics
- ⏳ Mobile native apps

### Phase 4: Enterprise ⏳
- ⏳ SSO integration
- ⏳ Custom branding
- ⏳ Advanced reporting
- ⏳ API for integrations

## 🤝 Contributing

### Development Process
1. **Fork** the repository
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Follow code standards** (see CODE_STANDARDS.md)
4. **Write tests** for new functionality
5. **Commit changes**: `git commit -m 'Add amazing feature'`
6. **Push branch**: `git push origin feature/amazing-feature`
7. **Create Pull Request**

### Code Standards
- Follow [CODE_STANDARDS.md](CODE_STANDARDS.md) guidelines
- Maintain **80%+ test coverage**
- Use **conventional commits** format
- Ensure **accessibility compliance**
- Document **public APIs** with JSDoc

## 📄 License

This project is licensed under the **MIT License** - see [LICENSE](LICENSE) file for details.

## 🆘 Support & Community

- 🐛 **Issues**: [GitHub Issues](https://github.com/stianleroux/micro-learning-framework/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/stianleroux/micro-learning-framework/discussions)
- 📧 **Email**: support@microlearning.dev
- 📖 **Documentation**: [Project Wiki](https://github.com/stianleroux/micro-learning-framework/wiki)

## 🙏 Acknowledgments

- **Angular Team** for the amazing framework
- **Supabase** for the backend-as-a-service platform
- **Roadmap.sh** for learning path inspiration
- **Open source community** for tools and libraries

---

**Built with ❤️ for continuous learners everywhere**

*Helping professionals grow one micro-session at a time* 🚀