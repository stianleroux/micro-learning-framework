-- Migration: Create notifications table
-- Description: Add notifications system for real-time alerts and mentions

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('comment', 'mention', 'reply', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Create compound index for user's unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = FALSE;

-- Enable RLS (Row Level Security)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only update their own notifications (for marking as read)
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can only delete their own notifications
CREATE POLICY "Users can delete own notifications" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

-- Only authenticated users can insert notifications (usually via functions)
CREATE POLICY "Authenticated users can create notifications" ON notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_notification_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_updated_at();

-- Create function to create notifications for comment mentions
CREATE OR REPLACE FUNCTION create_mention_notifications()
RETURNS TRIGGER AS $$
DECLARE
    mention_matches TEXT[];
    mention_username TEXT;
    mentioned_user_id UUID;
    comment_author_name TEXT;
    training_item_title TEXT;
BEGIN
    -- Get the author's name and training item title
    SELECT u.full_name INTO comment_author_name
    FROM users u 
    WHERE u.id = NEW.author_id;
    
    SELECT ti.title INTO training_item_title
    FROM training_items ti 
    WHERE ti.id = NEW.training_item_id;
    
    -- Extract @mentions using regex
    SELECT regexp_split_to_array(NEW.content, '@(\w+)', 'g') INTO mention_matches;
    
    -- Process each mention
    FOR mention_username IN 
        SELECT DISTINCT regexp_replace(match, '@', '') 
        FROM unnest(mention_matches) AS match 
        WHERE match LIKE '@%'
    LOOP
        -- Find user by username (assuming username is stored in users table)
        -- For now, we'll try to match by email prefix or full_name
        SELECT id INTO mentioned_user_id 
        FROM users 
        WHERE LOWER(full_name) = LOWER(mention_username) 
           OR LOWER(SPLIT_PART(email, '@', 1)) = LOWER(mention_username)
        LIMIT 1;
        
        -- Create notification if user exists and is not the comment author
        IF mentioned_user_id IS NOT NULL AND mentioned_user_id != NEW.author_id THEN
            INSERT INTO notifications (
                user_id,
                type,
                title,
                message,
                data,
                created_at
            ) VALUES (
                mentioned_user_id,
                'mention',
                'Mentioned in "' || COALESCE(training_item_title, 'Unknown Item') || '"',
                COALESCE(comment_author_name, 'Someone') || ' mentioned you in a comment: "' || 
                LEFT(NEW.content, 100) || 
                CASE WHEN LENGTH(NEW.content) > 100 THEN '...' ELSE '' END || '"',
                jsonb_build_object(
                    'comment_id', NEW.id,
                    'training_item_id', NEW.training_item_id,
                    'training_item_title', COALESCE(training_item_title, 'Unknown Item'),
                    'author', COALESCE(comment_author_name, 'Unknown Author')
                ),
                NOW()
            );
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for mention notifications (assumes team_comments table exists)
CREATE TRIGGER trigger_create_mention_notifications
    AFTER INSERT ON team_comments
    FOR EACH ROW
    EXECUTE FUNCTION create_mention_notifications();

-- Create function to create notifications for comment replies
CREATE OR REPLACE FUNCTION create_reply_notifications()
RETURNS TRIGGER AS $$
DECLARE
    parent_author_id UUID;
    comment_author_name TEXT;
    training_item_title TEXT;
BEGIN
    -- Only process if this is a reply (has parent_comment_id)
    IF NEW.parent_comment_id IS NOT NULL THEN
        -- Get the parent comment author
        SELECT author_id INTO parent_author_id
        FROM team_comments 
        WHERE id = NEW.parent_comment_id;
        
        -- Get author name and training item title
        SELECT u.full_name INTO comment_author_name
        FROM users u 
        WHERE u.id = NEW.author_id;
        
        SELECT ti.title INTO training_item_title
        FROM training_items ti 
        WHERE ti.id = NEW.training_item_id;
        
        -- Create notification if parent author is different from reply author
        IF parent_author_id IS NOT NULL AND parent_author_id != NEW.author_id THEN
            INSERT INTO notifications (
                user_id,
                type,
                title,
                message,
                data,
                created_at
            ) VALUES (
                parent_author_id,
                'reply',
                'Reply to your comment',
                COALESCE(comment_author_name, 'Someone') || ' replied to your comment on "' || 
                COALESCE(training_item_title, 'Unknown Item') || '"',
                jsonb_build_object(
                    'comment_id', NEW.id,
                    'training_item_id', NEW.training_item_id,
                    'training_item_title', COALESCE(training_item_title, 'Unknown Item'),
                    'author', COALESCE(comment_author_name, 'Unknown Author'),
                    'parent_comment_id', NEW.parent_comment_id
                ),
                NOW()
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for reply notifications
CREATE TRIGGER trigger_create_reply_notifications
    AFTER INSERT ON team_comments
    FOR EACH ROW
    EXECUTE FUNCTION create_reply_notifications();

-- Create function to clean up old notifications (keep only last 100 per user)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
    DELETE FROM notifications
    WHERE id IN (
        SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as row_num
            FROM notifications
        ) ranked
        WHERE row_num > 100
    );
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run cleanup (if pg_cron is available)
-- SELECT cron.schedule('cleanup-notifications', '0 2 * * *', 'SELECT cleanup_old_notifications();');

COMMENT ON TABLE notifications IS 'Stores user notifications for mentions, comments, and system alerts';
COMMENT ON COLUMN notifications.type IS 'Type of notification: comment, mention, reply, or system';
COMMENT ON COLUMN notifications.data IS 'Additional JSON data specific to the notification type';
COMMENT ON FUNCTION create_mention_notifications() IS 'Automatically creates notifications when users are mentioned in comments';
COMMENT ON FUNCTION create_reply_notifications() IS 'Automatically creates notifications when someone replies to a comment';
COMMENT ON FUNCTION cleanup_old_notifications() IS 'Removes old notifications, keeping only the latest 100 per user';