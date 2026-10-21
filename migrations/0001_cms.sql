PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS cms_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cms_account (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  version TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cms_projects (
  slug TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
  position INTEGER NOT NULL,
  version TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS cms_project_visibility ON cms_projects(hidden, position DESC);
CREATE TABLE IF NOT EXISTS cms_images (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL REFERENCES cms_projects(slug) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  content BLOB NOT NULL
);
CREATE INDEX IF NOT EXISTS cms_image_project ON cms_images(project_slug);
CREATE TABLE IF NOT EXISTS cms_login_attempts (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
