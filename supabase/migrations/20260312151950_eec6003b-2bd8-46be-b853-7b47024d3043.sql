
-- Add video_url column to community_posts
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT NULL;

-- Update storage bucket to allow larger file sizes (5GB for videos)
UPDATE storage.buckets SET file_size_limit = 5368709120 WHERE id = 'community';
