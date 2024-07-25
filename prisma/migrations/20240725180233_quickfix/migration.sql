/*
  Warnings:

  - You are about to drop the `PlaybackHistory` table. If the table is not empty, all the data it contains will be lost.
  - The primary key for the `UserPreferences` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `user_preference_id` on the `UserPreferences` table. All the data in the column will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "PlaybackHistory";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "PlayHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "song_id" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayHistory_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "Songs" ("song_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlayHistory_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "UserPreferences" ("song_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserPreferences" (
    "song_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "play_count" INTEGER NOT NULL DEFAULT 0,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "listen_later" BOOLEAN NOT NULL DEFAULT false,
    "skip_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "UserPreferences_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "Songs" ("song_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserPreferences" ("is_favorite", "listen_later", "skip_count", "song_id") SELECT "is_favorite", "listen_later", "skip_count", "song_id" FROM "UserPreferences";
DROP TABLE "UserPreferences";
ALTER TABLE "new_UserPreferences" RENAME TO "UserPreferences";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
