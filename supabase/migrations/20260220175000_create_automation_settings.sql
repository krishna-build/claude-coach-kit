-- Create automation_settings table for storing app configuration (SMTP, etc.)
CREATE TABLE IF NOT EXISTS automation_settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE automation_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write
CREATE POLICY "Authenticated users can read settings"
  ON automation_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can upsert settings"
  ON automation_settings FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update settings"
  ON automation_settings FOR UPDATE
  TO authenticated USING (true);
