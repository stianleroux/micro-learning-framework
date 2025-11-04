-- =====================================================
-- Micro Learning Framework Database Schema
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- Users table (extends Supabase auth.users)
-- =====================================================
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'team_lead', 'admin')),
    
    -- Profile information
    my_why TEXT,
    about_me TEXT,
    current_hard_skill TEXT,
    current_soft_skill TEXT,
    
    -- Preferences
    notification_preferences JSONB DEFAULT '{
        "enable_web_push": true,
        "enable_email": true,
        "lunchtime_reminders": true,
        "review_reminders": true,
        "preferred_time": "12:00",
        "timezone": "UTC"
    }'::jsonb,
    review_period_months INTEGER DEFAULT 6,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Training Items (with tree structure)
-- =====================================================
CREATE TABLE public.training_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    parent_id UUID REFERENCES public.training_items(id) ON DELETE CASCADE,
    
    -- Basic information
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN (
        'technical', 'leadership', 'communication', 'problem_solving',
        'creativity', 'project_management', 'collaboration', 'learning'
    )),
    skill_type TEXT NOT NULL CHECK (skill_type IN ('hard_skill', 'soft_skill')),
    difficulty_level TEXT NOT NULL CHECK (difficulty_level IN (
        'beginner', 'intermediate', 'advanced', 'expert'
    )),
    estimated_duration_minutes INTEGER DEFAULT 30,
    
    -- Progress tracking
    status TEXT DEFAULT 'not_started' CHECK (status IN (
        'not_started', 'in_progress', 'completed', 'paused', 'archived'
    )),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    completed_at TIMESTAMPTZ,
    last_practiced_at TIMESTAMPTZ,
    
    -- Source metadata
    source TEXT DEFAULT 'manual' CHECK (source IN (
        'manual', 'roadmap_sh', 'speckit', 'imported_csv', 'imported_json'
    )),
    source_url TEXT,
    tags TEXT[] DEFAULT '{}',
    
    -- Tree structure
    level INTEGER DEFAULT 0,
    order_index INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Review Periods (6-month cycles)
-- =====================================================
CREATE TABLE public.review_periods (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    year INTEGER NOT NULL,
    period_number INTEGER NOT NULL CHECK (period_number IN (1, 2)),
    
    -- Date boundaries
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Status and goals
    status TEXT DEFAULT 'planning' CHECK (status IN (
        'planning', 'in_progress', 'review_pending', 'completed', 'archived'
    )),
    hard_skill_focus TEXT,
    soft_skill_focus TEXT,
    goals TEXT[] DEFAULT '{}',
    
    -- Metrics
    total_items INTEGER DEFAULT 0,
    completed_items INTEGER DEFAULT 0,
    total_estimated_minutes INTEGER DEFAULT 0,
    actual_minutes_spent INTEGER DEFAULT 0,
    
    -- Review outcomes
    review_completed_at TIMESTAMPTZ,
    self_assessment_score INTEGER CHECK (self_assessment_score >= 1 AND self_assessment_score <= 10),
    team_lead_assessment_score INTEGER CHECK (team_lead_assessment_score >= 1 AND team_lead_assessment_score <= 10),
    strengths_identified TEXT[] DEFAULT '{}',
    areas_for_improvement TEXT[] DEFAULT '{}',
    next_period_recommendations TEXT[] DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique year/period per user
    UNIQUE(user_id, year, period_number)
);

-- =====================================================
-- Yearly Records (annual summaries)
-- =====================================================
CREATE TABLE public.yearly_records (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    year INTEGER NOT NULL,
    
    -- Aggregated metrics
    total_training_items INTEGER DEFAULT 0,
    completed_training_items INTEGER DEFAULT 0,
    total_learning_hours DECIMAL(8,2) DEFAULT 0,
    
    -- Skills developed
    hard_skills_developed TEXT[] DEFAULT '{}',
    soft_skills_developed TEXT[] DEFAULT '{}',
    
    -- Annual review
    annual_review_completed_at TIMESTAMPTZ,
    overall_performance_score INTEGER CHECK (overall_performance_score >= 1 AND overall_performance_score <= 10),
    career_progression_notes TEXT[] DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique year per user
    UNIQUE(user_id, year)
);

