-- CreateTable
CREATE TABLE "Songs" (
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

-- CreateTable
CREATE TABLE "UserPreferences" (
    "song_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "play_count" INTEGER NOT NULL DEFAULT 0,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "listen_later" BOOLEAN NOT NULL DEFAULT false,
    "skip_count" INTEGER NOT NULL DEFAULT 0,
    "short_view_count" INTEGER NOT NULL DEFAULT 0,
    "long_view_count" INTEGER NOT NULL DEFAULT 0,
    "long_play_seconds" REAL NOT NULL DEFAULT 0,
    "active_listening_seconds" REAL NOT NULL DEFAULT 0,
    "consecutive_repeat_count" INTEGER NOT NULL DEFAULT 0,
    "bpm" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "UserPreferences_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "Songs" ("song_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "song_id" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayHistory_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "Songs" ("song_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Playlist" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "duracion" INTEGER NOT NULL DEFAULT 0,
    "numElementos" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalplays" INTEGER NOT NULL DEFAULT 0,
    "customCoverMode" TEXT,
    "customCoverHash" TEXT,
    "customCoverValue" TEXT,
    "customCoverSelection" TEXT,
    "customCoverUpdatedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Historial" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "playlistId" INTEGER NOT NULL,
    "playedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Historial_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Directory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT NOT NULL,
    "parentId" INTEGER,
    "totalTracks" INTEGER NOT NULL DEFAULT 0,
    "totalDuration" REAL NOT NULL DEFAULT 0,
    "lastScannedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Directory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Directory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlaybackEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "songId" INTEGER NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "secondsPlayed" REAL NOT NULL DEFAULT 0,
    "completionRatio" REAL NOT NULL DEFAULT 0,
    "isShortView" BOOLEAN NOT NULL DEFAULT false,
    "isLongView" BOOLEAN NOT NULL DEFAULT false,
    "sourceKind" TEXT NOT NULL,
    "sourcePlaylistId" INTEGER,
    "sourceDirectoryId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlaybackEvent_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Songs" ("song_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlaybackEvent_sourcePlaylistId_fkey" FOREIGN KEY ("sourcePlaylistId") REFERENCES "Playlist" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlaybackEvent_sourceDirectoryId_fkey" FOREIGN KEY ("sourceDirectoryId") REFERENCES "Directory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppHistoryEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entityKind" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "songId" INTEGER,
    "playlistId" INTEGER,
    "directoryId" INTEGER,
    "playbackEventId" INTEGER,
    CONSTRAINT "AppHistoryEvent_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Songs" ("song_id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AppHistoryEvent_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AppHistoryEvent_directoryId_fkey" FOREIGN KEY ("directoryId") REFERENCES "Directory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AppHistoryEvent_playbackEventId_fkey" FOREIGN KEY ("playbackEventId") REFERENCES "PlaybackEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "song_id" INTEGER,
    "position_sec" REAL NOT NULL DEFAULT 0,
    "resume_from_start" BOOLEAN NOT NULL DEFAULT true,
    "queue_type" TEXT NOT NULL DEFAULT 'NONE',
    "queue_source" TEXT,
    "queue_song_ids" TEXT NOT NULL DEFAULT '[]',
    "queue_index" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "VisualizerSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "cycleDurationMs" INTEGER NOT NULL DEFAULT 6000,
    "presetSourceMode" TEXT NOT NULL DEFAULT 'ALL',
    "presetSourceListId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VisualizerSettings_presetSourceListId_fkey" FOREIGN KEY ("presetSourceListId") REFERENCES "VisualizerPresetList" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisualizerPresetFavorite" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "presetName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "VisualizerPresetList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VisualizerPresetListItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "listId" TEXT NOT NULL,
    "presetName" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisualizerPresetListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "VisualizerPresetList" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisualizerSourceAssociation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VisualizerSourceAssociation_listId_fkey" FOREIGN KEY ("listId") REFERENCES "VisualizerPresetList" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Songs_filepath_key" ON "Songs"("filepath");

-- CreateIndex
CREATE UNIQUE INDEX "Playlist_path_key" ON "Playlist"("path");

-- CreateIndex
CREATE UNIQUE INDEX "Playlist_nombre_key" ON "Playlist"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Directory_path_key" ON "Directory"("path");

-- CreateIndex
CREATE INDEX "PlaybackEvent_songId_startedAt_idx" ON "PlaybackEvent"("songId", "startedAt");

-- CreateIndex
CREATE INDEX "PlaybackEvent_sourcePlaylistId_startedAt_idx" ON "PlaybackEvent"("sourcePlaylistId", "startedAt");

-- CreateIndex
CREATE INDEX "PlaybackEvent_sourceDirectoryId_startedAt_idx" ON "PlaybackEvent"("sourceDirectoryId", "startedAt");

-- CreateIndex
CREATE INDEX "PlaybackEvent_isShortView_startedAt_idx" ON "PlaybackEvent"("isShortView", "startedAt");

-- CreateIndex
CREATE INDEX "PlaybackEvent_isLongView_startedAt_idx" ON "PlaybackEvent"("isLongView", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppHistoryEvent_playbackEventId_key" ON "AppHistoryEvent"("playbackEventId");

-- CreateIndex
CREATE INDEX "AppHistoryEvent_occurredAt_idx" ON "AppHistoryEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "AppHistoryEvent_entityKind_occurredAt_idx" ON "AppHistoryEvent"("entityKind", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "VisualizerPresetFavorite_presetName_key" ON "VisualizerPresetFavorite"("presetName");

-- CreateIndex
CREATE INDEX "VisualizerPresetListItem_listId_position_idx" ON "VisualizerPresetListItem"("listId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "VisualizerPresetListItem_listId_presetName_key" ON "VisualizerPresetListItem"("listId", "presetName");

-- CreateIndex
CREATE INDEX "VisualizerSourceAssociation_listId_idx" ON "VisualizerSourceAssociation"("listId");

-- CreateIndex
CREATE UNIQUE INDEX "VisualizerSourceAssociation_sourceType_sourceId_key" ON "VisualizerSourceAssociation"("sourceType", "sourceId");

-- Application schema generation used by Elevate's runtime compatibility check.
PRAGMA user_version = 1;
