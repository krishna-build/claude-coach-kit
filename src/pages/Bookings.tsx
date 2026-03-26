import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/Toast";
import Layout from "@/components/Layout";
import {
  CalendarDays, Plus, Copy, Edit2, ExternalLink, ToggleLeft, ToggleRight,
  Clock, Users, CheckCircle2, XCircle, AlertCircle, Loader2,
  Calendar, TrendingUp, Code2, Link2, Trash2, Search, Filter,
  Download, ChevronLeft, ChevronRight, Eye, ArrowUpDown, ArrowLeft, Home
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { BookingEvent, Booking, formatTime12 } from "@/types/bookings";
import {
  format, parseISO, isToday, isTomorrow, addDays, startOfDay, startOfWeek,
  endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, getDay,
  startOfMonth, endOfMonth, addMonths, subMonths
} from "date-fns";

const LOCATION_LABELS: Record<string, string> = {
  phone: "📞 Phone",
  zoom: "🎥 Zoom",
  meet: "📹 Meet",
  in_person: "📍 In-Person",
};

const STATUS_CONFIGS: Record<string, { color: string; bg: string; label: string }> = {
  confirmed: { color: "text-emerald-400", bg: "bg-emerald-500/15", label: "Confirmed" },
  completed: { color: "text-blue-400", bg: "bg-blue-500/15", label: "Completed" },
  cancelled: { color: "text-red-400", bg: "bg-red-500/15", label: "Cancelled" },
  no_show: { color: "text-orange-400", bg: "bg-orange-500/15", label: "No Show" },
};

function StatCard({ label, value, icon: Icon, color, delay = 0 }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="bg-card border border-border/30 rounded-xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4 hover:border-border/60 transition-all">
      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xl sm:text-2xl font-bold text-foreground">{value}</p>
        <p className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">{label}</p>
      </div>
    </motion.div>
  );
}

