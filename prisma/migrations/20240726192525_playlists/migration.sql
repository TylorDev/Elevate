-- CreateTable
CREATE TABLE "Playlist" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT NOT NULL,
    "nombre" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Playlist_path_key" ON "Playlist"("path");

-- CreateIndex
CREATE UNIQUE INDEX "Playlist_nombre_key" ON "Playlist"("nombre");
