CREATE TABLE IF NOT EXISTS "VisualizerPresetList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "VisualizerSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "cycleDurationMs" INTEGER NOT NULL DEFAULT 6000,
    "presetSourceMode" TEXT NOT NULL DEFAULT 'ALL',
    "presetSourceListId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisualizerSettings_presetSourceListId_fkey"
        FOREIGN KEY ("presetSourceListId")
        REFERENCES "VisualizerPresetList" ("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "VisualizerPresetFavorite" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "presetName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "VisualizerPresetFavorite_presetName_key"
    ON "VisualizerPresetFavorite"("presetName");

CREATE TABLE IF NOT EXISTS "VisualizerPresetListItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "listId" TEXT NOT NULL,
    "presetName" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisualizerPresetListItem_listId_fkey"
        FOREIGN KEY ("listId")
        REFERENCES "VisualizerPresetList" ("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "VisualizerPresetListItem_listId_presetName_key"
    ON "VisualizerPresetListItem"("listId", "presetName");

CREATE INDEX IF NOT EXISTS "VisualizerPresetListItem_listId_position_idx"
    ON "VisualizerPresetListItem"("listId", "position");

CREATE TABLE IF NOT EXISTS "VisualizerSourceAssociation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisualizerSourceAssociation_listId_fkey"
        FOREIGN KEY ("listId")
        REFERENCES "VisualizerPresetList" ("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "VisualizerSourceAssociation_sourceType_sourceId_key"
    ON "VisualizerSourceAssociation"("sourceType", "sourceId");

CREATE INDEX IF NOT EXISTS "VisualizerSourceAssociation_listId_idx"
    ON "VisualizerSourceAssociation"("listId");
