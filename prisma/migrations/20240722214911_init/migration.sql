-- CreateTable
CREATE TABLE "Songs" (
    "song_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "filepath" TEXT NOT NULL,
    "filename" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "UserPreferences" (
    "user_preference_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "song_id" INTEGER,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "listen_later" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "UserPreferences_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "Songs" ("song_id") ON DELETE SET NULL ON UPDATE CASCADE
);
