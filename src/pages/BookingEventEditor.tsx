import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Save, Clock, Phone, Video, MapPin, Plus, Trash2,
  Loader2, Palette, Link2, CalendarDays, CheckCircle2, GripVertical,
  Image, Globe, CreditCard, Webhook, Users, MessageSquare, Mail,
  Shield, AlertTriangle, Ban
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  BookingEvent, BookingAvailability, BookingBlockedSlot, BookingEmailSettings,
  CustomQuestion, TeamMember, generateSlug, DAY_NAMES
} from "@/types/bookings";
import { useToast } from "@/components/Toast";
import { format } from "date-fns";

interface AvailabilityBlock {
  day_of_week: number;
  is_available: boolean;
  blocks: { start_time: string; end_time: string }[];
}

const DEFAULT_AVAILABILITY: AvailabilityBlock[] = [
  { day_of_week: 1, is_available: true, blocks: [{ start_time: "09:00", end_time: "18:00" }] },
  { day_of_week: 2, is_available: true, blocks: [{ start_time: "09:00", end_time: "18:00" }] },
  { day_of_week: 3, is_available: true, blocks: [{ start_time: "09:00", end_time: "18:00" }] },
  { day_of_week: 4, is_available: true, blocks: [{ start_time: "09:00", end_time: "18:00" }] },
  { day_of_week: 5, is_available: true, blocks: [{ start_time: "09:00", end_time: "18:00" }] },
  { day_of_week: 0, is_available: false, blocks: [{ start_time: "09:00", end_time: "18:00" }] },
  { day_of_week: 6, is_available: false, blocks: [{ start_time: "09:00", end_time: "18:00" }] },
];

type FormState = Omit<BookingEvent, "id" | "created_by" | "created_at" | "updated_at">;

const initialForm: FormState = {
  title: "", slug: "", description: "", duration_minutes: 30,
  location_type: "phone", location_value: "", max_bookings_per_day: 10,
  buffer_minutes: 0, is_active: true, brand_color: "#6366f1",
  logo_url: "", cover_image_url: "", custom_headline: "", thank_you_url: "",
  custom_questions: [], minimum_notice_hours: 24, date_range_days: 60,
  require_payment: false, payment_amount: 0, payment_currency: "INR",
  webhook_url: "", team_members: [], sms_notifications_enabled: false,
  sms_phone_number: "",
};

function SectionHeader({ title, subtitle, icon: Icon }: { title: string; subtitle?: string; icon?: any }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      {Icon && <Icon className="w-4 h-4 text-primary" />}
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground/60">{hint}</p>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = "text", ...props }: any) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full bg-muted/30 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all" {...props} />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }: any) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      className="w-full bg-muted/30 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all resize-none" />
  );
}

