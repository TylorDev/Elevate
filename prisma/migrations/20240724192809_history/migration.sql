-- CreateTable
CREATE TABLE "PlaybackHistory" (
    "history_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "song_id" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "play_count" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "PlaybackHistory_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "Songs" ("song_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
