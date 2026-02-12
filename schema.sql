CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  pickup TEXT NOT NULL,
  delivery TEXT NOT NULL,
  freight_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);
