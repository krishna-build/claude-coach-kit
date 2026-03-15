import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft, Clock, CalendarDays, Mail, Phone, Globe, User,
  CheckCircle2, XCircle, AlertCircle, Save, MessageSquare,
  FileText, RefreshCw, Loader2, ExternalLink, Copy
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Booking, BookingEvent, BookingActivityLog, formatTime12, addMinutes } from "@/types/bookings";
import { format } from "date-fns";
import { useToast } from "@/components/Toast";

export default function BookingDetail() {
  const { toast } = useToast();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [adminNotes, setAdminNotes] = useState("");
  const [notesLoaded, setNotesLoaded] = useState(false);

  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, booking_events(*)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      if (!notesLoaded) {
        setAdminNotes(data.admin_notes || "");
        setNotesLoaded(true);
      }
      return data as Booking & { booking_events: BookingEvent };
    },
    enabled: !!id,
  });

  const { data: activityLog = [] } = useQuery({
    queryKey: ["booking-activity", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("booking_activity_log")
        .select("*")
        .eq("booking_id", id!)
        .order("created_at", { ascending: false });
      return (data || []) as BookingActivityLog[];
    },
    enabled: !!id,
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const updateData: any = { status, updated_at: new Date().toISOString() };
      if (status === "cancelled") {
        updateData.cancelled_at = new Date().toISOString();
      }
      const { error } = await supabase.from("bookings").update(updateData).eq("id", id!);
      if (error) throw error;
      await supabase.from("booking_activity_log").insert({
        booking_id: id!,
        action: `status_changed_to_${status}`,
        details: `Status changed to ${status} by admin`,
        actor: "admin",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["booking-activity", id] });
      toast.success("Status updated");
    },
  });

  const saveNotes = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("bookings").update({ admin_notes: adminNotes, updated_at: new Date().toISOString() }).eq("id", id!);
      if (error) throw error;
      await supabase.from("booking_activity_log").insert({
        booking_id: id!,
        action: "notes_updated",
        details: "Admin notes updated",
        actor: "admin",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-activity", id] });
      toast.success("Notes saved");
    },
  });

  const event = booking?.booking_events;
  const accentColor = event?.brand_color || "#6366f1";

  const copyManageLink = () => {
    if (booking?.manage_token) {
      const url = `${window.location.origin}/book/manage/${booking.manage_token}`;
      navigator.clipboard.writeText(url);
      toast.success("Manage link copied!");
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "confirmed": return { color: "text-emerald-400", bg: "bg-emerald-500/15", icon: CheckCircle2 };
      case "completed": return { color: "text-blue-400", bg: "bg-blue-500/15", icon: CheckCircle2 };
      case "cancelled": return { color: "text-red-400", bg: "bg-red-500/15", icon: XCircle };
      case "no_show": return { color: "text-orange-400", bg: "bg-orange-500/15", icon: AlertCircle };
      default: return { color: "text-muted-foreground", bg: "bg-muted/40", icon: CalendarDays };
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes("cancelled")) return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    if (action.includes("rescheduled")) return <RefreshCw className="w-3.5 h-3.5 text-orange-400" />;
    if (action.includes("confirmed") || action.includes("completed")) return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    if (action.includes("notes")) return <FileText className="w-3.5 h-3.5 text-blue-400" />;
    return <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Booking not found</p>
      </div>
    );
  }

  const statusConfig = getStatusConfig(booking.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/30 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/bookings")}
          className="p-2 rounded-lg hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-foreground truncate">Booking Detail</h1>
          <p className="text-xs text-muted-foreground">{booking.booker_name} — {event?.title}</p>
        </div>
        <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium ${statusConfig.bg} ${statusConfig.color}`}>
          <StatusIcon className="w-3 h-3" />
          {booking.status === "no_show" ? "No Show" : booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
        </span>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Main Info Card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border/30 rounded-2xl overflow-hidden">
          <div className="h-1.5" style={{ backgroundColor: accentColor }} />
          <div className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-foreground">{event?.title}</h2>
                <p className="text-sm text-muted-foreground">{event?.duration_minutes} minute {event?.location_type}</p>
              </div>
              {booking.manage_token && (
                <button onClick={copyManageLink}
                  className="flex items-center gap-1.5 text-xs bg-muted/40 hover:bg-muted/60 text-muted-foreground px-3 py-1.5 rounded-lg transition-colors">
                  <Copy className="w-3 h-3" /> Manage Link
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2.5 text-sm">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground font-medium">{booking.booker_name}</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <a href={`mailto:${booking.booker_email}`} className="text-primary hover:underline">{booking.booker_email}</a>
                </div>
                {booking.booker_phone && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground">{booking.booker_phone}</span>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2.5 text-sm">
                  <CalendarDays className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">{format(new Date(booking.booking_date + "T00:00"), "EEEE, MMMM d, yyyy")}</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">{formatTime12(booking.start_time)} – {formatTime12(booking.end_time)}</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">{booking.timezone?.replace(/_/g, " ")}</span>
                </div>
              </div>
            </div>

            {booking.rescheduled_from && (
              <div className="flex items-center gap-2 text-xs text-orange-400/80 bg-orange-500/5 px-3 py-2 rounded-lg">
                <RefreshCw className="w-3.5 h-3.5" /> This booking was rescheduled
              </div>
            )}
          </div>
        </motion.div>

        {/* Custom Question Answers */}
        {booking.answers && Object.keys(booking.answers).length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="bg-card border border-border/30 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <MessageSquare className="w-4 h-4" style={{ color: accentColor }} /> Custom Answers
            </h3>
            <div className="space-y-3">
              {event?.custom_questions?.map(q => {
                const answer = booking.answers[q.id];
                if (!answer) return null;
                return (
                  <div key={q.id} className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{q.question}</p>
                    <p className="text-sm text-foreground bg-muted/20 rounded-lg px-3 py-2">{answer}</p>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Status Actions */}
        {booking.status === "confirmed" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-card border border-border/30 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Change Status</h3>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => updateStatus.mutate("completed")}
                disabled={updateStatus.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium transition-colors">
                <CheckCircle2 className="w-4 h-4" /> Mark Complete
              </button>
              <button onClick={() => updateStatus.mutate("no_show")}
                disabled={updateStatus.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-lg text-sm font-medium transition-colors">
                <AlertCircle className="w-4 h-4" /> No Show
              </button>
              <button onClick={() => updateStatus.mutate("cancelled")}
                disabled={updateStatus.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium transition-colors">
                <XCircle className="w-4 h-4" /> Cancel
              </button>
            </div>
          </motion.div>
        )}

        {/* Admin Notes */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-card border border-border/30 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4" style={{ color: accentColor }} /> Admin Notes
          </h3>
          <textarea
            value={adminNotes}
            onChange={e => setAdminNotes(e.target.value)}
            placeholder="Add internal notes about this booking..."
            rows={3}
            className="w-full bg-muted/20 border border-border/40 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors resize-none"
          />
          <button onClick={() => saveNotes.mutate()}
            disabled={saveNotes.isPending}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm font-medium transition-colors">
            {saveNotes.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Notes
          </button>
        </motion.div>

        {/* Activity Log */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-card border border-border/30 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Activity Timeline</h3>
          {activityLog.length === 0 ? (
            <div className="text-center py-6">
              <div className="text-3xl mb-2">📋</div>
              <p className="text-xs text-muted-foreground">No activity recorded yet</p>
            </div>
          ) : (
            <div className="space-y-0 relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border/30" />
              {activityLog.map((log, i) => (
                <div key={log.id} className="flex items-start gap-3 py-2.5 relative">
                  <div className="w-4 h-4 rounded-full bg-card border border-border/40 flex items-center justify-center flex-shrink-0 z-10">
                    {getActionIcon(log.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{log.action.replace(/_/g, " ").replace(/status changed to /i, "→ ")}</p>
                    {log.details && <p className="text-xs text-muted-foreground mt-0.5">{log.details}</p>}
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {format(new Date(log.created_at), "MMM d, yyyy h:mm a")} · {log.actor}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Always show creation as last item */}
          <div className="flex items-start gap-3 py-2.5 border-t border-border/20 mt-2 pt-3">
            <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <CalendarDays className="w-3 h-3 text-primary" />
            </div>
            <div>
              <p className="text-sm text-foreground">Booking created</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                {format(new Date(booking.created_at), "MMM d, yyyy h:mm a")}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
