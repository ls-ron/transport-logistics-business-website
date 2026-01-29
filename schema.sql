-- Cloudflare D1 Database Schema for Quote Submissions
-- Run this migration to create the quotes table

CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  company TEXT,
  pickup TEXT NOT NULL,
  delivery TEXT NOT NULL,
  freight_type TEXT NOT NULL, -- JSON array stored as text
  ip_address TEXT,
  submitted_at TEXT NOT NULL, -- ISO 8601 timestamp
  created_at INTEGER DEFAULT (strftime('%s', 'now')) -- Unix timestamp for sorting
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_submitted_at ON quotes(submitted_at);
CREATE INDEX IF NOT EXISTS idx_email ON quotes(email);
CREATE INDEX IF NOT EXISTS idx_created_at ON quotes(created_at);
