-- Email Performance Analyzer (EmailBison) schema
-- Run this in the Supabase SQL editor

-- Email performance data table (stores merged sender-email + warmup metrics)
CREATE TABLE IF NOT EXISTS email_performance (
  id              SERIAL PRIMARY KEY,
  workspace_id    TEXT NOT NULL,
  workspace_name  TEXT,
  sender_id       TEXT NOT NULL,
  email           TEXT NOT NULL,
  domain          TEXT NOT NULL,
  total_sent      INT NOT NULL DEFAULT 0,
  total_replies   INT NOT NULL DEFAULT 0,
  reply_rate      NUMERIC(6,2) NOT NULL DEFAULT 0,
  total_bounced   INT NOT NULL DEFAULT 0,
  bounce_rate     NUMERIC(6,2) NOT NULL DEFAULT 0,
  warmup_score    NUMERIC(6,2) NOT NULL DEFAULT 0,
  tags            JSONB NOT NULL DEFAULT '[]'::JSONB,
  status          TEXT,
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, sender_id)
);

CREATE INDEX IF NOT EXISTS idx_ep_domain ON email_performance(domain);
CREATE INDEX IF NOT EXISTS idx_ep_workspace ON email_performance(workspace_id);

-- Expand sync_execution_log type CHECK to allow 'email_analyzer_sync'
ALTER TABLE sync_execution_log DROP CONSTRAINT IF EXISTS sync_execution_log_type_check;
ALTER TABLE sync_execution_log ADD CONSTRAINT sync_execution_log_type_check
  CHECK (type IN ('contact_sync', 'performance_sync', 'email_analyzer_sync'));

-- Expand sync_schedules type CHECK for future scheduling support
ALTER TABLE sync_schedules DROP CONSTRAINT IF EXISTS sync_schedules_type_check;
ALTER TABLE sync_schedules ADD CONSTRAINT sync_schedules_type_check
  CHECK (type IN ('contact_sync', 'performance_sync', 'email_analyzer_sync'));

-- Expand sync_execution_log status CHECK to allow 'queued'
ALTER TABLE sync_execution_log DROP CONSTRAINT IF EXISTS sync_execution_log_status_check;
ALTER TABLE sync_execution_log ADD CONSTRAINT sync_execution_log_status_check
  CHECK (status IN ('queued', 'running', 'completed', 'failed'));

-- Add imap_server column (nullable, idempotent)
ALTER TABLE email_performance ADD COLUMN IF NOT EXISTS imap_server TEXT;
