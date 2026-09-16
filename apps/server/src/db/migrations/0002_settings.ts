export const sql = `
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  encrypted  INTEGER NOT NULL DEFAULT 0 CHECK (encrypted IN (0,1)),
  updated_at INTEGER NOT NULL
);
`;
