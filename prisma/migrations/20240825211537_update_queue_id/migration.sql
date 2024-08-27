-- CreateTable
CREATE TABLE "LastSong" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "file" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "queueId" TEXT NOT NULL
);
