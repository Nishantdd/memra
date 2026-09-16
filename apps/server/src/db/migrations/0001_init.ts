export const sql = `
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  user_agent   TEXT NOT NULL DEFAULT '',
  ip           TEXT NOT NULL DEFAULT ''
);
CREATE INDEX sessions_expires ON sessions(expires_at);

CREATE TABLE login_attempts (
  ip      TEXT NOT NULL,
  at      INTEGER NOT NULL,
  success INTEGER NOT NULL CHECK (success IN (0,1))
);
CREATE INDEX login_attempts_ip ON login_attempts(ip, at);
CREATE INDEX login_attempts_at ON login_attempts(at);

CREATE TABLE folders (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER,
  server_seq  INTEGER NOT NULL
);
CREATE UNIQUE INDEX folders_unique_name ON folders(lower(name)) WHERE deleted_at IS NULL;
CREATE INDEX folders_seq ON folders(server_seq);

CREATE TABLE notes (
  id               TEXT PRIMARY KEY,
  folder_id        TEXT REFERENCES folders(id) ON DELETE SET NULL,
  title            TEXT NOT NULL DEFAULT '' CHECK (length(title) <= 300),
  body_md          TEXT NOT NULL DEFAULT '' CHECK (length(body_md) <= 1048576),
  body_plain       TEXT NOT NULL DEFAULT '',
  display_title    TEXT NOT NULL DEFAULT '',
  excerpt          TEXT NOT NULL DEFAULT '',
  color            TEXT NOT NULL DEFAULT 'none'
                   CHECK (color IN ('none','red','magenta','purple','blue','cyan','teal','green','gray','cool-gray','warm-gray')),
  pinned           INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0,1)),
  version          INTEGER NOT NULL DEFAULT 1,
  indexed_version  INTEGER NOT NULL DEFAULT 0,
  source_filename  TEXT,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  deleted_at       INTEGER,
  server_seq       INTEGER NOT NULL
);
CREATE INDEX notes_folder   ON notes(folder_id) WHERE deleted_at IS NULL;
CREATE INDEX notes_updated  ON notes(pinned DESC, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX notes_seq      ON notes(server_seq);
CREATE INDEX notes_to_index ON notes(id) WHERE indexed_version < version;

CREATE TABLE tags (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 50),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER,
  server_seq  INTEGER NOT NULL
);
CREATE UNIQUE INDEX tags_unique_name ON tags(lower(name)) WHERE deleted_at IS NULL;
CREATE INDEX tags_seq ON tags(server_seq);

CREATE TABLE note_tags (
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id  TEXT NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);
CREATE INDEX note_tags_tag ON note_tags(tag_id);

CREATE VIRTUAL TABLE notes_fts USING fts5(
  title, tags, body, folder,
  tokenize = "unicode61 remove_diacritics 2 tokenchars '-_'"
);

CREATE TABLE index_jobs (
  note_id     TEXT PRIMARY KEY,
  version     INTEGER NOT NULL,
  enqueued_at INTEGER NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  last_error  TEXT
);

CREATE TABLE search_log (
  id         INTEGER PRIMARY KEY,
  query      TEXT NOT NULL,
  mode       TEXT NOT NULL,
  hits       INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  at         INTEGER NOT NULL
);

INSERT INTO meta(key, value) VALUES ('server_seq', '0'), ('oldest_tombstone_seq', '0');
`;