-- =====================================================
-- Team Comments (manager feedback)
-- =====================================================
CREATE TABLE public.team_comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    training_item_id UUID REFERENCES public.training_items(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    team_lead_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Comment content
    comment TEXT NOT NULL,
    comment_type TEXT DEFAULT 'feedback' CHECK (comment_type IN (
        'feedback', 'encouragement', 'suggestion', 'concern', 'milestone', 'assessment'
    )),
    visibility TEXT DEFAULT 'shared' CHECK (visibility IN ('private', 'shared', 'public')),
    
    -- Optional rating
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    
    -- Context
    review_period_id UUID REFERENCES public.review_periods(id) ON DELETE SET NULL,
    
    -- Metadata
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Roadmaps (imported learning paths)
-- =====================================================
CREATE TABLE public.roadmaps (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    difficulty_level TEXT NOT NULL,
    estimated_weeks INTEGER DEFAULT 0,
    
    -- Source information
    source TEXT DEFAULT 'custom' CHECK (source IN (
        'roadmap_sh', 'custom', 'imported', 'template'
    )),
    source_url TEXT,
    source_id TEXT, -- External ID from roadmap.sh or other sources
    
    -- Visibility and ownership
    is_public BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Roadmap Items (hierarchical learning content)
-- =====================================================
CREATE TABLE public.roadmap_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    roadmap_id UUID REFERENCES public.roadmaps(id) ON DELETE CASCADE NOT NULL,
    parent_id UUID REFERENCES public.roadmap_items(id) ON DELETE CASCADE,
    
    -- Basic information
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    
    -- Hierarchy
    level INTEGER DEFAULT 0,
    order_index INTEGER DEFAULT 0,
    
    -- Learning details
    estimated_hours DECIMAL(5,2) DEFAULT 0,
    learning_resources JSONB DEFAULT '[]'::jsonb,
    prerequisites TEXT[] DEFAULT '{}',
    skills_gained TEXT[] DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Indexes for performance
-- =====================================================

-- Users
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);

-- Training Items
CREATE INDEX idx_training_items_user_id ON public.training_items(user_id);
CREATE INDEX idx_training_items_parent_id ON public.training_items(parent_id);
CREATE INDEX idx_training_items_status ON public.training_items(status);
CREATE INDEX idx_training_items_skill_type ON public.training_items(skill_type);
CREATE INDEX idx_training_items_category ON public.training_items(category);
CREATE INDEX idx_training_items_last_practiced ON public.training_items(last_practiced_at DESC);

-- Review Periods
CREATE INDEX idx_review_periods_user_id ON public.review_periods(user_id);
CREATE INDEX idx_review_periods_year_period ON public.review_periods(year, period_number);
CREATE INDEX idx_review_periods_status ON public.review_periods(status);

-- Team Comments
CREATE INDEX idx_team_comments_training_item ON public.team_comments(training_item_id);
CREATE INDEX idx_team_comments_user_id ON public.team_comments(user_id);
CREATE INDEX idx_team_comments_team_lead ON public.team_comments(team_lead_id);

-- Roadmaps
CREATE INDEX idx_roadmaps_source ON public.roadmaps(source);
CREATE INDEX idx_roadmaps_public ON public.roadmaps(is_public);
CREATE INDEX idx_roadmaps_created_by ON public.roadmaps(created_by);

-- Roadmap Items
CREATE INDEX idx_roadmap_items_roadmap_id ON public.roadmap_items(roadmap_id);
CREATE INDEX idx_roadmap_items_parent_id ON public.roadmap_items(parent_id);

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yearly_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_items ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Team leads can view team members" ON public.users FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role IN ('team_lead', 'admin')
    )
);

-- Training items policies
CREATE POLICY "Users can manage own training items" ON public.training_items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Team leads can view team training items" ON public.training_items FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role IN ('team_lead', 'admin')
    )
);

-- Review periods policies
CREATE POLICY "Users can manage own review periods" ON public.review_periods FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Team leads can view team review periods" ON public.review_periods FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role IN ('team_lead', 'admin')
    )
);

-- Yearly records policies
CREATE POLICY "Users can manage own yearly records" ON public.yearly_records FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Team leads can view team yearly records" ON public.yearly_records FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role IN ('team_lead', 'admin')
    )
);

