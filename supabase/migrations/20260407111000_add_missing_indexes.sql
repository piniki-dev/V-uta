-- ==========================================
-- Database Index Optimization Migration
-- ==========================================

-- 1. Unindexed Foreign Keys (Supabase Linter Recommendation)
-- Table: public.playlists, Column: updated_by
CREATE INDEX IF NOT EXISTS idx_playlists_updated_by ON public.playlists(updated_by);

-- 2. Additional Audit Column Indexes (Preventive Optimization)
-- Audit paths (updated_by) are common for administrative queries and data integrity checks.
CREATE INDEX IF NOT EXISTS idx_songs_updated_by ON public.songs(updated_by);
CREATE INDEX IF NOT EXISTS idx_videos_updated_by ON public.videos(updated_by);

-- Note: Other "Unused Index" warnings from the linter are being ignored for now 
-- as they are critical for foreign key constraints and temporal sorting (Order By).
