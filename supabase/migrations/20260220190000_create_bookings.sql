-- Bookings System — Cal.com/Calendly clone
-- Creates: booking_events, booking_availability, bookings, booking_blocked_slots

CREATE TABLE IF NOT EXISTS booking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  location_type TEXT DEFAULT 'phone',
  location_value TEXT,
  max_bookings_per_day INTEGER DEFAULT 10,
  buffer_minutes INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  brand_color TEXT DEFAULT '#6366f1',
  logo_url TEXT,
  cover_image_url TEXT,
  custom_headline TEXT,
  thank_you_url TEXT,
  custom_questions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booking_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES booking_events(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,
  start_time TEXT NOT NULL DEFAULT '09:00',
  end_time TEXT NOT NULL DEFAULT '18:00',
  is_available BOOLEAN DEFAULT true,
  UNIQUE(event_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES booking_events(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES automation_contacts(id) ON DELETE SET NULL,
  booker_name TEXT NOT NULL,
  booker_email TEXT NOT NULL,
  booker_phone TEXT,
  booking_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  status TEXT DEFAULT 'confirmed',
  answers JSONB DEFAULT '{}',
  confirmation_sent BOOLEAN DEFAULT false,
  reminder_24h_sent BOOLEAN DEFAULT false,
  reminder_1h_sent BOOLEAN DEFAULT false,
  notes TEXT,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booking_blocked_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES booking_events(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  block_all_day BOOLEAN DEFAULT false,
  start_time TEXT,
  end_time TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_event_date ON bookings(event_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings(booker_email);
CREATE INDEX IF NOT EXISTS idx_booking_events_slug ON booking_events(slug);

ALTER TABLE booking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_blocked_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own events" ON booking_events FOR ALL TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Public can read active events" ON booking_events FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "Users manage own availability" ON booking_availability FOR ALL TO authenticated USING (event_id IN (SELECT id FROM booking_events WHERE created_by = auth.uid()));
CREATE POLICY "Public can read availability" ON booking_availability FOR SELECT TO anon USING (true);
CREATE POLICY "Users see own bookings" ON bookings FOR SELECT TO authenticated USING (event_id IN (SELECT id FROM booking_events WHERE created_by = auth.uid()));
CREATE POLICY "Public can insert bookings anon" ON bookings FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Auth can insert bookings" ON bookings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users manage blocked slots" ON booking_blocked_slots FOR ALL TO authenticated USING (event_id IN (SELECT id FROM booking_events WHERE created_by = auth.uid()));
CREATE POLICY "Public can read blocked slots" ON booking_blocked_slots FOR SELECT TO anon USING (true);
