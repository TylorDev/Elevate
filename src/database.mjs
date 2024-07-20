import { app } from 'electron'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

const dbPath = app.getPath('userData') + '/database.db'

console.log(`Database path: ${dbPath}`)

export async function openDb() {
  return open({
    filename: dbPath,
    driver: sqlite3.Database
  })
}

export async function setupDatabase() {
  const db = await openDb()
  await db.exec(`
    -- Tabla de Canciones
CREATE TABLE Songs (
    song_id INTEGER PRIMARY KEY,
    filepath TEXT NOT NULL,
    filename TEXT NOT NULL
);

-- Tabla de Listas de Reproducción
CREATE TABLE Playlists (
    playlist_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    cover TEXT,
    banner TEXT
);

-- Tabla Relacional de Canciones en Listas de Reproducción
CREATE TABLE PlaylistSongs (
    playlist_id INTEGER,
    song_id INTEGER,
    FOREIGN KEY (playlist_id) REFERENCES Playlists(playlist_id),
    FOREIGN KEY (song_id) REFERENCES Songs(song_id),
    PRIMARY KEY (playlist_id, song_id)
);

-- Tabla de Historial de Canciones Escuchadas
CREATE TABLE History (
    history_id INTEGER PRIMARY KEY,
    song_id INTEGER,
    listened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (song_id) REFERENCES Songs(song_id)
);

-- Tabla de Estadísticas de Reproducción
CREATE TABLE Statistics (
    song_id INTEGER PRIMARY KEY,
    play_count INTEGER DEFAULT 0,
    complete_play_count INTEGER DEFAULT 0,
    add_to_list_count INTEGER DEFAULT 0,
    total_play_time INTEGER DEFAULT 0, -- Tiempo total reproducido en segundos
    FOREIGN KEY (song_id) REFERENCES Songs(song_id)
);

-- Tabla de Preferencias del Usuario
CREATE TABLE UserPreferences (
    user_preference_id INTEGER PRIMARY KEY,
    song_id INTEGER,
    is_favorite BOOLEAN DEFAULT 0,
    listen_later BOOLEAN DEFAULT 0,
    FOREIGN KEY (song_id) REFERENCES Songs(song_id)
);
  `)
}