export default function BookingEventEditor() {
  const { toast } = useToast();
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!eventId;

  const [form, setForm] = useState<FormState>(initialForm);
  const [availability, setAvailability] = useState<AvailabilityBlock[]>(DEFAULT_AVAILABILITY);
  const [blockedSlots, setBlockedSlots] = useState<Partial<BookingBlockedSlot>[]>([]);
  const [emailSettings, setEmailSettings] = useState<Partial<BookingEmailSettings>>({
    confirmation_enabled: true, admin_notification_enabled: true, admin_email: "",
    confirmation_subject: "Your booking is confirmed!", confirmation_body: "Hi {{name}}, your booking for {{event_title}} on {{date}} at {{time}} has been confirmed.",
    admin_subject: "New Booking: {{event_title}}", admin_body: "New booking from {{name}} ({{email}}) for {{event_title}} on {{date}} at {{time}}.",
  });
  const [saving, setSaving] = useState(false);
  const [slugManual, setSlugManual] = useState(false);
  const [newQuestion, setNewQuestion] = useState<Partial<CustomQuestion> | null>(null);
  const [activeSection, setActiveSection] = useState<string>("basic");
  const [newBlockedDate, setNewBlockedDate] = useState({ date: "", allDay: true, start: "09:00", end: "17:00", reason: "" });
  const [newTeamMember, setNewTeamMember] = useState({ name: "", email: "" });
  const [customDuration, setCustomDuration] = useState("");

  // Load existing event
  const { data: existingEvent } = useQuery({
    queryKey: ["booking-event", eventId],
    queryFn: async () => {
      const { data } = await supabase.from("booking_events").select("*").eq("id", eventId!).single();
      return data as BookingEvent;
    },
    enabled: isEditing,
  });

  const { data: existingAvailability } = useQuery({
    queryKey: ["booking-availability", eventId],
    queryFn: async () => {
      const { data } = await supabase.from("booking_availability").select("*").eq("event_id", eventId!);
      return data as BookingAvailability[];
    },
    enabled: isEditing,
  });

  const { data: existingBlocked } = useQuery({
    queryKey: ["booking-blocked", eventId],
    queryFn: async () => {
      const { data } = await supabase.from("booking_blocked_slots").select("*").eq("event_id", eventId!).order("blocked_date");
      return data as BookingBlockedSlot[];
    },
    enabled: isEditing,
  });

  const { data: existingEmailSettings } = useQuery({
    queryKey: ["booking-email-settings", eventId],
    queryFn: async () => {
      const { data } = await supabase.from("booking_email_settings").select("*").eq("event_id", eventId!).maybeSingle();
      return data as BookingEmailSettings | null;
    },
    enabled: isEditing,
  });

  useEffect(() => {
    if (existingEvent) {
      const { id, created_by, created_at, updated_at, ...rest } = existingEvent;
      setForm(rest as any);
      setSlugManual(true);
    }
  }, [existingEvent]);

  useEffect(() => {
    if (existingAvailability && existingAvailability.length > 0) {
      // Group by day_of_week for multi-block support
      const grouped: Record<number, { start_time: string; end_time: string }[]> = {};
      existingAvailability.forEach(a => {
        if (!grouped[a.day_of_week]) grouped[a.day_of_week] = [];
        if (a.is_available) grouped[a.day_of_week].push({ start_time: a.start_time, end_time: a.end_time });
      });
      const avail = DEFAULT_AVAILABILITY.map(def => {
        const blocks = grouped[def.day_of_week];
        if (blocks && blocks.length > 0) {
          return { ...def, is_available: true, blocks };
        }
        const found = existingAvailability.find(a => a.day_of_week === def.day_of_week);
        return { ...def, is_available: found?.is_available ?? def.is_available };
      });
      setAvailability(avail);
    }
  }, [existingAvailability]);

  useEffect(() => {
    if (existingBlocked) setBlockedSlots(existingBlocked);
  }, [existingBlocked]);

  useEffect(() => {
    if (existingEmailSettings) setEmailSettings(existingEmailSettings);
  }, [existingEmailSettings]);

  const update = (key: keyof FormState, value: any) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === "title" && !slugManual) {
        next.slug = generateSlug(value, profile?.full_name?.split(" ")[0]?.toLowerCase() || "");
      }
      return next;
    });
  };

  const toggleDayAvailable = (day: number) => {
    setAvailability(prev => prev.map(a => a.day_of_week === day ? { ...a, is_available: !a.is_available } : a));
  };

  const updateBlock = (day: number, blockIdx: number, key: string, value: string) => {
    setAvailability(prev => prev.map(a => {
      if (a.day_of_week !== day) return a;
      const blocks = [...a.blocks];
      blocks[blockIdx] = { ...blocks[blockIdx], [key]: value };
      return { ...a, blocks };
    }));
  };

  const addBlock = (day: number) => {
    setAvailability(prev => prev.map(a => {
      if (a.day_of_week !== day) return a;
      return { ...a, blocks: [...a.blocks, { start_time: "14:00", end_time: "18:00" }] };
    }));
  };

  const removeBlock = (day: number, blockIdx: number) => {
    setAvailability(prev => prev.map(a => {
      if (a.day_of_week !== day || a.blocks.length <= 1) return a;
      return { ...a, blocks: a.blocks.filter((_, i) => i !== blockIdx) };
    }));
  };

  const addQuestion = () => {
    if (!newQuestion?.question?.trim()) return;
    const q: CustomQuestion = {
      id: crypto.randomUUID(), question: newQuestion.question,
      type: (newQuestion.type as any) || "text", required: newQuestion.required || false,
      options: newQuestion.options,
    };
    update("custom_questions", [...form.custom_questions, q]);
    setNewQuestion(null);
  };

  const addBlockedSlot = () => {
    if (!newBlockedDate.date) { toast.error("Select a date"); return; }
    setBlockedSlots(prev => [...prev, {
      blocked_date: newBlockedDate.date,
      block_all_day: newBlockedDate.allDay,
      start_time: newBlockedDate.allDay ? undefined : newBlockedDate.start,
      end_time: newBlockedDate.allDay ? undefined : newBlockedDate.end,
      reason: newBlockedDate.reason || undefined,
    }]);
    setNewBlockedDate({ date: "", allDay: true, start: "09:00", end: "17:00", reason: "" });
  };

  const addTeamMember = () => {
    if (!newTeamMember.name.trim() || !newTeamMember.email.trim()) return;
    const member: TeamMember = { id: crypto.randomUUID(), name: newTeamMember.name, email: newTeamMember.email };
    update("team_members", [...(form.team_members || []), member]);
    setNewTeamMember({ name: "", email: "" });
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Event title is required"); return; }
    if (!form.slug.trim()) { toast.error("Slug is required"); return; }
    setSaving(true);
    try {
      let eventIdResult = eventId;
      if (isEditing) {
        const { error } = await supabase.from("booking_events")
          .update({ ...form, updated_at: new Date().toISOString() })
          .eq("id", eventId!);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("booking_events")
          .insert({ ...form, created_by: profile?.id })
          .select("id").single();
        if (error) throw error;
        eventIdResult = data.id;
      }

      // Save availability (multiple blocks per day)
      await supabase.from("booking_availability").delete().eq("event_id", eventIdResult!);
      const avRows: any[] = [];
      availability.forEach(a => {
        if (a.is_available) {
          a.blocks.forEach(block => {
            avRows.push({
              event_id: eventIdResult, day_of_week: a.day_of_week,
              start_time: block.start_time, end_time: block.end_time, is_available: true,
            });
          });
        } else {
          avRows.push({
            event_id: eventIdResult, day_of_week: a.day_of_week,
            start_time: a.blocks[0]?.start_time || "09:00", end_time: a.blocks[0]?.end_time || "18:00",
            is_available: false,
          });
        }
      });
      if (avRows.length > 0) await supabase.from("booking_availability").insert(avRows);

      // Save blocked slots
      await supabase.from("booking_blocked_slots").delete().eq("event_id", eventIdResult!);
      if (blockedSlots.length > 0) {
        await supabase.from("booking_blocked_slots").insert(
          blockedSlots.map(b => ({ ...b, event_id: eventIdResult }))
        );
      }

      // Save email settings
      const emailData = { ...emailSettings, event_id: eventIdResult, updated_at: new Date().toISOString() };
      if (existingEmailSettings?.id) {
        await supabase.from("booking_email_settings").update(emailData).eq("id", existingEmailSettings.id);
      } else {
        await supabase.from("booking_email_settings").insert(emailData);
      }

      queryClient.invalidateQueries({ queryKey: ["booking-events"] });
      toast.success(isEditing ? "Event updated!" : "Event created!");
      navigate("/bookings");
    } catch (err: any) {
      toast.error("Failed to save: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const durations = [15, 30, 45, 60];
  const locationTypes = [
    { value: "phone", label: "Phone", icon: Phone },
    { value: "zoom", label: "Zoom", icon: Video },
    { value: "meet", label: "Meet", icon: Video },
    { value: "in_person", label: "In-Person", icon: MapPin },
  ];

  const sections = [
    { id: "basic", label: "Details" }, { id: "schedule", label: "Schedule" },
    { id: "availability", label: "Availability" }, { id: "blocked", label: "Blocked" },
    { id: "branding", label: "Branding" }, { id: "questions", label: "Questions" },
    { id: "notifications", label: "Notify" }, { id: "advanced", label: "Advanced" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/bookings")} className="p-2 rounded-lg hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-foreground">{isEditing ? "Edit Event" : "New Booking Event"}</h1>
            {form.slug && <p className="text-xs text-muted-foreground">/book/{form.slug}</p>}
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving…" : "Save Event"}
        </button>
      </div>

      {/* Section tabs */}
      <div className="sticky top-[57px] z-10 bg-background/95 backdrop-blur border-b border-border/20 px-4 overflow-x-auto">
        <div className="flex gap-1 py-2">
          {sections.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeSection === s.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Basic Info */}
        {activeSection === "basic" && (
          <motion.section key="basic" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border/30 rounded-2xl p-5 space-y-4">
            <SectionHeader title="Event Details" subtitle="What are people booking with you?" icon={CalendarDays} />
            <Field label="Event Title *">
              <TextInput value={form.title} onChange={(v: string) => update("title", v)} placeholder="e.g. Discovery Call" />
            </Field>
            <Field label="Booking URL Slug *" hint={`${window.location.origin}/book/${form.slug || "your-slug"}`}>
              <div className="flex gap-2 items-center">
                <span className="text-xs text-muted-foreground/60 flex-shrink-0">/book/</span>
                <TextInput value={form.slug} onChange={(v: string) => { setSlugManual(true); update("slug", v.toLowerCase().replace(/[^a-z0-9-]/g, "-")); }} placeholder="your-event-slug" />
              </div>
            </Field>
            <Field label="Description">
              <TextArea value={form.description || ""} onChange={(v: string) => update("description", v)} placeholder="What will you discuss?" rows={2} />
            </Field>
            <div className="flex items-center gap-3 pt-2">
              <label className="text-xs font-medium text-muted-foreground">Active</label>
              <button onClick={() => update("is_active", !form.is_active)}
                className={`w-10 h-6 rounded-full transition-all flex items-center ${form.is_active ? "bg-primary justify-end" : "bg-muted/40 justify-start"}`}>
                <div className="w-4 h-4 bg-white rounded-full mx-1 shadow" />
              </button>
            </div>
          </motion.section>
        )}

        {/* Duration & Location */}
        {activeSection === "schedule" && (
          <motion.section key="schedule" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-6">
            <div className="bg-card border border-border/30 rounded-2xl p-5 space-y-4">
              <SectionHeader title="Call Details" icon={Clock} />
              <Field label="Duration (minutes)">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    {durations.map(d => (
                      <button key={d} onClick={() => { update("duration_minutes", d); setCustomDuration(""); }}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                          form.duration_minutes === d && !customDuration ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
                        }`}>{d}m</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Custom:</span>
                    <input type="number" min={5} max={480} placeholder="e.g. 90"
                      value={customDuration}
                      onChange={e => {
                        setCustomDuration(e.target.value);
                        if (Number(e.target.value) >= 5) update("duration_minutes", Number(e.target.value));
                      }}
                      className="w-20 bg-muted/30 border border-border/40 rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary/50" />
                    <span className="text-xs text-muted-foreground">min</span>
                    {customDuration && Number(customDuration) >= 5 && (
                      <span className="text-xs text-primary">({form.duration_minutes}m)</span>
                    )}
                  </div>
                </div>
              </Field>
              <Field label="Location / Meeting Type">
                <div className="grid grid-cols-2 gap-2">
                  {locationTypes.map(({ value, label, icon: Icon }) => (
                    <button key={value} onClick={() => update("location_type", value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all ${
                        form.location_type === value ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
                      }`}><Icon className="w-4 h-4" /> {label}</button>
                  ))}
                </div>
              </Field>
              {(form.location_type === "zoom" || form.location_type === "meet") && (
                <Field label="Meeting Link">
                  <TextInput value={form.location_value || ""} onChange={(v: string) => update("location_value", v)} placeholder="https://..." />
                </Field>
              )}
              {form.location_type === "in_person" && (
                <Field label="Address">
                  <TextInput value={form.location_value || ""} onChange={(v: string) => update("location_value", v)} placeholder="Full address" />
                </Field>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Buffer Between Calls">
                  <select value={form.buffer_minutes} onChange={e => update("buffer_minutes", Number(e.target.value))}
                    className="w-full bg-muted/30 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50">
                    <option value={0}>No buffer</option><option value={5}>5 mins</option><option value={10}>10 mins</option>
                    <option value={15}>15 mins</option><option value={30}>30 mins</option>
                  </select>
                </Field>
                <Field label="Max / Day">
                  <input type="number" min={1} max={50} value={form.max_bookings_per_day}
                    onChange={e => update("max_bookings_per_day", Number(e.target.value))}
                    className="w-full bg-muted/30 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Min Notice (hours)" hint="Don't show slots within X hours from now">
                  <input type="number" min={0} max={720} value={form.minimum_notice_hours}
                    onChange={e => update("minimum_notice_hours", Number(e.target.value))}
                    className="w-full bg-muted/30 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50" />
                </Field>
                <Field label="Date Range (days)" hint="How far ahead can people book">
                  <input type="number" min={1} max={365} value={form.date_range_days}
                    onChange={e => update("date_range_days", Number(e.target.value))}
                    className="w-full bg-muted/30 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50" />
                </Field>
              </div>
            </div>
          </motion.section>
        )}

        {/* Availability */}
        {activeSection === "availability" && (
          <motion.section key="avail" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border/30 rounded-2xl p-5 space-y-4">
            <SectionHeader title="Weekly Availability" subtitle="Set days & hours. Add multiple time blocks per day." icon={Clock} />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6, 0].map(day => {
                const avail = availability.find(a => a.day_of_week === day)!;
                return (
                  <div key={day} className={`p-3 rounded-xl border transition-all ${avail.is_available ? "border-border/40 bg-muted/10" : "border-border/20 opacity-50"}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <button onClick={() => toggleDayAvailable(day)}
                        className={`w-14 flex-shrink-0 text-xs font-semibold rounded-lg py-1.5 transition-all ${
                          avail.is_available ? "bg-primary/10 text-primary" : "bg-muted/30 text-muted-foreground"
                        }`}>{DAY_NAMES[day]}</button>
                      {!avail.is_available && <span className="text-xs text-muted-foreground/50">Unavailable</span>}
                      {avail.is_available && (
                        <button onClick={() => addBlock(day)}
                          className="ml-auto text-xs text-primary/70 hover:text-primary flex items-center gap-1 transition-colors">
                          <Plus className="w-3 h-3" /> Add Block
                        </button>
                      )}
                    </div>
                    {avail.is_available && (
                      <div className="space-y-2 ml-[68px]">
                        {avail.blocks.map((block, bi) => (
                          <div key={bi} className="flex items-center gap-2">
                            <input type="time" value={block.start_time} onChange={e => updateBlock(day, bi, "start_time", e.target.value)}
                              className="bg-muted/30 border border-border/40 rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/50 w-24" />
                            <span className="text-muted-foreground/50 text-xs">→</span>
                            <input type="time" value={block.end_time} onChange={e => updateBlock(day, bi, "end_time", e.target.value)}
                              className="bg-muted/30 border border-border/40 rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/50 w-24" />
                            {avail.blocks.length > 1 && (
                              <button onClick={() => removeBlock(day, bi)} className="p-1 text-muted-foreground/50 hover:text-red-400 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* Blocked Dates */}
        {activeSection === "blocked" && (
          <motion.section key="blocked" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border/30 rounded-2xl p-5 space-y-4">
            <SectionHeader title="Blocked Dates" subtitle="Block specific dates or time ranges" icon={Ban} />
            {blockedSlots.length === 0 && (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">📅🚫</div>
                <p className="text-sm text-muted-foreground">No blocked dates yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Block holidays, vacations, or specific time slots</p>
              </div>
            )}
            {blockedSlots.map((slot, i) => (
              <div key={i} className="flex items-center gap-3 bg-muted/20 rounded-xl p-3">
                <Ban className="w-4 h-4 text-red-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground font-medium">{slot.blocked_date}</p>
                  <p className="text-xs text-muted-foreground">
                    {slot.block_all_day ? "All day" : `${slot.start_time} – ${slot.end_time}`}
                    {slot.reason && ` · ${slot.reason}`}
                  </p>
                </div>
                <button onClick={() => setBlockedSlots(prev => prev.filter((_, idx) => idx !== i))}
                  className="p-1 text-muted-foreground/50 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="space-y-3 bg-muted/10 rounded-xl p-4 border border-border/20">
              <p className="text-xs font-medium text-muted-foreground">Add Blocked Date</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Date">
                  <input type="date" value={newBlockedDate.date} onChange={e => setNewBlockedDate(p => ({ ...p, date: e.target.value }))}
                    className="w-full bg-muted/30 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50" />
                </Field>
                <Field label="Reason (optional)">
                  <TextInput value={newBlockedDate.reason} onChange={(v: string) => setNewBlockedDate(p => ({ ...p, reason: v }))} placeholder="Holiday..." />
                </Field>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={newBlockedDate.allDay} onChange={e => setNewBlockedDate(p => ({ ...p, allDay: e.target.checked }))}
                    className="w-4 h-4 accent-primary" /> Block entire day
                </label>
              </div>
              {!newBlockedDate.allDay && (
                <div className="flex items-center gap-2">
                  <input type="time" value={newBlockedDate.start} onChange={e => setNewBlockedDate(p => ({ ...p, start: e.target.value }))}
                    className="bg-muted/30 border border-border/40 rounded-lg px-2 py-1.5 text-xs text-foreground w-24" />
                  <span className="text-xs text-muted-foreground">to</span>
                  <input type="time" value={newBlockedDate.end} onChange={e => setNewBlockedDate(p => ({ ...p, end: e.target.value }))}
                    className="bg-muted/30 border border-border/40 rounded-lg px-2 py-1.5 text-xs text-foreground w-24" />
                </div>
              )}
              <button onClick={addBlockedSlot}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-medium transition-colors">
                <Ban className="w-3.5 h-3.5" /> Block Date
              </button>
            </div>
          </motion.section>
        )}

        {/* Branding */}
        {activeSection === "branding" && (
          <motion.section key="branding" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border/30 rounded-2xl p-5 space-y-4">
            <SectionHeader title="Branding" subtitle="Customize your booking page" icon={Palette} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Brand Color">
                <div className="flex items-center gap-2">
                  <input type="color" value={form.brand_color} onChange={e => update("brand_color", e.target.value)}
                    className="w-10 h-10 rounded-lg border border-border/40 cursor-pointer bg-transparent p-0.5" />
                  <TextInput value={form.brand_color} onChange={(v: string) => update("brand_color", v)} placeholder="#6366f1" />
                </div>
              </Field>
              <Field label="Custom Headline">
                <TextInput value={form.custom_headline || ""} onChange={(v: string) => update("custom_headline", v)} placeholder="Book a call with me" />
              </Field>
            </div>
            <Field label="Logo URL" hint="Direct image URL">
              <TextInput value={form.logo_url || ""} onChange={(v: string) => update("logo_url", v)} placeholder="https://..." />
            </Field>
            <Field label="Cover Image URL" hint="Displayed at the top of your booking page">
              <TextInput value={form.cover_image_url || ""} onChange={(v: string) => update("cover_image_url", v)} placeholder="https://..." />
              {form.cover_image_url && (
                <div className="mt-2 rounded-xl overflow-hidden border border-border/30">
                  <img src={form.cover_image_url} alt="Cover" className="w-full h-32 object-cover" onError={e => (e.target as any).style.display = "none"} />
                </div>
              )}
            </Field>
            <Field label="Thank You Redirect URL" hint="After booking. Leave blank for default.">
              <TextInput value={form.thank_you_url || ""} onChange={(v: string) => update("thank_you_url", v)} placeholder="https://yourwebsite.com/thank-you" />
            </Field>
          </motion.section>
        )}

        {/* Custom Questions */}
        {activeSection === "questions" && (
          <motion.section key="questions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border/30 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <SectionHeader title="Custom Questions" subtitle="Ask leads anything before booking" icon={MessageSquare} />
              <button onClick={() => setNewQuestion({ type: "text", required: false })}
                className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors font-medium">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            {form.custom_questions.length === 0 && !newQuestion && (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">💬❓</div>
                <p className="text-sm text-muted-foreground">No custom questions yet</p>
              </div>
            )}
            {form.custom_questions.map(q => (
              <div key={q.id} className="flex items-start gap-3 bg-muted/20 rounded-xl p-3">
                <GripVertical className="w-4 h-4 text-muted-foreground/40 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{q.question}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-[10px] bg-muted/40 text-muted-foreground px-2 py-0.5 rounded">{q.type}</span>
                    {q.required && <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded">Required</span>}
                  </div>
                </div>
                <button onClick={() => update("custom_questions", form.custom_questions.filter(x => x.id !== q.id))}
                  className="p-1 text-muted-foreground/50 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <AnimatePresence>
              {newQuestion && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="bg-muted/20 rounded-xl p-4 space-y-3 overflow-hidden">
                  <Field label="Question">
                    <TextInput value={newQuestion.question || ""} onChange={(v: string) => setNewQuestion(prev => ({ ...prev!, question: v }))} placeholder="e.g. What is your biggest challenge?" />
                  </Field>
                  <div className="flex gap-3">
                    <Field label="Type">
                      <select value={newQuestion.type || "text"} onChange={e => setNewQuestion(prev => ({ ...prev!, type: e.target.value as any }))}
                        className="bg-muted/30 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
                        <option value="text">Short Text</option><option value="textarea">Long Text</option><option value="select">Dropdown</option>
                      </select>
                    </Field>
                    <Field label="Required">
                      <div className="flex items-center gap-2 h-9 mt-1">
                        <input type="checkbox" checked={newQuestion.required || false}
                          onChange={e => setNewQuestion(prev => ({ ...prev!, required: e.target.checked }))} className="w-4 h-4 accent-primary" />
                      </div>
                    </Field>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addQuestion} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
                      <CheckCircle2 className="w-4 h-4" /> Add
                    </button>
                    <button onClick={() => setNewQuestion(null)} className="px-4 py-2 bg-muted/40 text-muted-foreground rounded-lg text-sm hover:bg-muted/60">Cancel</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        )}

        {/* Email Notifications */}
        {activeSection === "notifications" && (
          <motion.section key="notify" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-6">
            <div className="bg-card border border-border/30 rounded-2xl p-5 space-y-4">
              <SectionHeader title="Email Notifications" subtitle="Customize confirmation & admin emails" icon={Mail} />
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-foreground">Confirmation Email</p><p className="text-xs text-muted-foreground">Sent to booker after booking</p></div>
                <button onClick={() => setEmailSettings(p => ({ ...p, confirmation_enabled: !p.confirmation_enabled }))}
                  className={`w-10 h-6 rounded-full transition-all flex items-center ${emailSettings.confirmation_enabled ? "bg-primary justify-end" : "bg-muted/40 justify-start"}`}>
                  <div className="w-4 h-4 bg-white rounded-full mx-1 shadow" />
                </button>
              </div>
              {emailSettings.confirmation_enabled && (
                <div className="space-y-3 ml-2 pl-4 border-l-2 border-primary/20">
                  <Field label="Subject">
                    <TextInput value={emailSettings.confirmation_subject || ""} onChange={(v: string) => setEmailSettings(p => ({ ...p, confirmation_subject: v }))} />
                  </Field>
                  <Field label="Body" hint="Use {{name}}, {{email}}, {{event_title}}, {{date}}, {{time}}, {{manage_link}}">
                    <TextArea value={emailSettings.confirmation_body || ""} onChange={(v: string) => setEmailSettings(p => ({ ...p, confirmation_body: v }))} rows={3} />
                  </Field>
                </div>
              )}
              <div className="border-t border-border/20 pt-4">
                <div className="flex items-center justify-between">
                  <div><p className="text-sm text-foreground">Admin Notification</p><p className="text-xs text-muted-foreground">Get notified of new bookings</p></div>
                  <button onClick={() => setEmailSettings(p => ({ ...p, admin_notification_enabled: !p.admin_notification_enabled }))}
                    className={`w-10 h-6 rounded-full transition-all flex items-center ${emailSettings.admin_notification_enabled ? "bg-primary justify-end" : "bg-muted/40 justify-start"}`}>
                    <div className="w-4 h-4 bg-white rounded-full mx-1 shadow" />
                  </button>
                </div>
                {emailSettings.admin_notification_enabled && (
                  <div className="space-y-3 ml-2 pl-4 border-l-2 border-primary/20 mt-3">
                    <Field label="Admin Email">
                      <TextInput value={emailSettings.admin_email || ""} onChange={(v: string) => setEmailSettings(p => ({ ...p, admin_email: v }))} placeholder="admin@company.com" />
                    </Field>
                    <Field label="Subject">
                      <TextInput value={emailSettings.admin_subject || ""} onChange={(v: string) => setEmailSettings(p => ({ ...p, admin_subject: v }))} />
                    </Field>
                  </div>
                )}
              </div>
            </div>

            {/* SMS */}
            <div className="bg-card border border-border/30 rounded-2xl p-5 space-y-4">
              <SectionHeader title="SMS Notifications" subtitle="Coming soon — configure SMS alerts" icon={Phone} />
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-foreground">Enable SMS</p><p className="text-xs text-muted-foreground">Send SMS reminders to bookers</p></div>
                <button onClick={() => update("sms_notifications_enabled", !form.sms_notifications_enabled)}
                  className={`w-10 h-6 rounded-full transition-all flex items-center ${form.sms_notifications_enabled ? "bg-primary justify-end" : "bg-muted/40 justify-start"}`}>
                  <div className="w-4 h-4 bg-white rounded-full mx-1 shadow" />
                </button>
              </div>
              {form.sms_notifications_enabled && (
                <Field label="Phone Number for SMS" hint="Include country code">
                  <TextInput value={form.sms_phone_number || ""} onChange={(v: string) => update("sms_phone_number", v)} placeholder="+91 98765 43210" />
                </Field>
              )}
            </div>
          </motion.section>
        )}

        {/* Advanced: Payment, Webhook, Team */}
        {activeSection === "advanced" && (
          <motion.section key="advanced" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-6">
            {/* Payment */}
            <div className="bg-card border border-border/30 rounded-2xl p-5 space-y-4">
              <SectionHeader title="Payment Collection" subtitle="Require payment before booking confirms" icon={CreditCard} />
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-foreground">Require Payment</p></div>
                <button onClick={() => update("require_payment", !form.require_payment)}
                  className={`w-10 h-6 rounded-full transition-all flex items-center ${form.require_payment ? "bg-primary justify-end" : "bg-muted/40 justify-start"}`}>
                  <div className="w-4 h-4 bg-white rounded-full mx-1 shadow" />
                </button>
              </div>
              {form.require_payment && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Amount">
                    <input type="number" min={0} step={0.01} value={form.payment_amount}
                      onChange={e => update("payment_amount", Number(e.target.value))}
                      className="w-full bg-muted/30 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50" />
                  </Field>
                  <Field label="Currency">
                    <select value={form.payment_currency} onChange={e => update("payment_currency", e.target.value)}
                      className="w-full bg-muted/30 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
                      <option value="INR">INR ₹</option><option value="USD">USD $</option><option value="EUR">EUR €</option><option value="GBP">GBP £</option>
                    </select>
                  </Field>
                </div>
              )}
            </div>

            {/* Webhook */}
            <div className="bg-card border border-border/30 rounded-2xl p-5 space-y-4">
              <SectionHeader title="Webhook" subtitle="POST booking data to your URL on new bookings" icon={Webhook} />
              <Field label="Webhook URL" hint="We'll POST JSON with booking data here">
                <TextInput value={form.webhook_url || ""} onChange={(v: string) => update("webhook_url", v)} placeholder="https://your-api.com/webhooks/booking" />
              </Field>
            </div>

            {/* Team Members */}
            <div className="bg-card border border-border/30 rounded-2xl p-5 space-y-4">
              <SectionHeader title="Team Scheduling" subtitle="Assign team members for round-robin" icon={Users} />
              {(form.team_members || []).length === 0 && (
                <div className="text-center py-6">
                  <div className="text-3xl mb-2">👥</div>
                  <p className="text-xs text-muted-foreground">No team members added</p>
                </div>
              )}
              {(form.team_members || []).map((m, i) => (
                <div key={m.id} className="flex items-center gap-3 bg-muted/20 rounded-xl p-3">
                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  <button onClick={() => update("team_members", (form.team_members || []).filter(x => x.id !== m.id))}
                    className="p-1 text-muted-foreground/50 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <TextInput value={newTeamMember.name} onChange={(v: string) => setNewTeamMember(p => ({ ...p, name: v }))} placeholder="Name" />
                <TextInput value={newTeamMember.email} onChange={(v: string) => setNewTeamMember(p => ({ ...p, email: v }))} placeholder="Email" />
                <button onClick={addTeamMember}
                  className="px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm font-medium flex-shrink-0">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.section>
        )}

        {/* Save */}
        <button onClick={handleSave} disabled={saving}
          className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {saving ? "Saving…" : isEditing ? "Update Event" : "Create Event"}
        </button>
      </div>
    </div>
  );
}
