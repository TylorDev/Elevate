-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserPreferences" (
    "song_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "play_count" INTEGER NOT NULL DEFAULT 0,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "listen_later" BOOLEAN NOT NULL DEFAULT false,
    "skip_count" INTEGER NOT NULL DEFAULT 0,
    "bpm" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "UserPreferences_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "Songs" ("song_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserPreferences" ("is_favorite", "listen_later", "play_count", "skip_count", "song_id") SELECT "is_favorite", "listen_later", "play_count", "skip_count", "song_id" FROM "UserPreferences";
DROP TABLE "UserPreferences";
ALTER TABLE "new_UserPreferences" RENAME TO "UserPreferences";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
