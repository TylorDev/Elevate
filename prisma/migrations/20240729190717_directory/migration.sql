-- CreateTable
CREATE TABLE "Directory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Directory_path_key" ON "Directory"("path");
