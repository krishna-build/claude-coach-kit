import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, MapPin, Phone, Video, ChevronLeft, ChevronRight,
  CheckCircle2, Loader2, ArrowLeft, Globe, CalendarDays, XCircle,
  RefreshCw, AlertTriangle
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  BookingEvent, BookingAvailability, Booking,
  generateTimeSlotsMulti, formatTime12, addMinutes, filterMinNoticeSlots,
  DAY_NAMES, DAY_NAMES_FULL
} from "@/types/bookings";
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, isBefore, startOfDay, isSameDay, addDays
} from "date-fns";
import { useToast } from "@/components/Toast";

type ManageStep = "view" | "reschedule-date" | "reschedule-time" | "reschedule-confirm" | "cancelled";

export default function BookingManagePage() {
  const { toast } = useToast();
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<ManageStep>("view");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Load booking by manage_token
  const { data: booking, isLoading, error } = useQuery({
    queryKey: ["booking-manage", token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, booking_events(*)")
        .eq("manage_token", token!)
        .maybeSingle();
      if (error) throw error;
      return data as (Booking & { booking_events: BookingEvent }) | null;
    },
    enabled: !!token,
  });

  const event = booking?.booking_events;

  // Load availability for rescheduling
  const { data: availability = [] } = useQuery({
    queryKey: ["manage-availability", event?.id],
    queryFn: async () => {
      const { data } = await supabase.from("booking_availability").select("*").eq("event_id", event!.id);
      return (data || []) as BookingAvailability[];
    },
    enabled: !!event?.id && step.startsWith("reschedule"),
  });

  // Load blocked slots
  const { data: blockedSlots = [] } = useQuery({
    queryKey: ["manage-blocked", event?.id],
    queryFn: async () => {
      const { data } = await supabase.from("booking_blocked_slots").select("*").eq("event_id", event!.id);
      return data || [];
    },
    enabled: !!event?.id && step.startsWith("reschedule"),
  });

  // Load bookings for selected month
  const { data: monthBookings = [] } = useQuery({
    queryKey: ["manage-month-bookings", event?.id, format(currentMonth, "yyyy-MM")],
    queryFn: async () => {
      const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");
      const { data } = await supabase.from("bookings")
        .select("booking_date, start_time, status")
        .eq("event_id", event!.id)
        .gte("booking_date", start)
        .lte("booking_date", end)
        .neq("status", "cancelled");
      return data || [];
    },
    enabled: !!event?.id && step.startsWith("reschedule"),
  });

  // Day bookings for selected date
  const { data: dayBookings = [] } = useQuery({
    queryKey: ["manage-day-bookings", event?.id, selectedDate ? format(selectedDate, "yyyy-MM-dd") : null],
    queryFn: async () => {
      const dateStr = format(selectedDate!, "yyyy-MM-dd");
      const { data } = await supabase.from("bookings")
        .select("start_time")
        .eq("event_id", event!.id)
        .eq("booking_date", dateStr)
        .neq("status", "cancelled")
        .neq("id", booking!.id);
      return data || [];
    },
    enabled: !!event?.id && !!selectedDate,
  });

  // Reschedule mutation
  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate || !selectedTime || !event || !booking) throw new Error("Missing data");
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const endTime = addMinutes(selectedTime, event.duration_minutes);
      const { error } = await supabase.from("bookings").update({
        booking_date: dateStr,
        start_time: selectedTime,
        end_time: endTime,
        rescheduled_from: booking.created_at,
        updated_at: new Date().toISOString(),
      }).eq("id", booking.id);
      if (error) throw error;

      // Log activity
      await supabase.from("booking_activity_log").insert({
        booking_id: booking.id,
        action: "rescheduled",
        details: `Rescheduled from ${booking.booking_date} ${booking.start_time} to ${dateStr} ${selectedTime}`,
        actor: "booker",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-manage"] });
      setStep("view");
      toast.success("Booking rescheduled successfully!");
    },
    onError: (err: any) => toast.error(err.message || "Failed to reschedule"),
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!booking) throw new Error("No booking");
      const { error } = await supabase.from("bookings").update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancel_reason: cancelReason || null,
        updated_at: new Date().toISOString(),
      }).eq("id", booking.id);
      if (error) throw error;

      await supabase.from("booking_activity_log").insert({
        booking_id: booking.id,
        action: "cancelled",
        details: cancelReason || "Cancelled by booker",
        actor: "booker",
      });
    },
    onSuccess: () => {
      setStep("cancelled");
      setShowCancelConfirm(false);
    },
    onError: (err: any) => toast.error(err.message || "Failed to cancel"),
  });

  const accentColor = event?.brand_color || "#6366f1";

  // Calendar helpers
  const getDayAvailability = (date: Date): boolean => {
    if (!event) return false;
    if (isBefore(startOfDay(date), startOfDay(new Date()))) return false;
    const maxDate = addDays(new Date(), event.date_range_days || 60);
    if (date > maxDate) return false;
    const dow = getDay(date);
    const dayAvail = availability.filter(a => a.day_of_week === dow && a.is_available);
    if (dayAvail.length === 0) return false;
    const dateStr = format(date, "yyyy-MM-dd");
    const isBlocked = blockedSlots.some((b: any) => b.blocked_date === dateStr && b.block_all_day);
    if (isBlocked) return false;
    const bookingsOnDay = monthBookings.filter((b: any) => b.booking_date === dateStr);
    return bookingsOnDay.length < (event.max_bookings_per_day || 10);
  };

  const getTimeSlots = (): string[] => {
    if (!selectedDate || !event) return [];
    const dow = getDay(selectedDate);
    const dayAvail = availability.filter(a => a.day_of_week === dow && a.is_available);
    if (dayAvail.length === 0) return [];
    const booked = dayBookings.map((b: any) => b.start_time);
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const dateBlocks = blockedSlots.filter((b: any) => b.blocked_date === dateStr && !b.block_all_day);
    const blockedTimes = dateBlocks.flatMap((b: any) => {
      const slots: string[] = [];
      if (b.start_time && b.end_time) {
        const [sh] = b.start_time.split(":").map(Number);
        const [eh] = b.end_time.split(":").map(Number);
        for (let h = sh; h < eh; h++) {
          slots.push(`${String(h).padStart(2, "0")}:00`);
          slots.push(`${String(h).padStart(2, "0")}:30`);
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

  const calendarDays = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    const firstDow = getDay(start);
    const blanks = Array(firstDow).fill(null);
    return { blanks, days };
  };

  const { blanks, days } = calendarDays();
  const slots = getTimeSlots();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-center p-8">
        <div>
          <div className="text-5xl mb-4">🔗</div>
          <h2 className="text-xl font-bold text-foreground mb-2">Booking not found</h2>
          <p className="text-muted-foreground text-sm">This management link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  if (step === "cancelled") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-center p-8">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto bg-red-500/20">
            <XCircle className="w-10 h-10 text-red-400" />
          </motion.div>
          <h2 className="text-2xl font-bold text-foreground">Booking Cancelled</h2>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Your booking has been cancelled. You can close this page.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Left — Booking Info */}
      <div className="md:w-80 md:min-h-screen border-b md:border-b-0 md:border-r border-border/20 p-6 md:p-8 flex-shrink-0">
        {event?.logo_url && (
          <img src={event.logo_url} alt="Logo" className="h-10 w-auto mb-6 rounded-lg object-contain" />
        )}
        <div className="space-y-4">
          <h1 className="text-xl font-bold text-foreground">{event?.title}</h1>
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="w-4 h-4" style={{ color: accentColor }} />
              {format(new Date(booking.booking_date + "T00:00"), "EEEE, MMMM d, yyyy")}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" style={{ color: accentColor }} />
              {formatTime12(booking.start_time)} – {formatTime12(booking.end_time)}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Globe className="w-4 h-4" style={{ color: accentColor }} />
              {booking.timezone?.replace(/_/g, " ")}
            </div>
          </div>
          <div className="mt-4">
            <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium ${
              booking.status === "confirmed" ? "bg-emerald-500/15 text-emerald-400"
              : booking.status === "cancelled" ? "bg-red-500/15 text-red-400"
              : "bg-muted/40 text-muted-foreground"
            }`}>
              {booking.status === "confirmed" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Right */}
      <div className="flex-1 flex items-start justify-center p-4 md:p-8">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            {/* View Step */}
            {step === "view" && (
              <motion.div key="view" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">Manage Your Booking</h2>
                  <p className="text-sm text-muted-foreground">Booked by {booking.booker_name} ({booking.booker_email})</p>
                </div>

                <div className="bg-card border border-border/30 rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">{event?.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(booking.booking_date + "T00:00"), "EEEE, MMMM d, yyyy")}
                  </p>
                  <p className="text-sm" style={{ color: accentColor }}>
                    {formatTime12(booking.start_time)} – {formatTime12(booking.end_time)}
                  </p>
                  {booking.rescheduled_from && (
                    <p className="text-xs text-orange-400/70 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> This booking was rescheduled
                    </p>
                  )}
                </div>

                {booking.status === "confirmed" && (
                  <div className="space-y-3">
                    <button
                      onClick={() => setStep("reschedule-date")}
                      className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 border-2"
                      style={{ borderColor: accentColor, color: accentColor }}>
                      <RefreshCw className="w-4 h-4" /> Reschedule
                    </button>
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all border-2 border-red-500/40 text-red-400 hover:bg-red-500/10">
                      <XCircle className="w-4 h-4" /> Cancel Booking
                    </button>
                  </div>
                )}

                {booking.status === "cancelled" && (
                  <div className="text-center py-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                    <p className="text-sm text-red-400">This booking has been cancelled</p>
                    {booking.cancel_reason && (
                      <p className="text-xs text-muted-foreground mt-1">Reason: {booking.cancel_reason}</p>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* Reschedule - Date */}
            {step === "reschedule-date" && (
              <motion.div key="resc-date" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => setStep("view")} className="p-2 rounded-lg hover:bg-muted/40 text-muted-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <h2 className="text-base font-semibold text-foreground">Pick a New Date</h2>
                </div>
                <div className="flex items-center justify-between">
                  <button onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
                    disabled={isBefore(endOfMonth(subMonths(currentMonth, 1)), new Date())}
                    className="p-2 rounded-lg hover:bg-muted/40 text-muted-foreground disabled:opacity-30">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-semibold text-foreground">
                    {format(currentMonth, "MMMM yyyy")}
                  </span>
                  <button onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                    className="p-2 rounded-lg hover:bg-muted/40 text-muted-foreground">
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
                        onClick={() => { if (available) { setSelectedDate(day); setStep("reschedule-time"); } }}
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

            {/* Reschedule - Time */}
            {step === "reschedule-time" && selectedDate && (
              <motion.div key="resc-time" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => { setStep("reschedule-date"); setSelectedTime(null); }}
                    className="p-2 rounded-lg hover:bg-muted/40 text-muted-foreground">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">{format(selectedDate, "EEEE, MMMM d")}</h2>
                    <p className="text-xs text-muted-foreground">Select new time</p>
                  </div>
                </div>
                {slots.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-muted-foreground text-sm">No available slots on this day</p>
                    <button onClick={() => setStep("reschedule-date")} className="text-xs mt-2 underline text-primary">Pick another date</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                    {slots.map(slot => (
                      <button key={slot}
                        onClick={() => { setSelectedTime(slot); setStep("reschedule-confirm"); }}
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

            {/* Reschedule - Confirm */}
            {step === "reschedule-confirm" && selectedDate && selectedTime && (
              <motion.div key="resc-confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-6">
                <div className="flex items-center gap-3">
                  <button onClick={() => setStep("reschedule-time")}
                    className="p-2 rounded-lg hover:bg-muted/40 text-muted-foreground">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <h2 className="text-base font-semibold text-foreground">Confirm Reschedule</h2>
                </div>

                <div className="bg-card border border-border/30 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="line-through">
                      {format(new Date(booking.booking_date + "T00:00"), "MMM d")} at {formatTime12(booking.start_time)}
                    </span>
                    <span className="text-foreground">→</span>
                    <span className="font-semibold text-foreground">
                      {format(selectedDate, "MMM d")} at {formatTime12(selectedTime)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => rescheduleMutation.mutate()}
                  disabled={rescheduleMutation.isPending}
                  className="w-full py-3.5 rounded-xl font-semibold text-sm text-foreground flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: accentColor }}>
                  {rescheduleMutation.isPending ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Rescheduling…</>
                  ) : (
                    <><RefreshCw className="w-5 h-5" /> Confirm Reschedule</>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {showCancelConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowCancelConfirm(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-border/40 rounded-2xl p-6 w-full max-w-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Cancel Booking?</h3>
                  <p className="text-xs text-muted-foreground">This action cannot be undone</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Reason (optional)</label>
                <textarea
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="Why are you cancelling?"
                  rows={2}
                  className="w-full bg-muted/30 border border-border/40 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 py-2.5 bg-muted/40 text-muted-foreground rounded-xl text-sm font-medium hover:bg-muted/60">
                  Keep Booking
                </button>
                <button onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                  className="flex-1 py-2.5 bg-red-500 text-foreground rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-60 flex items-center justify-center gap-2">
                  {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
