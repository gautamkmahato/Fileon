-- Drive UI cleanup catalog
-- IndexedDB now; PostgreSQL later. Column names and types stay the same.

CREATE TABLE cleanup_scans (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  file_count INTEGER NOT NULL DEFAULT 0,
  truncated BOOLEAN NOT NULL DEFAULT FALSE,
  error TEXT,
  schema_version INTEGER NOT NULL,
  drive_page_token TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('full', 'incremental', 'reanalyze'))
);

CREATE INDEX cleanup_scans_user_finished
  ON cleanup_scans (user_id, finished_at DESC);

CREATE TABLE cleanup_files (
  user_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT,
  md5 TEXT,
  created_at TIMESTAMPTZ,
  modified_at TIMESTAMPTZ,
  viewed_by_me_at TIMESTAMPTZ,
  parents TEXT[] NOT NULL DEFAULT '{}',
  starred BOOLEAN NOT NULL DEFAULT FALSE,
  shared BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit BOOLEAN,
  can_download BOOLEAN,
  shortcut_target_id TEXT,
  trashed BOOLEAN NOT NULL DEFAULT FALSE,
  flags JSONB NOT NULL DEFAULT '{}',
  last_seen_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, file_id)
);

CREATE INDEX cleanup_files_user ON cleanup_files (user_id);
CREATE INDEX cleanup_files_md5 ON cleanup_files (user_id, md5);

CREATE TABLE cleanup_groups (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  scan_id UUID NOT NULL REFERENCES cleanup_scans (id) ON DELETE CASCADE,
  detector TEXT NOT NULL,
  label TEXT NOT NULL,
  reason TEXT NOT NULL,
  family TEXT,
  keep_file_id TEXT
);

CREATE INDEX cleanup_groups_scan ON cleanup_groups (user_id, scan_id);

CREATE TABLE cleanup_findings (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  scan_id UUID NOT NULL REFERENCES cleanup_scans (id) ON DELETE CASCADE,
  detector TEXT NOT NULL,
  file_id TEXT NOT NULL,
  group_id UUID REFERENCES cleanup_groups (id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  rank INTEGER,
  extra JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX cleanup_findings_scan ON cleanup_findings (user_id, scan_id, detector);

CREATE TABLE cleanup_health (
  user_id TEXT NOT NULL,
  scan_id UUID NOT NULL REFERENCES cleanup_scans (id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  counts JSONB NOT NULL,
  breakdown JSONB NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, scan_id)
);

CREATE TABLE cleanup_decisions (
  user_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  detector TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('dismiss', 'keep', 'snooze')),
  snooze_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, file_id, detector)
);

CREATE TABLE cleanup_sync_state (
  user_id TEXT PRIMARY KEY,
  latest_scan_id UUID,
  drive_start_page_token TEXT,
  last_incremental_at TIMESTAMPTZ,
  last_full_scan_at TIMESTAMPTZ,
  schema_version INTEGER NOT NULL
);

-- Smart Spaces: saved rule configs only. Never store Drive file bytes.
CREATE TABLE smart_spaces (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT,
  color TEXT,
  match_mode TEXT NOT NULL CHECK (match_mode IN ('and', 'or')),
  layout TEXT NOT NULL CHECK (layout IN ('grid', 'list', 'gallery')),
  sort_field TEXT NOT NULL,
  sort_dir TEXT NOT NULL CHECK (sort_dir IN ('asc', 'desc')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  cached_file_count INTEGER,
  cached_size_bytes BIGINT,
  cached_truncated BOOLEAN NOT NULL DEFAULT FALSE,
  cached_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX smart_spaces_user_order
  ON smart_spaces (user_id, sort_order);

CREATE TABLE smart_space_rules (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  space_id UUID NOT NULL REFERENCES smart_spaces (id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  op TEXT NOT NULL,
  value JSONB NOT NULL,
  position INTEGER NOT NULL
);

CREATE INDEX smart_space_rules_space
  ON smart_space_rules (user_id, space_id);

-- App-layer share links. Independent of Google Drive "anyone with the link".
-- Never store file bytes. Token is the public capability; manage_key is owner-only.
CREATE TABLE share_links (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL,
  manage_key TEXT NOT NULL,
  file_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  expires_at TIMESTAMPTZ,
  allow_download BOOLEAN NOT NULL DEFAULT TRUE,
  view_count INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX share_links_token ON share_links (token);
CREATE INDEX share_links_user ON share_links (user_id, created_at DESC);
CREATE INDEX share_links_file ON share_links (user_id, file_id);
