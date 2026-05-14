-- Add aggregate playback statistics while preserving the existing short-view counter.
ALTER TABLE "UserPreferences" ADD COLUMN "short_view_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UserPreferences" ADD COLUMN "long_view_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UserPreferences" ADD COLUMN "long_play_seconds" REAL NOT NULL DEFAULT 0;
ALTER TABLE "UserPreferences" ADD COLUMN "active_listening_seconds" REAL NOT NULL DEFAULT 0;
ALTER TABLE "UserPreferences" ADD COLUMN "consecutive_repeat_count" INTEGER NOT NULL DEFAULT 0;

UPDATE "UserPreferences"
SET "short_view_count" = "play_count"
WHERE "short_view_count" = 0 AND "play_count" > 0;

CREATE TABLE IF NOT EXISTS "PlayerSession" (
    "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "song_id" INTEGER,
    "position_sec" REAL NOT NULL DEFAULT 0,
    "resume_from_start" BOOLEAN NOT NULL DEFAULT true,
    "queue_type" TEXT NOT NULL DEFAULT 'NONE',
    "queue_source" TEXT,
    "queue_song_ids" TEXT NOT NULL DEFAULT '[]',
    "queue_index" INTEGER NOT NULL DEFAULT 0
);
