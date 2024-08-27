-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Historial" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "playlistId" INTEGER NOT NULL,
    "playedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Historial_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Historial" ("id", "playedAt", "playlistId") SELECT "id", "playedAt", "playlistId" FROM "Historial";
DROP TABLE "Historial";
ALTER TABLE "new_Historial" RENAME TO "Historial";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
