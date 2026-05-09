/*
  Warnings:

  - You are about to drop the `LastSong` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "LastSong";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Directory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT NOT NULL,
    "parentId" INTEGER,
    "totalTracks" INTEGER NOT NULL DEFAULT 0,
    "totalDuration" REAL NOT NULL DEFAULT 0,
    "lastScannedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Directory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Directory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Directory" ("id", "path") SELECT "id", "path" FROM "Directory";
DROP TABLE "Directory";
ALTER TABLE "new_Directory" RENAME TO "Directory";
CREATE UNIQUE INDEX "Directory_path_key" ON "Directory"("path");
CREATE TABLE "new_Songs" (
    "song_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "filepath" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "title" TEXT,
    "artist" TEXT,
    "album" TEXT,
    "genre" TEXT,
    "year" INTEGER,
    "duration" REAL NOT NULL DEFAULT 0,
    "size" INTEGER NOT NULL DEFAULT 0,
    "trackNumber" INTEGER,
    "coverHash" TEXT,
    "metadataLoaded" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Songs" ("filename", "filepath", "song_id", "timestamp") SELECT "filename", "filepath", "song_id", "timestamp" FROM "Songs";
DROP TABLE "Songs";
ALTER TABLE "new_Songs" RENAME TO "Songs";
CREATE UNIQUE INDEX "Songs_filepath_key" ON "Songs"("filepath");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
