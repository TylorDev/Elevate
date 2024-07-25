-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserPreferences" (
    "user_preference_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "song_id" INTEGER NOT NULL,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "listen_later" BOOLEAN NOT NULL DEFAULT false,
    "skip_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "UserPreferences_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "Songs" ("song_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserPreferences" ("is_favorite", "listen_later", "song_id", "user_preference_id") SELECT "is_favorite", "listen_later", "song_id", "user_preference_id" FROM "UserPreferences";
DROP TABLE "UserPreferences";
ALTER TABLE "new_UserPreferences" RENAME TO "UserPreferences";
CREATE UNIQUE INDEX "UserPreferences_song_id_key" ON "UserPreferences"("song_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
