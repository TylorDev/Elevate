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
