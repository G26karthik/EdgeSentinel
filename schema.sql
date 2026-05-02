-- schema.sql

CREATE TABLE IF NOT EXISTS requests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ip          TEXT NOT NULL,
  country     TEXT,
  path        TEXT,
  user_agent  TEXT,
  score       REAL NOT NULL,
  class       TEXT NOT NULL CHECK(class IN ('LEGITIMATE', 'SUSPICIOUS', 'BOT')),
  source      TEXT NOT NULL CHECK(source IN ('CACHE', 'HEURISTIC', 'AI', 'VECTOR')),
  timestamp   INTEGER NOT NULL  -- Unix ms
);

CREATE INDEX IF NOT EXISTS idx_class     ON requests(class);
CREATE INDEX IF NOT EXISTS idx_ip        ON requests(ip);
CREATE INDEX IF NOT EXISTS idx_timestamp ON requests(timestamp);
