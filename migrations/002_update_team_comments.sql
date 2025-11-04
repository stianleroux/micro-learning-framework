-- =====================================================
-- Migration: Update team_comments table for enhanced functionality
-- =====================================================

-- Drop existing table if it exists (for dev environment)
-- In production, you would use ALTER TABLE statements instead
DROP TABLE IF EXISTS public.team_comments CASCADE;

-- Create the enhanced team_comments table
CREATE TABLE public.team_comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Optional references (flexible usage)
    training_item_id UUID REFERENCES public.training_items(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    review_period_id UUID REFERENCES public.review_periods(id) ON DELETE SET NULL,
    
    -- Author (replaces team_lead_id for more flexibility)
    author_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Comment content and metadata
    content TEXT NOT NULL,
    type TEXT DEFAULT 'general' CHECK (type IN (
        'general', 'feedback', 'question', 'suggestion', 
        'concern', 'approval', 'milestone'
    )),
    visibility TEXT DEFAULT 'team' CHECK (visibility IN ('private', 'team', 'public')),
    
    -- Threading support for replies
    parent_comment_id UUID REFERENCES public.team_comments(id) ON DELETE CASCADE,
    
    -- Optional rating/assessment
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    
    -- Mentions and notifications
    mentioned_user_ids UUID[] DEFAULT '{}',
    read_by UUID[] DEFAULT '{}',
    is_private_note BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Indexes for performance
-- =====================================================
CREATE INDEX idx_team_comments_training_item ON public.team_comments(training_item_id) WHERE training_item_id IS NOT NULL;
CREATE INDEX idx_team_comments_user_id ON public.team_comments(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_team_comments_author ON public.team_comments(author_id);
CREATE INDEX idx_team_comments_parent ON public.team_comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL;
CREATE INDEX idx_team_comments_created_at ON public.team_comments(created_at);
CREATE INDEX idx_team_comments_mentioned_users ON public.team_comments USING gin(mentioned_user_ids);

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================
ALTER TABLE public.team_comments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view comments based on visibility rules
CREATE POLICY "Users can view relevant comments" ON public.team_comments FOR SELECT USING (
    -- Public comments are visible to all authenticated users
    visibility = 'public'
    OR 
    -- Team comments are visible to:
    (visibility = 'team' AND (
        author_id = auth.uid() OR           -- Author can see their own comments
        user_id = auth.uid() OR             -- Target user can see comments about them
        auth.uid() = ANY(mentioned_user_ids) OR  -- Mentioned users can see comments
        auth.uid() IN (                     -- Team leads can see team comments
            SELECT id FROM public.users 
            WHERE id = auth.uid() AND role IN ('team_lead', 'admin')
        )
    ))
    OR
    -- Private comments are only visible to author and mentioned users
    (visibility = 'private' AND (
        author_id = auth.uid() OR
        auth.uid() = ANY(mentioned_user_ids)
    ))
);

-- Policy: Users can create comments if authenticated
CREATE POLICY "Authenticated users can create comments" ON public.team_comments FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND author_id = auth.uid()
);

-- Policy: Users can update their own comments
CREATE POLICY "Users can update own comments" ON public.team_comments FOR UPDATE USING (
    author_id = auth.uid()
) WITH CHECK (
    author_id = auth.uid()
);

-- Policy: Users can delete their own comments, or team leads can delete any
CREATE POLICY "Users can delete own comments or team leads can delete any" ON public.team_comments FOR DELETE USING (
    author_id = auth.uid() OR 
    auth.uid() IN (
        SELECT id FROM public.users 
        WHERE id = auth.uid() AND role IN ('team_lead', 'admin')
    )
);

-- =====================================================
-- Triggers
-- =====================================================
CREATE TRIGGER handle_updated_at 
    BEFORE UPDATE ON public.team_comments 
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add comment to ensure we track when comments are updated
COMMENT ON TABLE public.team_comments IS 'Team comments and feedback on training items and user progress. Supports threading, mentions, and flexible visibility controls.';
COMMENT ON COLUMN public.team_comments.type IS 'Type of comment: general, feedback, question, suggestion, concern, approval, milestone';
COMMENT ON COLUMN public.team_comments.visibility IS 'Who can see this comment: private (author + mentions), team (team members), public (all users)';
COMMENT ON COLUMN public.team_comments.mentioned_user_ids IS 'Array of user IDs mentioned in this comment using @mentions';
COMMENT ON COLUMN public.team_comments.read_by IS 'Array of user IDs who have marked this comment as read';
COMMENT ON COLUMN public.team_comments.parent_comment_id IS 'Reference to parent comment for threading/replies';