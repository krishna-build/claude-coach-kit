import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, MapPin, Phone, Video, ChevronLeft, ChevronRight,
  CheckCircle2, CalendarPlus, Loader2, ArrowLeft, Globe, ChevronDown
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  BookingEvent, BookingAvailability, Booking, BookingBlockedSlot, CustomQuestion,
  generateTimeSlotsMulti, filterMinNoticeSlots, formatTime12, addMinutes,
  sendBookingWebhook, DAY_NAMES, TIMEZONE_OPTIONS
} from "@/types/bookings";
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, isBefore, startOfDay, isSameDay, addDays
} from "date-fns";
import { useToast } from "@/components/Toast";

type Step = "date" | "time" | "form" | "confirmed";

interface FormData {
  name: string;
  email: string;
  phone: string;
  answers: Record<string, string>;
}

export default function PublicBookingPage() {
  const { toast } = useToast();
  const { slug } = useParams<{ slug: string }>();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("date");
  const [form, setForm] = useState<FormData>({ name: "", email: "", phone: "", answers: {} });
  const [booking, setBooking] = useState<Booking | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [userTZ, setUserTZ] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [showTZPicker, setShowTZPicker] = useState(false);

  // Load event
  const { data: event, isLoading: loadingEvent, error: eventError } = useQuery({
    queryKey: ["public-event", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_events").select("*").eq("slug", slug!).eq("is_active", true).maybeSingle();
      if (error) throw error;
      return data as BookingEvent | null;
    },
    enabled: !!slug,
  });

  // Load availability
  const { data: availability = [] } = useQuery({
    queryKey: ["public-availability", event?.id],
    queryFn: async () => {
      const { data } = await supabase.from("booking_availability").select("*").eq("event_id", event!.id);
      return (data || []) as BookingAvailability[];
    },
    enabled: !!event?.id,
  });

  // Load blocked slots
  const { data: blockedSlots = [] } = useQuery({
    queryKey: ["public-blocked", event?.id],
    queryFn: async () => {
      const { data } = await supabase.from("booking_blocked_slots").select("*").eq("event_id", event!.id);
      return (data || []) as BookingBlockedSlot[];
    },
    enabled: !!event?.id,
  });

  // Load bookings for selected month
  const { data: monthBookings = [] } = useQuery({
    queryKey: ["public-bookings-month", event?.id, format(currentMonth, "yyyy-MM")],
    queryFn: async () => {
      const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");
      const { data } = await supabase.from("bookings")
        .select("booking_date, start_time, status")
        .eq("event_id", event!.id).gte("booking_date", start).lte("booking_date", end)
        .neq("status", "cancelled");
      return data || [];
    },
    enabled: !!event?.id,
  });

  // Load time slots for selected date
  const { data: dayBookings = [] } = useQuery({
    queryKey: ["public-bookings-day", event?.id, selectedDate ? format(selectedDate, "yyyy-MM-dd") : null],
    queryFn: async () => {
      const dateStr = format(selectedDate!, "yyyy-MM-dd");
      const { data } = await supabase.from("bookings")
        .select("start_time").eq("event_id", event!.id).eq("booking_date", dateStr)
        .neq("status", "cancelled");
      return data || [];
    },
    enabled: !!event?.id && !!selectedDate,
  });

  // Countdown redirect
  useEffect(() => {
    if (step === "confirmed" && event?.thank_you_url && countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
    if (step === "confirmed" && event?.thank_you_url && countdown === 0) {
      window.location.href = event.thank_you_url;
    }
  }, [step, countdown, event?.thank_you_url]);

  const createBooking = useMutation({
    mutationFn: async () => {
      if (!event || !selectedDate || !selectedTime) throw new Error("Missing data");
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const endTime = addMinutes(selectedTime, event.duration_minutes);
      const manageToken = crypto.randomUUID();

      // 1. Create or find contact
      const { data: existingContacts } = await supabase
        .from("automation_contacts").select("id, tags")
        .eq("email", form.email.toLowerCase()).limit(1);

      let contactId: string | null = null;
      if (existingContacts && existingContacts.length > 0) {
        const ex = existingContacts[0];
        const tags = Array.from(new Set([...(ex.tags || []), "call-booked"]));
        await supabase.from("automation_contacts")
          .update({ tags, updated_at: new Date().toISOString() }).eq("id", ex.id);
        contactId = ex.id;
      } else {
        const { data: newContact } = await supabase.from("automation_contacts")
          .insert({
            email: form.email.toLowerCase(),
            first_name: form.name.split(" ")[0],
            last_name: form.name.split(" ").slice(1).join(" ") || null,
            phone: form.phone || null,
            tags: ["call-booked"], source: "booking", status: "active",
          }).select("id").single();
        contactId = newContact?.id || null;
      }

      // 2. Determine team member assignment (round-robin)
      let assignedTeamMember: string | null = null;
      if (event.team_members && event.team_members.length > 0) {
        const { count } = await supabase.from("bookings")
          .select("*", { count: "exact", head: true }).eq("event_id", event.id);
        const idx = (count || 0) % event.team_members.length;
        assignedTeamMember = event.team_members[idx].email;
      }

      // 3. Insert booking
      const { data: bookingData, error } = await supabase.from("bookings")
        .insert({
          event_id: event.id, contYOUR_AD_ACCOUNT_IDid: contactId, booker_name: form.name,
          booker_email: form.email.toLowerCase(), booker_phone: form.phone || null,
          booking_date: dateStr, start_time: selectedTime, end_time: endTime,
          timezone: userTZ, status: "confirmed", answers: form.answers,
          manage_token: manageToken, assigned_team_member: assignedTeamMember,
        }).select("*").single();
      if (error) throw error;

      // 4. Log activity
      await supabase.from("booking_activity_log").insert({
        booking_id: bookingData.id,
        action: "booking_created",
        details: `Booking created by ${form.name} (${form.email})`,
        actor: "booker",
      });

      // 5. Send webhook
      if (event.webhook_url) {
        sendBookingWebhook(event.webhook_url, { ...bookingData, event_title: event.title });
      }

      return bookingData as Booking;
    },
    onSuccess: (data) => {
      setBooking(data);
      setStep("confirmed");
    },
    onError: (err: any) => toast.error(err.message || "Failed to create booking."),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) { toast.error("Name and email are required"); return; }
    await createBooking.mutateAsync();
  };

  // Calendar helpers
  const getDayAvailability = (date: Date): boolean => {
    if (!event) return false;
    if (isBefore(startOfDay(date), startOfDay(new Date()))) return false;
    const maxDate = addDays(new Date(), event.date_range_days || 60);
    if (date > maxDate) return false;
    const dow = getDay(date);
    const dayAvail = availability.filter(a => a.day_of_week === dow && a.is_available);
    if (dayAvail.length === 0) return false;
    // Check blocked
    const dateStr = format(date, "yyyy-MM-dd");
    const isBlocked = blockedSlots.some(b => b.blocked_date === dateStr && b.block_all_day);
    if (isBlocked) return false;
    const bookingsOnDay = monthBookings.filter(b => b.booking_date === dateStr);
    return bookingsOnDay.length < (event.max_bookings_per_day || 10);
  };

  const calendarDays = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    const firstDow = getDay(start);
    const blanks = Array(firstDow).fill(null);
    return { blanks, days };
  };

  const getTimeSlots = (): string[] => {
    if (!selectedDate || !event) return [];
    const dow = getDay(selectedDate);
    const dayAvail = availability.filter(a => a.day_of_week === dow && a.is_available);
    if (dayAvail.length === 0) return [];
    const booked = dayBookings.map((b: any) => b.start_time);
    // Also check partial blocked slots
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const dateBlocks = blockedSlots.filter(b => b.blocked_date === dateStr && !b.block_all_day);
    const blockedTimes = dateBlocks.flatMap(b => {
      const slots: string[] = [];
      if (b.start_time && b.end_time) {
        const [sh, sm] = b.start_time.split(":").map(Number);
        const [eh, em] = b.end_time.split(":").map(Number);
        let cur = sh * 60 + sm;
        const endMin = eh * 60 + em;
        while (cur < endMin) {
          slots.push(`${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`);
          cur += 15;
        }
      }
      return slots;
    });
    const allBooked = [...booked, ...blockedTimes];
    const blocks = dayAvail.map(a => ({ start_time: a.start_time, end_time: a.end_time }));
    let slots = generateTimeSlotsMulti(blocks, event.duration_minutes, event.buffer_minutes, allBooked);
    slots = filterMinNoticeSlots(slots, selectedDate, event.minimum_notice_hours || 0);
    return slots;
  };

  const makeGCalUrl = () => {
    if (!booking || !event || !selectedDate) return "#";
    const dateStr = format(selectedDate, "yyyyMMdd");
    const start = `${dateStr}T${booking.start_time.replace(":", "")}00`;
    const endTime = addMinutes(booking.start_time, event.duration_minutes);
    const endT = `${dateStr}T${endTime.replace(":", "")}00`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${start}/${endT}&details=${encodeURIComponent(`Booked via ${window.location.origin}`)}`;
  };

  const makeOutlookUrl = () => {
    if (!booking || !event || !selectedDate) return "#";
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const endTime = addMinutes(booking.start_time, event.duration_minutes);
    return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${dateStr}T${booking.start_time}:00&enddt=${dateStr}T${endTime}:00&body=${encodeURIComponent(`Booked via ${window.location.origin}`)}`;
  };

  const accentColor = event?.brand_color || "#6366f1";
  const { blanks, days } = calendarDays();
  const slots = getTimeSlots();

  if (loadingEvent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-2 border-primary/20 flex items-center justify-center mx-auto">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
            <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-primary/40 mx-auto animate-ping" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Loading booking page…</p>
        </div>
      </div>
    );
  }

  if (eventError || !event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-center p-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-6xl mb-4">📅</div>
          <h2 className="text-xl font-bold text-foreground mb-2">Booking page not found</h2>
          <p className="text-muted-foreground text-sm max-w-sm">This link may be incorrect or the event may have been deactivated.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Left — Event Info */}
      <div className="md:w-80 md:min-h-screen border-b md:border-b-0 md:border-r border-border/20 p-6 md:p-8 flex-shrink-0">
        {event.cover_image_url && (
          <div className="mb-6 rounded-xl overflow-hidden border border-border/20">
            <img src={event.cover_image_url} alt="Cover" className="w-full h-32 object-cover" />
          </div>
        )}
        {event.logo_url && (
          <img src={event.logo_url} alt="Logo" className="h-10 w-auto mb-6 rounded-lg object-contain" />
        )}
        <div className="space-y-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">{event.custom_headline || event.title}</h1>
            {event.custom_headline && <p className="text-sm text-muted-foreground mt-0.5">{event.title}</p>}
          </div>
          {event.description && <p className="text-sm text-muted-foreground leading-relaxed">{event.description}</p>}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" style={{ color: accentColor }} />
              {event.duration_minutes} minutes
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {event.location_type === "phone" && <Phone className="w-4 h-4" style={{ color: accentColor }} />}
              {(event.location_type === "zoom" || event.location_type === "meet") && <Video className="w-4 h-4" style={{ color: accentColor }} />}
              {event.location_type === "in_person" && <MapPin className="w-4 h-4" style={{ color: accentColor }} />}
              {event.location_type === "phone" ? "Phone Call" : event.location_type === "zoom" ? "Zoom" : event.location_type === "meet" ? "Google Meet" : event.location_value || "In-Person"}
            </div>
            {/* Timezone Selector */}
            <div className="relative">
              <button onClick={() => setShowTZPicker(!showTZPicker)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full">
                <Globe className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
                <span className="truncate">{userTZ.replace(/_/g, " ")}</span>
                <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${showTZPicker ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {showTZPicker && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    className="absolute z-50 mt-2 left-0 right-0 bg-card border border-border/40 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                    {TIMEZONE_OPTIONS.map(tz => (
                      <button key={tz} onClick={() => { setUserTZ(tz); setShowTZPicker(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                          tz === userTZ ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
                        }`}>
                        {tz.replace(/_/g, " ")}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Payment badge */}
          {event.require_payment && event.payment_amount > 0 && (
            <div className="mt-3 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <p className="text-xs font-medium text-amber-400">
                💳 {event.payment_currency === "INR" ? "₹" : event.payment_currency === "USD" ? "$" : event.payment_currency === "EUR" ? "€" : "£"}
                {event.payment_amount} required to confirm
              </p>
            </div>
          )}

          {selectedDate && selectedTime && step !== "confirmed" && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 rounded-xl border border-border/30 bg-muted/20">
              <p className="text-xs text-muted-foreground">Selected</p>
              <p className="text-sm font-semibold text-foreground mt-1">{format(selectedDate, "EEEE, MMMM d")}</p>
              <p className="text-sm" style={{ color: accentColor }}>
                {formatTime12(selectedTime)} – {formatTime12(addMinutes(selectedTime, event.duration_minutes))}
              </p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Right — Booking Flow */}
      <div className="flex-1 flex items-start justify-center p-4 md:p-8">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            {/* STEP: Date */}
            {step === "date" && (
              <motion.div key="date" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-4">
                <h2 className="text-base font-semibold text-foreground">Select a Date</h2>
                <div className="flex items-center justify-between">
                  <button onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
                    disabled={isBefore(endOfMonth(subMonths(currentMonth, 1)), new Date())}
                    className="p-2 rounded-lg hover:bg-muted/40 text-muted-foreground disabled:opacity-30 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-semibold text-foreground">
                    {format(currentMonth, "MMMM yyyy")}
                  </span>
                  <button onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                    className="p-2 rounded-lg hover:bg-muted/40 text-muted-foreground transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-7 text-center">
                  {DAY_NAMES.map(d => (
                    <div key={d} className="text-[10px] font-semibold text-muted-foreground/60 py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {blanks.map((_, i) => <div key={`b-${i}`} />)}
                  {days.map(day => {
                    const available = getDayAvailability(day);
                    const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                    const isToday = isSameDay(day, new Date());
                    return (
                      <button key={day.toISOString()}
                        onClick={() => { if (available) { setSelectedDate(day); setStep("time"); } }}
                        disabled={!available}
                        className={`aspect-square rounded-xl text-sm font-medium transition-all flex items-center justify-center
                          ${isSelected ? "text-foreground" : available ? "text-foreground hover:text-foreground" : "text-muted-foreground/30 cursor-not-allowed"}
                          ${isToday && !isSelected ? "ring-1 ring-primary/50" : ""}
                        `}
                        style={isSelected ? { backgroundColor: accentColor } : available ? { backgroundColor: `${accentColor}20` } : undefined}>
                        {format(day, "d")}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* STEP: Time */}
            {step === "time" && selectedDate && (
              <motion.div key="time" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => { setStep("date"); setSelectedTime(null); }}
                    className="p-2 rounded-lg hover:bg-muted/40 text-muted-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">{format(selectedDate, "EEEE, MMMM d")}</h2>
                    <p className="text-xs text-muted-foreground">{userTZ.replace(/_/g, " ")}</p>
                  </div>
                </div>
                {slots.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="text-4xl mb-3">😔</div>
                    <p className="text-muted-foreground text-sm">No available slots on this day</p>
                    <button onClick={() => setStep("date")} className="text-xs mt-2 underline text-primary">Pick another date</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                    {slots.map(slot => (
                      <button key={slot}
                        onClick={() => { setSelectedTime(slot); setStep("form"); }}
                        className="py-3 px-4 rounded-xl border text-sm font-medium transition-all hover:text-foreground"
                        style={{ borderColor: `${accentColor}50`, color: accentColor, backgroundColor: `${accentColor}10` }}
                        onMouseEnter={e => { (e.target as any).style.backgroundColor = accentColor; (e.target as any).style.color = "white"; }}
                        onMouseLeave={e => { (e.target as any).style.backgroundColor = `${accentColor}10`; (e.target as any).style.color = accentColor; }}>
                        {formatTime12(slot)}
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP: Form */}
            {step === "form" && selectedDate && selectedTime && (
              <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <button type="button" onClick={() => setStep("time")}
                      className="p-2 rounded-lg hover:bg-muted/40 text-muted-foreground transition-colors">
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <h2 className="text-base font-semibold text-foreground">Your Details</h2>
                      <p className="text-xs text-muted-foreground">
                        {format(selectedDate, "EEE, MMM d")} · {formatTime12(selectedTime)}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {[
                      { key: "name", label: "Your Name *", type: "text", placeholder: "Full name" },
                      { key: "email", label: "Email *", type: "email", placeholder: "you@email.com" },
                      { key: "phone", label: "Phone", type: "tel", placeholder: "+91 98765 43210" },
                    ].map(({ key, label, type, placeholder }) => (
                      <div key={key} className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">{label}</label>
                        <input type={type} value={(form as any)[key]} placeholder={placeholder}
                          onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                          required={label.includes("*")}
                          className="w-full bg-muted/30 border border-border/40 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                          style={{ borderColor: undefined }}
                          onFocus={e => (e.target.style.borderColor = `${accentColor}80`)}
                          onBlur={e => (e.target.style.borderColor = "")} />
                      </div>
                    ))}
                    {(event.custom_questions as CustomQuestion[]).map(q => (
                      <div key={q.id} className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          {q.question} {q.required && "*"}
                        </label>
                        {q.type === "textarea" ? (
                          <textarea rows={3} value={form.answers[q.id] || ""} required={q.required}
                            onChange={e => setForm(prev => ({ ...prev, answers: { ...prev.answers, [q.id]: e.target.value } }))}
                            className="w-full bg-muted/30 border border-border/40 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                        ) : q.type === "select" && q.options ? (
                          <select value={form.answers[q.id] || ""} required={q.required}
                            onChange={e => setForm(prev => ({ ...prev, answers: { ...prev.answers, [q.id]: e.target.value } }))}
                            className="w-full bg-muted/30 border border-border/40 rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none">
                            <option value="">Select...</option>
                            {q.options.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input type="text" value={form.answers[q.id] || ""} required={q.required}
                            onChange={e => setForm(prev => ({ ...prev, answers: { ...prev.answers, [q.id]: e.target.value } }))}
                            className="w-full bg-muted/30 border border-border/40 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
                        )}
                      </div>
                    ))}
                  </div>
                  <button type="submit" disabled={createBooking.isPending}
                    className="w-full py-3.5 rounded-xl font-semibold text-sm text-foreground flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60 mt-2"
                    style={{ backgroundColor: accentColor }}>
                    {createBooking.isPending ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Confirming…</>
                    ) : (
                      <><CheckCircle2 className="w-5 h-5" /> Confirm Booking</>
                    )}
                  </button>
                  <p className="text-[10px] text-center text-muted-foreground/50">
                    You'll receive a confirmation with a link to manage your booking.
                  </p>
                </form>
              </motion.div>
            )}

            {/* STEP: Confirmed */}
            {step === "confirmed" && booking && selectedDate && (
              <motion.div key="confirmed" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-6 py-8">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}
                  className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
                  style={{ backgroundColor: `${accentColor}20` }}>
                  <CheckCircle2 className="w-10 h-10" style={{ color: accentColor }} />
                </motion.div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">You're booked! 🎉</h2>
                  <p className="text-sm text-muted-foreground mt-2">
                    A confirmation has been sent to <strong>{booking.booker_email}</strong>
                  </p>
                </div>
                <div className="bg-card border border-border/30 rounded-2xl p-5 text-left space-y-3">
                  <p className="text-sm font-semibold text-foreground">{event.title}</p>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CalendarPlus className="w-4 h-4" style={{ color: accentColor }} />
                      {format(selectedDate, "EEEE, MMMM d, yyyy")}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" style={{ color: accentColor }} />
                      {formatTime12(booking.start_time)} – {formatTime12(addMinutes(booking.start_time, event.duration_minutes))}
                      {" "}({userTZ.replace(/_/g, " ")})
                    </div>
                  </div>
                </div>
                {/* Calendar buttons */}
                <div className="space-y-2">
                  <a href={makeGCalUrl()} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-border/40 text-sm font-medium text-foreground hover:bg-muted/20 transition-colors">
                    <CalendarPlus className="w-4 h-4" /> Add to Google Calendar
                  </a>
                  <a href={makeOutlookUrl()} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-border/40 text-sm font-medium text-foreground hover:bg-muted/20 transition-colors">
                    <CalendarPlus className="w-4 h-4" /> Add to Outlook
                  </a>
                </div>
                {/* Manage link */}
                {booking.manage_token && (
                  <div className="text-center">
                    <a href={`/book/manage/${booking.manage_token}`}
                      className="text-xs underline" style={{ color: accentColor }}>
                      Reschedule or cancel this booking
                    </a>
                  </div>
                )}
                {event.thank_you_url && (
                  <p className="text-xs text-muted-foreground/60">Redirecting in {countdown}s…</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
