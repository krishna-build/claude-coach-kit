-- Performance indices for utm_visitors table
-- Fixes slow queries on Attribution page

CREATE INDEX IF NOT EXISTS idx_utm_visitors_payment_status 
  ON utm_visitors(payment_status);

CREATE INDEX IF NOT EXISTS idx_utm_visitors_utm_content 
  ON utm_visitors(utm_content);

CREATE INDEX IF NOT EXISTS idx_utm_visitors_created_at 
  ON utm_visitors(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_utm_visitors_city 
  ON utm_visitors(city);

CREATE INDEX IF NOT EXISTS idx_utm_visitors_compound 
  ON utm_visitors(payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_utm_visitors_visitor_id 
  ON utm_visitors(visitor_id);

ANALYZE utm_visitors;
