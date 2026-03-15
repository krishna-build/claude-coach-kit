export interface CustomQuestion {
  id: string;
  question: string;
  type: "text" | "textarea" | "select" | "checkbox";
  options?: string[];
  required: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

export interface BookingEvent {
  id: string;
  created_by: string;
  title: string;
  slug: string;
  description?: string;
  duration_minutes: number;
  location_type: "phone" | "zoom" | "meet" | "in_person";
  location_value?: string;
  max_bookings_per_day: number;
  buffer_minutes: number;
  is_active: boolean;
  brand_color: string;
  logo_url?: string;
  cover_image_url?: string;
  custom_headline?: string;
  thank_you_url?: string;
  custom_questions: CustomQuestion[];
  // Phase 1
  minimum_notice_hours: number;
  date_range_days: number;
  // Phase 3
  require_payment: boolean;
  payment_amount: number;
  payment_currency: string;
  webhook_url?: string;
  team_members: TeamMember[];
  sms_notifications_enabled: boolean;
  sms_phone_number?: string;
  created_at: string;
  updated_at: string;
}

export interface BookingAvailability {
  id: string;
  event_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

export interface Booking {
  id: string;
  event_id: string;
  contYOUR_AD_ACCOUNT_IDid?: string;
  booker_name: string;
  booker_email: string;
  booker_phone?: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  status: "confirmed" | "cancelled" | "completed" | "no_show";
  answers: Record<string, string>;
  notes?: string;
  confirmation_sent?: boolean;
  manage_token?: string;
  admin_notes?: string;
  rescheduled_from?: string;
  payment_status?: string;
  payment_id?: string;
  assigned_team_member?: string;
  cancelled_at?: string;
  cancel_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface BookingBlockedSlot {
  id: string;
  event_id: string;
  blocked_date: string;
  block_all_day: boolean;
  start_time?: string;
  end_time?: string;
  reason?: string;
}

export interface BookingEmailSettings {
  id: string;
  event_id: string;
  confirmation_enabled: boolean;
  admin_notification_enabled: boolean;
  admin_email?: string;
  confirmation_subject: string;
  confirmation_body: string;
  admin_subject: string;
  admin_body: string;
  created_at: string;
  updated_at: string;
}

export interface BookingActivityLog {
  id: string;
  booking_id: string;
  action: string;
  details?: string;
  actor: string;
  created_at: string;
}

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const TIMEZONE_OPTIONS = [
  "Pacific/Honolulu", "America/Anchorage", "America/Los_Angeles", "America/Denver",
  "America/Chicago", "America/New_York", "America/Sao_Paulo",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Moscow",
  "Asia/Dubai", "Asia/Kolkata", "Asia/Calcutta", "Asia/Bangkok", "Asia/Shanghai",
  "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland"
];

export function generateSlug(title: string, ownerName?: string): string {
  const base = ownerName ? `${ownerName}-${title}` : title;
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function generateTimeSlots(
  startTime: string,
  endTime: string,
  durationMins: number,
  bufferMins: number,
  bookedTimes: string[]
): string[] {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let cur = sh * 60 + sm;
  const end = eh * 60 + em;
  const slots: string[] = [];
  while (cur + durationMins <= end) {
    const hh = String(Math.floor(cur / 60)).padStart(2, "0");
    const mm = String(cur % 60).padStart(2, "0");
    const t = `${hh}:${mm}`;
    if (!bookedTimes.includes(t)) slots.push(t);
    cur += durationMins + bufferMins;
  }
  return slots;
}

/** Generate time slots from multiple availability blocks */
export function generateTimeSlotsMulti(
  availBlocks: { start_time: string; end_time: string }[],
  durationMins: number,
  bufferMins: number,
  bookedTimes: string[]
): string[] {
  const allSlots: string[] = [];
  for (const block of availBlocks) {
    const slots = generateTimeSlots(block.start_time, block.end_time, durationMins, bufferMins, bookedTimes);
    allSlots.push(...slots);
  }
  // Deduplicate and sort
  return [...new Set(allSlots)].sort();
}

export function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Filter slots that are within minimum notice period */
export function filterMinNoticeSlots(
  slots: string[],
  selectedDate: Date,
  minimumNoticeHours: number
): string[] {
  const now = new Date();
  const minTime = new Date(now.getTime() + minimumNoticeHours * 60 * 60 * 1000);
  
  return slots.filter(slot => {
    const [h, m] = slot.split(":").map(Number);
    const slotDate = new Date(selectedDate);
    slotDate.setHours(h, m, 0, 0);
    return slotDate > minTime;
  });
}

/** Send webhook on booking creation */
export async function sendBookingWebhook(webhookUrl: string, bookingData: any): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "booking.created", data: bookingData, timestamp: new Date().toISOString() }),
    });
  } catch (err) {
    console.error("Webhook failed:", err);
  }
}