export default function Bookings() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [embedModal, setEmbedModal] = useState<BookingEvent | null>(null);
  const [activeTab, setActiveTab] = useState<"events" | "upcoming" | "calendar">("events");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [calendarView, setCalendarView] = useState<"week" | "month">("week");
  const [calendarDate, setCalendarDate] = useState(new Date());

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["booking-events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("booking_events").select("*")
        .eq("created_by", profile?.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as BookingEvent[];
    },
    enabled: !!profile?.id,
  });

  const { data: allBookingsList = [] } = useQuery({
    queryKey: ["all-bookings-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings")
        .select("*, booking_events(title, brand_color, duration_minutes)")
        .in("event_id", events.map(e => e.id))
        .order("booking_date", { ascending: false })
        .order("start_time", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as (Booking & { booking_events: any })[];
    },
    enabled: events.length > 0,
  });

  // Derived data
  const upcomingBookings = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return allBookingsList
      .filter(b => b.booking_date >= today && b.status !== "cancelled")
      .sort((a, b) => a.booking_date.localeCompare(b.booking_date) || a.start_time.localeCompare(b.start_time));
  }, [allBookingsList]);

  const filteredBookings = useMemo(() => {
    let list = allBookingsList;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(b =>
        b.booker_name.toLowerCase().includes(q) ||
        b.booker_email.toLowerCase().includes(q) ||
        (b.booker_phone && b.booker_phone.includes(q))
      );
    }
    if (statusFilter !== "all") {
      list = list.filter(b => b.status === statusFilter);
    }
    return list;
  }, [allBookingsList, searchQuery, statusFilter]);

  const totalBookings = allBookingsList.length;
  const confirmedCount = allBookingsList.filter(b => b.status === "confirmed").length;
  const thisMonthCount = allBookingsList.filter(b => {
    const d = parseISO(b.booking_date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("booking_events").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["booking-events"] }),
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("booking_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-events"] });
      toast.success("Event deleted");
    },
  });

  const updateBookingStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updateData: any = { status, updated_at: new Date().toISOString() };
      if (status === "cancelled") updateData.cancelled_at = new Date().toISOString();
      const { error } = await supabase.from("bookings").update(updateData).eq("id", id);
      if (error) throw error;
      await supabase.from("booking_activity_log").insert({
        booking_id: id, action: `status_changed_to_${status}`,
        details: `Status changed to ${status} by admin`, actor: "admin",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-bookings-list"] });
      toast.success("Status updated");
    },
  });

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/book/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Booking link copied!");
  };

  const exportCSV = () => {
    const headers = ["Name", "Email", "Phone", "Event", "Date", "Time", "Status", "Timezone", "Created"];
    const rows = filteredBookings.map(b => [
      b.booker_name, b.booker_email, b.booker_phone || "",
      b.booking_events?.title || "", b.booking_date, `${formatTime12(b.start_time)} - ${formatTime12(b.end_time)}`,
      b.status, b.timezone || "", format(new Date(b.created_at), "yyyy-MM-dd HH:mm"),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `bookings-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredBookings.length} bookings`);
  };

  // Calendar helpers
  const getCalendarDays = () => {
    if (calendarView === "week") {
      const start = startOfWeek(calendarDate, { weekStartsOn: 1 });
      const end = endOfWeek(calendarDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfMonth(calendarDate);
      const end = endOfMonth(calendarDate);
      return eachDayOfInterval({ start, end });
    }
  };

  const getBookingsForDay = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return allBookingsList.filter(b => b.booking_date === dateStr && b.status !== "cancelled");
  };

  const calDays = getCalendarDays();
  const tabs = [
    { id: "events" as const, label: "Event Types", count: events.length },
    { id: "upcoming" as const, label: "All Bookings", count: totalBookings },
    { id: "calendar" as const, label: "Calendar", count: null },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0">
            {/* Back Button */}
            <button
              onClick={() => navigate("/")}
              className="p-2 rounded-lg hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mt-0.5 sm:mt-0"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
                <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0" /> Bookings
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:whitespace-nowrap">
  Your scheduling events & booking management
</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 pr-7">
            {/* Breadcrumb */}
            <div className="hidden md:flex items-center gap-1 text-sm text-muted-foreground mr-3">
              <button 
                onClick={() => navigate("/")}
                className="hover:text-foreground transition-colors flex items-center gap-1"
              >
                <Home className="w-3 h-3" />
                Dashboard
              </button>
              <span>•</span>
              <span className="text-foreground">Bookings</span>
            </div>
            
            <button onClick={() => navigate("/bookings/new")}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs sm:text-sm font-medium hover:bg-primary/90 transition-colors flex-shrink-0">
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> New Event
            </button>
          </div>
        </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 pt-2">
        <StatCard label="Total Bookings" value={totalBookings} icon={Calendar} color="bg-primary/15 text-primary" delay={0} />
        <StatCard label="This Month" value={thisMonthCount} icon={TrendingUp} color="bg-emerald-500/15 text-emerald-400" delay={0.05} />
        <StatCard label="Upcoming" value={upcomingBookings.length} icon={Clock} color="bg-blue-500/15 text-blue-400" delay={0.1} />
        <StatCard label="Events" value={events.length} icon={CalendarDays} color="bg-purple-500/15 text-purple-400" delay={0.15} />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 flex-wrap pt-2">
        <div className="flex gap-1 bg-card/50 border border-border/30 rounded-lg p-1 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              {tab.label}
              {tab.count !== null && (
                <span className={`text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id ? "bg-white/20" : "bg-muted/60"
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
        {activeTab === "upcoming" && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search name, email..."
                className="w-full bg-muted/20 border border-border/40 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className=" bg-muted/20 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
              <option value="all"  className="bg-background text-foreground">All Status</option>
              <option value="confirmed"  className="bg-background text-foreground">Confirmed</option>
              <option value="completed"  className="bg-background text-foreground">Completed</option>
              <option value="cancelled"  className="bg-background text-foreground">Cancelled</option>
              <option value="no_show"    className="bg-background text-foreground">No Show</option>
            </select>
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground rounded-lg text-sm transition-colors">
              <Download className="w-4 h-4" /> CSV
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* EVENTS TAB */}
        {activeTab === "events" && (
          <motion.div key="events" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : events.length === 0 ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 relative">
                  <CalendarDays className="w-10 h-10 text-primary/60" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white text-xs">+</div>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No events yet</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                  Create your first booking event and share the link with your clients.
                </p>
                <button onClick={() => navigate("/bookings/new")}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                  <Plus className="w-4 h-4" /> Create First Event
                </button>
              </motion.div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {events.map((event, i) => (
                  <motion.div key={event.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-card border border-border/30 rounded-xl overflow-hidden hover:border-border/60 transition-all group">
                    <div className="h-1" style={{ backgroundColor: event.brand_color }} />
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground truncate">{event.title}</h3>
                          {event.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{event.description}</p>}
                        </div>
                        <button onClick={() => toggleActive.mutate({ id: event.id, is_active: !event.is_active })} className="flex-shrink-0">
                          {event.is_active
                            ? <ToggleRight className="w-6 h-6 text-emerald-400" />
                            : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="flex items-center gap-1 text-xs bg-muted/40 text-muted-foreground px-2 py-1 rounded-full">
                          <Clock className="w-3 h-3" /> {event.duration_minutes}m
                        </span>
                        <span className="text-xs bg-muted/40 text-muted-foreground px-2 py-1 rounded-full">
                          {LOCATION_LABELS[event.location_type]}
                        </span>
                        {event.require_payment && (
                          <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-1 rounded-full">
                            💳 {event.payment_currency} {event.payment_amount}
                          </span>
                        )}
                        {!event.is_active && <span className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-1 rounded-full">Inactive</span>}
                      </div>
                      <div className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-2">
                        <Link2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs text-muted-foreground truncate flex-1">/book/{event.slug}</span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => copyLink(event.slug)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-medium transition-colors">
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </button>
                        <button onClick={() => navigate(`/bookings/${event.id}/edit`)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 text-foreground rounded-lg text-xs font-medium transition-colors">
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button onClick={() => window.open(`/book/${event.slug}`, "_blank")}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 text-foreground rounded-lg text-xs font-medium transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" /> Preview
                        </button>
                        <button onClick={() => setEmbedModal(event)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 text-foreground rounded-lg text-xs font-medium transition-colors">
                          <Code2 className="w-3.5 h-3.5" /> Embed
                        </button>
                        <button onClick={() => { if (confirm("Delete this event?")) deleteEvent.mutate(event.id); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-medium transition-colors ml-auto">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ALL BOOKINGS TAB */}
        {activeTab === "upcoming" && (
          <motion.div key="upcoming" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {filteredBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="text-5xl mb-3">📅</div>
                <p className="text-muted-foreground text-sm pt-2">
                  {searchQuery || statusFilter !== "all" ? "No bookings match your filters" : "No bookings yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground px-1">{filteredBookings.length} booking{filteredBookings.length !== 1 ? "s" : ""}</p>
                {filteredBookings.map((booking, i) => {
                  const sc = STATUS_CONFIGS[booking.status] || STATUS_CONFIGS.confirmed;
                  return (
                    <motion.div key={booking.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.02, 0.3) }}
                      className="bg-card border border-border/30 rounded-xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4 hover:border-border/60 transition-all cursor-pointer"
                      onClick={() => navigate(`/bookings/detail/${booking.id}`)}>
                      <div className="flex-shrink-0 text-center w-10 sm:w-12">
                        <div className="text-[10px] sm:text-xs text-muted-foreground">{format(parseISO(booking.booking_date), "MMM")}</div>
                        <div className="text-lg sm:text-xl font-bold text-foreground leading-tight">{format(parseISO(booking.booking_date), "d")}</div>
                        <div className="text-[10px] sm:text-xs text-muted-foreground">{format(parseISO(booking.booking_date), "EEE")}</div>
                      </div>
                      <div className="w-2 h-10 rounded-full flex-shrink-0"
                        style={{ backgroundColor: booking.booking_events?.brand_color || "#6366f1" }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">{booking.booker_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{booking.booker_email}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatTime12(booking.start_time)} · {booking.booking_events?.title}
                        </p>
                      </div>
                      <div className="flex-shrink-0 flex flex-col items-end gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.bg} ${sc.color}`}>
                          {sc.label}
                        </span>
                        {booking.status === "confirmed" && (
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            <button onClick={() => updateBookingStatus.mutate({ id: booking.id, status: "completed" })}
                              title="Complete" className="p-1 rounded hover:bg-emerald-500/10 text-emerald-400 transition-colors">
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => updateBookingStatus.mutate({ id: booking.id, status: "no_show" })}
                              title="No Show" className="p-1 rounded hover:bg-orange-500/10 text-orange-400 transition-colors">
                              <AlertCircle className="w-4 h-4" />
                            </button>
                            <button onClick={() => updateBookingStatus.mutate({ id: booking.id, status: "cancelled" })}
                              title="Cancel" className="p-1 rounded hover:bg-red-500/10 text-red-400 transition-colors">
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* CALENDAR TAB */}
        {activeTab === "calendar" && (
          <motion.div key="calendar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Calendar controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button onClick={() => setCalendarDate(calendarView === "week" ? subWeeks(calendarDate, 1) : subMonths(calendarDate, 1))}
                  className="p-1.5 sm:p-2 rounded-lg hover:bg-muted/40 text-muted-foreground transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h3 className="text-xs sm:text-sm font-semibold text-foreground min-w-[140px] sm:min-w-[160px] text-center">
                  {calendarView === "week"
                    ? `${format(startOfWeek(calendarDate, { weekStartsOn: 1 }), "MMM d")} – ${format(endOfWeek(calendarDate, { weekStartsOn: 1 }), "MMM d, yyyy")}`
                    : format(calendarDate, "MMMM yyyy")
                  }
                </h3>
                <button onClick={() => setCalendarDate(calendarView === "week" ? addWeeks(calendarDate, 1) : addMonths(calendarDate, 1))}
                  className="p-1.5 sm:p-2 rounded-lg hover:bg-muted/40 text-muted-foreground transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button onClick={() => setCalendarDate(new Date())}
                  className="px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs bg-muted/30 hover:bg-muted/50 text-muted-foreground rounded-lg transition-colors">
                  Today
                </button>
              </div>
              <div className="flex gap-1 bg-muted/20 rounded-lg p-0.5">
                <button onClick={() => setCalendarView("week")}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${calendarView === "week" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                  Week
                </button>
                <button onClick={() => setCalendarView("month")}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${calendarView === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                  Month
                </button>
              </div>
            </div>

            {/* Week View */}
            {calendarView === "week" && (
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2 overflow-x-auto min-w-0" style={{ minWidth: "min(100%, 600px)" }}>
                {calDays.map(day => {
                  const dayBookings = getBookingsForDay(day);
                  const today = isToday(day);
                  return (
                    <div key={day.toISOString()}
                      className={`bg-card border rounded-lg sm:rounded-xl p-1.5 sm:p-3 min-h-[100px] sm:min-h-[160px] transition-all ${
                        today ? "border-primary/50 ring-1 ring-primary/20" : "border-border/30 hover:border-border/60"
                      }`}>
                      <div className="text-center mb-1.5 sm:mb-2">
                        <p className="text-[9px] sm:text-[11px] text-muted-foreground font-medium">
                          {format(day, "EEE")}
                        </p>
                        <p className={`text-sm sm:text-lg font-bold ${today ? "text-primary" : "text-foreground"}`}>
                          {format(day, "d")}
                        </p>
                      </div>
                      <div className="space-y-1">
                        {dayBookings.slice(0, 4).map(b => (
                          <button key={b.id}
                            onClick={() => navigate(`/bookings/detail/${b.id}`)}
                            className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] truncate hover:opacity-80 transition-opacity"
                            style={{ backgroundColor: `${b.booking_events?.brand_color || "#6366f1"}20`, color: b.booking_events?.brand_color || "#6366f1" }}>
                            <span className="font-medium">{formatTime12(b.start_time)}</span>
                            <br />
                            <span className="opacity-80">{b.booker_name}</span>
                          </button>
                        ))}
                        {dayBookings.length > 4 && (
                          <p className="text-[11px] text-muted-foreground text-center">+{dayBookings.length - 4} more</p>
                        )}
                        {dayBookings.length === 0 && (
                          <p className="text-[11px] text-muted-foreground/40 text-center mt-4">—</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Month View */}
            {calendarView === "month" && (
              <div>
                <div className="grid grid-cols-7 mb-2">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                    <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground/60 py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {/* Leading blanks */}
                  {Array((getDay(startOfMonth(calendarDate)) + 6) % 7).fill(null).map((_, i) => <div key={`b-${i}`} />)}
                  {calDays.map(day => {
                    const dayBookings = getBookingsForDay(day);
                    const today = isToday(day);
                    return (
                      <div key={day.toISOString()}
                        className={`bg-card border rounded-lg p-1 sm:p-1.5 min-h-[52px] sm:min-h-[80px] transition-all ${
                          today ? "border-primary/50" : "border-border/20 hover:border-border/40"
                        }`}>
                        <p className={`text-xs font-medium mb-1 ${today ? "text-primary" : "text-muted-foreground"}`}>
                          {format(day, "d")}
                        </p>
                        <div className="space-y-0.5">
                          {dayBookings.slice(0, 2).map(b => (
                            <button key={b.id}
                              onClick={() => navigate(`/bookings/detail/${b.id}`)}
                              className="w-full text-left px-1 py-0.5 rounded text-[9px] truncate hover:opacity-80"
                              style={{ backgroundColor: `${b.booking_events?.brand_color || "#6366f1"}20`, color: b.booking_events?.brand_color || "#6366f1" }}>
                              {b.booker_name.split(" ")[0]}
                            </button>
                          ))}
                          {dayBookings.length > 2 && (
                            <p className="text-[9px] text-muted-foreground text-center">+{dayBookings.length - 2}</p>
                          )}
                        </div>
                        {dayBookings.length > 0 && (
                          <div className="flex gap-0.5 mt-1 justify-center">
                            {dayBookings.slice(0, 3).map(b => (
                              <div key={b.id} className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: b.booking_events?.brand_color || "#6366f1" }} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Embed Modal */}
      <AnimatePresence>
        {embedModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setEmbedModal(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-border/40 rounded-2xl p-6 w-full max-w-lg space-y-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Code2 className="w-5 h-5 text-primary" /> Embed: {embedModal.title}
              </h3>
              {[
                { label: "Direct Link", code: `${window.location.origin}/book/${embedModal.slug}` },
                { label: "iFrame", code: `<iframe src="${window.location.origin}/book/${embedModal.slug}" width="100%" height="700" frameborder="0" style="border-radius:12px;border:none;"></iframe>` },
                { label: "Link", code: `<a href="${window.location.origin}/book/${embedModal.slug}" target="_blank">Book a call</a>` },
              ].map(({ label, code }) => (
                <div key={label} className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-muted/30 rounded-lg px-3 py-2 text-xs text-foreground font-mono truncate">{code}</code>
                    <button onClick={() => { navigator.clipboard.writeText(code); toast.success("Copied!"); }}
                      className="flex-shrink-0 p-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={() => setEmbedModal(null)}
                className="w-full py-2 bg-muted/40 hover:bg-muted/60 text-muted-foreground rounded-lg text-sm transition-colors">
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </Layout>
  );
}
