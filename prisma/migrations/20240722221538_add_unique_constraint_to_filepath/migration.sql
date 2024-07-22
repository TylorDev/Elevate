/*
  Warnings:

  - A unique constraint covering the columns `[filepath]` on the table `Songs` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Songs_filepath_key" ON "Songs"("filepath");
