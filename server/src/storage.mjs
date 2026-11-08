import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
export function openStore(filename) {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS demo_state (id INTEGER PRIMARY KEY CHECK(id=1), generation INTEGER NOT NULL, next_rank INTEGER NOT NULL);
    INSERT OR IGNORE INTO demo_state VALUES (1,1,1);
    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY, generation INTEGER NOT NULL, name TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
      joined_at INTEGER NOT NULL, completed_at INTEGER, completion_order INTEGER UNIQUE
    );
    CREATE TABLE IF NOT EXISTS lesson_attempts (
      id TEXT PRIMARY KEY, participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      lesson_id TEXT NOT NULL, dataset_version TEXT NOT NULL, started_at INTEGER NOT NULL, duration_ms INTEGER NOT NULL,
      UNIQUE(participant_id,lesson_id)
    );
    CREATE TABLE IF NOT EXISTS quiz_submissions (
      attempt_id TEXT PRIMARY KEY REFERENCES lesson_attempts(id) ON DELETE CASCADE,
      answers TEXT NOT NULL, score INTEGER NOT NULL, submitted_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS attempts_participant ON lesson_attempts(participant_id);
  `);
  return {
    db,
    transaction(fn) {
      db.exec('BEGIN IMMEDIATE');
      try { const result = fn(); db.exec('COMMIT'); return result; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    generation() { return db.prepare('SELECT generation FROM demo_state WHERE id=1').get().generation; },
    close() { db.close(); }
  };
}
