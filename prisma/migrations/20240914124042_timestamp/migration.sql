-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Songs" (
    "song_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "filepath" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Songs" ("filename", "filepath", "song_id") SELECT "filename", "filepath", "song_id" FROM "Songs";
DROP TABLE "Songs";
ALTER TABLE "new_Songs" RENAME TO "Songs";
CREATE UNIQUE INDEX "Songs_filepath_key" ON "Songs"("filepath");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
