-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Playlist" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "duracion" INTEGER NOT NULL DEFAULT 0,
    "numElementos" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalplays" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_Playlist" ("createdAt", "duracion", "id", "nombre", "numElementos", "path") SELECT "createdAt", "duracion", "id", "nombre", "numElementos", "path" FROM "Playlist";
DROP TABLE "Playlist";
ALTER TABLE "new_Playlist" RENAME TO "Playlist";
CREATE UNIQUE INDEX "Playlist_path_key" ON "Playlist"("path");
CREATE UNIQUE INDEX "Playlist_nombre_key" ON "Playlist"("nombre");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