-- Team comments policies
CREATE POLICY "Users can view relevant comments" ON public.team_comments FOR SELECT USING (
    auth.uid() = user_id OR 
    auth.uid() = team_lead_id OR
    (visibility = 'public' AND EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('team_lead', 'admin')
    ))
);
CREATE POLICY "Team leads can create comments" ON public.team_comments FOR INSERT WITH CHECK (
    auth.uid() = team_lead_id AND EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('team_lead', 'admin')
    )
);
CREATE POLICY "Team leads can update own comments" ON public.team_comments FOR UPDATE USING (
    auth.uid() = team_lead_id
);

-- Roadmaps policies
CREATE POLICY "Everyone can view public roadmaps" ON public.roadmaps FOR SELECT USING (is_public = true);
CREATE POLICY "Users can view own roadmaps" ON public.roadmaps FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Users can manage own roadmaps" ON public.roadmaps FOR ALL USING (auth.uid() = created_by);

-- Roadmap items policies
CREATE POLICY "Users can view roadmap items" ON public.roadmap_items FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.roadmaps r 
        WHERE r.id = roadmap_id AND (r.is_public = true OR r.created_by = auth.uid())
    )
);
CREATE POLICY "Users can manage own roadmap items" ON public.roadmap_items FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.roadmaps r 
        WHERE r.id = roadmap_id AND r.created_by = auth.uid()
    )
);

-- =====================================================
-- Triggers for updated_at timestamps
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.training_items FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.review_periods FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.yearly_records FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.team_comments FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.roadmaps FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.roadmap_items FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- Functions for user profile creation
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user profile
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- Sample Data (for development)
-- =====================================================

-- Insert sample roadmap
INSERT INTO public.roadmaps (title, description, category, difficulty_level, estimated_weeks, source, is_public) VALUES
('Angular Developer Path', 'Complete roadmap for becoming an Angular developer', 'Frontend Development', 'Intermediate', 12, 'template', true);

-- Insert sample roadmap items
WITH roadmap_uuid AS (
    SELECT id FROM public.roadmaps WHERE title = 'Angular Developer Path'
)
INSERT INTO public.roadmap_items (roadmap_id, title, description, category, level, order_index, estimated_hours, skills_gained) VALUES
(
    (SELECT id FROM roadmap_uuid),
    'TypeScript Fundamentals',
    'Learn TypeScript basics including types, interfaces, and classes',
    'Programming Language',
    0,
    0,
    20,
    ARRAY['TypeScript', 'Type Safety', 'ES6+']
),
(
    (SELECT id FROM roadmap_uuid),
    'Angular Core Concepts',
    'Understanding components, services, dependency injection',
    'Framework',
    0,
    1,
    30,
    ARRAY['Angular', 'Components', 'Services', 'DI']
),
(
    (SELECT id FROM roadmap_uuid),
    'Reactive Programming with RxJS',
    'Learn observables, operators, and reactive patterns',
    'Programming Paradigm',
    0,
    2,
    25,
    ARRAY['RxJS', 'Observables', 'Reactive Programming']
);

-- =====================================================
-- Views for common queries
-- =====================================================

-- Active training items with progress
CREATE VIEW public.active_training_summary AS
SELECT 
    ti.id,
    ti.user_id,
    ti.title,
    ti.skill_type,
    ti.progress_percentage,
    ti.status,
    ti.last_practiced_at,
    u.full_name as user_name
FROM public.training_items ti
JOIN public.users u ON ti.user_id = u.id
WHERE ti.status IN ('not_started', 'in_progress')
ORDER BY ti.last_practiced_at DESC NULLS LAST;

-- Review period summary
CREATE VIEW public.review_period_summary AS
SELECT 
    rp.id,
    rp.user_id,
    rp.year,
    rp.period_number,
    rp.status,
    rp.hard_skill_focus,
    rp.soft_skill_focus,
    rp.total_items,
    rp.completed_items,
    ROUND((rp.completed_items::decimal / NULLIF(rp.total_items, 0)) * 100, 2) as completion_percentage,
    u.full_name as user_name
FROM public.review_periods rp
JOIN public.users u ON rp.user_id = u.id
ORDER BY rp.year DESC, rp.period_number DESC;

-- =====================================================
-- End of Schema
-- =====================================================