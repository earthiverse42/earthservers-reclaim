// Database utilities - Shared database schemas and migrations
// This will be used by Tauri backend for SQLite operations

export const SCHEMA_VERSION = 3;

export const MIGRATIONS = {
  v1: `
    -- Domains table for EarthSearch
    CREATE TABLE IF NOT EXISTS domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      trust_score REAL NOT NULL DEFAULT 0.5,
      added_date TEXT NOT NULL,
      metadata TEXT
    );

    -- Pages table for EarthMemory
    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      content TEXT,
      visited_at TEXT NOT NULL,
      embedding BLOB
    );

    -- Notes table for annotations
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
    );

    -- Domain lists for organizing domains
    CREATE TABLE IF NOT EXISTS domain_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      author TEXT,
      version TEXT DEFAULT '1.0',
      created_at TEXT NOT NULL
    );

    -- Many-to-many relationship between lists and domains
    CREATE TABLE IF NOT EXISTS list_domains (
      list_id INTEGER NOT NULL,
      domain_id INTEGER NOT NULL,
      PRIMARY KEY (list_id, domain_id),
      FOREIGN KEY (list_id) REFERENCES domain_lists(id) ON DELETE CASCADE,
      FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
    );

    -- Indexes for better performance
    CREATE INDEX IF NOT EXISTS idx_domains_url ON domains(url);
    CREATE INDEX IF NOT EXISTS idx_domains_category ON domains(category);
    CREATE INDEX IF NOT EXISTS idx_pages_url ON pages(url);
    CREATE INDEX IF NOT EXISTS idx_pages_visited ON pages(visited_at);
    CREATE INDEX IF NOT EXISTS idx_notes_page ON notes(page_id);

    -- Settings table for app configuration
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `,

  v2: `
    -- Profiles table for multi-user support
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon TEXT,
      created_at TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0
    );

    -- Privacy settings per profile
    CREATE TABLE IF NOT EXISTS privacy_settings (
      profile_id INTEGER PRIMARY KEY,
      auto_delete_days INTEGER,
      ai_enabled_in_incognito INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    -- Add profile_id to existing tables (nullable for backward compatibility)
    ALTER TABLE domains ADD COLUMN profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE pages ADD COLUMN profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE;
    ALTER TABLE domain_lists ADD COLUMN profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE;

    -- Create indexes for profile-based queries
    CREATE INDEX IF NOT EXISTS idx_domains_profile ON domains(profile_id);
    CREATE INDEX IF NOT EXISTS idx_pages_profile ON pages(profile_id);
    CREATE INDEX IF NOT EXISTS idx_domain_lists_profile ON domain_lists(profile_id);

    -- Create default profile
    INSERT INTO profiles (name, icon, created_at, is_active)
    VALUES ('Default', 'user', datetime('now'), 1);

    -- Update existing records to use default profile
    UPDATE domains SET profile_id = 1 WHERE profile_id IS NULL;
    UPDATE pages SET profile_id = 1 WHERE profile_id IS NULL;
    UPDATE domain_lists SET profile_id = 1 WHERE profile_id IS NULL;

    -- Create default privacy settings for default profile
    INSERT INTO privacy_settings (profile_id, auto_delete_days, ai_enabled_in_incognito)
    VALUES (1, NULL, 0);
  `,

  v3: `
    -- Themes table for per-profile theme customization
    CREATE TABLE IF NOT EXISTS themes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      base_preset TEXT DEFAULT 'earthservers-default',
      -- Core colors (stored as hex)
      primary_color TEXT NOT NULL DEFAULT '#0fab89',
      secondary_color TEXT NOT NULL DEFAULT '#e91e63',
      accent_color TEXT NOT NULL DEFAULT '#0178C6',
      text_color TEXT NOT NULL DEFAULT '#f0f0f0',
      -- Background settings
      background_color TEXT NOT NULL DEFAULT '#0a0a0f',
      background_gradient_enabled INTEGER NOT NULL DEFAULT 1,
      background_gradient_angle INTEGER NOT NULL DEFAULT 135,
      background_gradient_from TEXT DEFAULT '#0a0a0f',
      background_gradient_to TEXT DEFAULT '#1a1a2e',
      -- Card settings
      card_bg_color TEXT NOT NULL DEFAULT '#1a1a2e',
      card_opacity INTEGER NOT NULL DEFAULT 80,
      card_gradient_enabled INTEGER NOT NULL DEFAULT 0,
      card_gradient_color1 TEXT DEFAULT '#1a1a2e',
      card_gradient_color2 TEXT DEFAULT '#2a2a3e',
      -- Navbar/UI settings
      navbar_color TEXT DEFAULT '#0a0a0f',
      navbar_opacity INTEGER NOT NULL DEFAULT 90,
      -- Additional customization (JSON for extensibility)
      custom_css TEXT,
      extra_settings TEXT,
      -- Timestamps
      created_at TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      UNIQUE(profile_id, name)
    );

    -- Index for faster theme lookups
    CREATE INDEX IF NOT EXISTS idx_themes_profile ON themes(profile_id);
    CREATE INDEX IF NOT EXISTS idx_themes_active ON themes(profile_id, is_active);

    -- Create default theme for existing profiles
    INSERT INTO themes (profile_id, name, is_active, created_at)
    SELECT id, 'Default', 1, datetime('now') FROM profiles;
  `,
};

export interface DatabaseConfig {
  version: number;
  path: string;
}

export default {
  SCHEMA_VERSION,
  MIGRATIONS,
};
