import Database from 'better-sqlite3';

export function createDb(path = process.env.TAGA_DB_PATH ?? 'taga.db'): Database.Database {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      description TEXT,
      graph TEXT NOT NULL,
      trigger TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflow_versions (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL REFERENCES workflows(id),
      version INTEGER NOT NULL,
      graph TEXT NOT NULL,
      trigger TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL REFERENCES workflows(id),
      status TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      input TEXT NOT NULL,
      output TEXT,
      logs TEXT NOT NULL DEFAULT '[]',
      error TEXT,
      started_at TEXT NOT NULL,
      finished_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_workflows_user ON workflows(user_id);
    CREATE INDEX IF NOT EXISTS idx_runs_workflow ON runs(workflow_id);
    CREATE INDEX IF NOT EXISTS idx_versions_workflow ON workflow_versions(workflow_id);
  `);
  return db;
}
