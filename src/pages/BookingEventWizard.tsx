import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Save, Clock, Phone, Video, MapPin, Plus, Trash2,
  Loader2, Palette, Link2, CalendarDays, CheckCircle2, GripVertical,
  Image, Globe, CreditCard, Webhook, Users, MessageSquare, Mail,
  Shield, AlertTriangle, Ban, Check, ChevronRight
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  BookingEvent, BookingAvailability, BookingBlockedSlot, BookingEmailSettings,
  CustomQuestion, TeamMember, generateSlug, DAY_NAMES
} from "@/types/bookings";
import { useToast } from "@/components/Toast";

// STEP-BY-STEP WIZARD INTERFACE
const WIZARD_STEPS = [
  { id: 'basic', title: 'Event Details', description: 'Name and describe your event', icon: CalendarDays },
  { id: 'schedule', title: 'Duration & Location', description: 'Set meeting length and type', icon: Clock },
  { id: 'availability', title: 'Availability', description: 'When are you available?', icon: CheckCircle2 },
  { id: 'branding', title: 'Branding', description: 'Customize your booking page', icon: Palette },
  { id: 'advanced', title: 'Advanced Settings', description: 'Payments, team, notifications', icon: Shield },
  { id: 'review', title: 'Review & Launch', description: 'Final check and activate', icon: Check }
];

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
  { day_of_week: 6, is_available: false, blocks: [{ start_time: "09:00", end_time: "18:00" }] }
];

type FormState = Omit<BookingEvent, "id" | "created_by" | "created_at" | "updated_at">;

const initialForm: FormState = {
  title: "", slug: "", description: "", duration_minutes: 30,
  location_type: "phone", location_value: "", max_bookings_per_day: 10,
  buffer_minutes: 0, is_active: false, brand_color: "#FFB433",
  logo_url: "", cover_image_url: "", custom_headline: "", thank_you_url: "",
  custom_questions: [], minimum_notice_hours: 24, date_range_days: 60,
  require_payment: false, payment_amount: 0, payment_currency: "INR",
  webhook_url: "", team_members: [], sms_notifications_enabled: false,
  sms_phone_number: "",
};

// HIGH CONTRAST COMPONENTS FOR READABILITY
function StepIndicator({ steps, currentStep, completedSteps }: any) {
  return (
    <div className="w-full bg-card border border-border/20 rounded-xl p-4 mb-6">
      {/* Mobile: horizontal scrollable dots + current step name */}
      <div className="sm:hidden">
        <div className="flex items-center justify-center gap-2 mb-2">
          {steps.map((_: any, index: number) => {
            const isActive = currentStep === index;
            const isCompleted = completedSteps.includes(index);
            return (
              <div key={index} className={`w-2.5 h-2.5 rounded-full transition-all ${
                isCompleted ? 'bg-green-500' :
                isActive ? 'bg-primary w-6 rounded-full' :
                'bg-border'
              }`} />
            );
          })}
        </div>
        <p className="text-center text-sm font-medium text-foreground">{steps[currentStep].title}</p>
        <p className="text-center text-[11px] text-muted-foreground mt-0.5">{steps[currentStep].description}</p>
      </div>

      {/* Desktop: full step indicator */}
      <div className="hidden sm:flex items-center justify-between">
        {steps.map((step: any, index: number) => {
          const isActive = currentStep === index;
          const isCompleted = completedSteps.includes(index);
          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                  isCompleted ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                  isActive ? 'bg-primary text-black' :
                  'bg-card text-muted-foreground/50 border border-border/30'
                }`}>
                  {isCompleted ? <Check className="w-4 h-4" /> : index + 1}
                </div>
                <span className={`text-[11px] mt-1.5 text-center font-medium leading-tight ${
                  isActive ? 'text-foreground' : isCompleted ? 'text-green-400' : 'text-muted-foreground/60'
                }`}>
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-px mx-1 ${
                  isCompleted ? 'bg-green-500/40' : 'bg-border/30'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WizardCard({ children, title, subtitle }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-card border border-border/20 rounded-xl p-5 sm:p-6"
    >
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-foreground mb-1">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </motion.div>
  );
}

function InputField({ label, children, hint, required }: any) {
  return (
    <div className="space-y-1.5 mb-5">
      <label className="block text-sm font-medium text-foreground">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = "text", ...props }: any) {
  return (
    <input 
      type={type} 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      placeholder={placeholder}
      className="w-full bg-card border border-border/20 rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all" 
      {...props} 
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }: any) {
  return (
    <textarea 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      placeholder={placeholder} 
      rows={rows}
      className="w-full bg-muted border border-border rounded-lg px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none" 
    />
  );
}

export default function BookingEventWizard() {
  const { toast } = useToast();
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!eventId;

  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [availability, setAvailability] = useState<AvailabilityBlock[]>(DEFAULT_AVAILABILITY);
  const [emailSettings, setEmailSettings] = useState<any>({
    confirmation_enabled: true,
    admin_notification_enabled: true,
    admin_email: "",
    confirmation_subject: "Your booking is confirmed!",
    confirmation_body: "Hi {{name}}, your booking for {{event_title}} on {{date}} at {{time}} has been confirmed."
  });
  const [saving, setSaving] = useState(false);
  const [slugManual, setSlugManual] = useState(false);

  // Load existing event if editing
  const { data: existingEvent } = useQuery({
    queryKey: ["booking-event", eventId],
    queryFn: async () => {
      const { data } = await supabase.from("booking_events").select("*").eq("id", eventId!).single();
      return data as BookingEvent;
    },
    enabled: isEditing,
  });

  useEffect(() => {
    if (existingEvent) {
      const { id, created_by, created_at, updated_at, ...rest } = existingEvent;
      setForm(rest as any);
      setSlugManual(true);
      if (rest.title) setCompletedSteps([0]);
    }
  }, [existingEvent]);

  const update = (key: keyof FormState, value: any) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === "title" && !slugManual && value) {
        next.slug = generateSlug(value, profile?.full_name?.split(" ")[0]?.toLowerCase() || "");
      }
      return next;
    });
  };

  const validateStep = (step: number) => {
    switch (step) {
      case 0: // Basic Details
        return form.title.trim() && form.slug.trim();
      case 1: // Schedule
        return form.duration_minutes > 0;
      case 2: // Availability
        return availability.some(a => a.is_available);
      case 3: // Branding
        return true; // Optional
      case 4: // Advanced
        return true; // Optional
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      if (!completedSteps.includes(currentStep)) {
        setCompletedSteps(prev => [...prev, currentStep]);
      }
      if (currentStep < WIZARD_STEPS.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    } else {
      toast.error("Please complete all required fields");
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Event title is required");
      return;
    }
    
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

      // Save availability
      await supabase.from("booking_availability").delete().eq("event_id", eventIdResult!);
      const avRows: any[] = [];
      availability.forEach(a => {
        if (a.is_available) {
          a.blocks.forEach(block => {
            avRows.push({
              event_id: eventIdResult,
              day_of_week: a.day_of_week,
              start_time: block.start_time,
              end_time: block.end_time,
              is_available: true,
            });
          });
        } else {
          avRows.push({
            event_id: eventIdResult,
            day_of_week: a.day_of_week,
            start_time: a.blocks[0]?.start_time || "09:00",
            end_time: a.blocks[0]?.end_time || "18:00",
            is_available: false,
          });
        }
      });
      if (avRows.length > 0) {
        await supabase.from("booking_availability").insert(avRows);
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

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Basic Details
        return (
          <WizardCard title="Event Details" subtitle="Let's start with the basics">
            <div className="space-y-4">
              <InputField label="Event Title" required>
                <TextInput 
                  value={form.title} 
                  onChange={(v: string) => update("title", v)} 
                  placeholder="e.g. Discovery Call, Strategy Session" 
                />
              </InputField>
              
              <InputField label="URL Slug" hint="This will be your booking link" required>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">/book/</span>
                  <TextInput 
                    value={form.slug} 
                    onChange={(v: string) => { 
                      setSlugManual(true); 
                      update("slug", v.toLowerCase().replace(/[^a-z0-9-]/g, "-")); 
                    }} 
                    placeholder="your-event-slug" 
                  />
                </div>
              </InputField>
              
              <InputField label="Description" hint="What will you discuss in this call?">
                <TextArea 
                  value={form.description || ""} 
                  onChange={(v: string) => update("description", v)} 
                  placeholder="A brief description of what this call is about..."
                  rows={3}
                />
              </InputField>
            </div>
          </WizardCard>
        );

      case 1: // Duration & Location
        return (
          <WizardCard title="Duration & Location" subtitle="How long and where will you meet?">
            <div className="space-y-6">
              <InputField label="Duration">
                <div className="grid grid-cols-4 gap-2">
                  {[15, 30, 45, 60].map(duration => (
                    <button
                      key={duration}
                      onClick={() => update("duration_minutes", duration)}
                      className={`p-3 rounded-lg border text-center font-medium transition-all ${
                        form.duration_minutes === duration
                          ? 'bg-primary text-black border-primary'
                          : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                      }`}
                    >
                      {duration}m
                    </button>
                  ))}
                </div>
              </InputField>

              <InputField label="Meeting Type">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "phone", label: "Phone Call", icon: Phone },
                    { value: "zoom", label: "Zoom", icon: Video },
                    { value: "meet", label: "Google Meet", icon: Video },
                    { value: "in_person", label: "In Person", icon: MapPin }
                  ].map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => update("location_type", value)}
                      className={`p-4 rounded-lg border flex items-center gap-3 font-medium transition-all ${
                        form.location_type === value
                          ? 'bg-primary text-black border-primary'
                          : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {label}
                    </button>
                  ))}
                </div>
              </InputField>

              {(form.location_type === "zoom" || form.location_type === "meet") && (
                <InputField label="Meeting Link">
                  <TextInput 
                    value={form.location_value || ""} 
                    onChange={(v: string) => update("location_value", v)} 
                    placeholder="https://zoom.us/j/..." 
                  />
                </InputField>
              )}
            </div>
          </WizardCard>
        );

      case 2: // Availability
        return (
          <WizardCard title="Set Your Availability" subtitle="When are you available for bookings?">
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 0].map(day => {
                const avail = availability.find(a => a.day_of_week === day)!;
                return (
                  <div key={day} className="flex items-center gap-3 py-3 border-b border-border/10 last:border-0">
                    {/* Day toggle */}
                    <button
                      onClick={() => setAvailability(prev => 
                        prev.map(a => a.day_of_week === day ? { ...a, is_available: !a.is_available } : a)
                      )}
                      className={`w-14 sm:w-16 py-1.5 rounded-md text-xs font-medium text-center transition-all flex-shrink-0 ${
                        avail.is_available 
                          ? 'bg-primary/15 text-primary border border-primary/20' 
                          : 'bg-card text-muted-foreground/40 border border-border/15'
                      }`}
                    >
                      {DAY_NAMES[day]}
                    </button>
                      
                    {avail.is_available ? (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <input
                          type="time"
                          value={avail.blocks[0]?.start_time || "09:00"}
                          onChange={e => {
                            setAvailability(prev => prev.map(a => {
                              if (a.day_of_week !== day) return a;
                              const blocks = [...a.blocks];
                              blocks[0] = { ...blocks[0], start_time: e.target.value };
                              return { ...a, blocks };
                            }));
                          }}
                          className="flex-1 min-w-0 bg-card border border-border/15 rounded-md px-2.5 py-1.5 text-sm text-foreground focus:border-primary/30 focus:outline-none"
                        />
                        <span className="text-xs text-muted-foreground/40">→</span>
                        <input
                          type="time"
                          value={avail.blocks[0]?.end_time || "18:00"}
                          onChange={e => {
                            setAvailability(prev => prev.map(a => {
                              if (a.day_of_week !== day) return a;
                              const blocks = [...a.blocks];
                              blocks[0] = { ...blocks[0], end_time: e.target.value };
                              return { ...a, blocks };
                            }));
                          }}
                          className="flex-1 min-w-0 bg-card border border-border/15 rounded-md px-2.5 py-1.5 text-sm text-foreground focus:border-primary/30 focus:outline-none"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/30 flex-1">Unavailable</span>
                    )}
                  </div>
                );
              })}
            </div>
          </WizardCard>
        );

      case 3: // Branding
        return (
          <WizardCard title="Customize Your Booking Page" subtitle="Add your personal touch">
            <div className="space-y-4">
              <InputField label="Brand Color">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.brand_color}
                    onChange={e => update("brand_color", e.target.value)}
                    className="w-12 h-12 rounded-lg border border-border cursor-pointer"
                  />
                  <TextInput 
                    value={form.brand_color} 
                    onChange={(v: string) => update("brand_color", v)} 
                    placeholder="#FFB433" 
                  />
                </div>
              </InputField>
              
              <InputField label="Custom Headline">
                <TextInput 
                  value={form.custom_headline || ""} 
                  onChange={(v: string) => update("custom_headline", v)} 
                  placeholder="Book a call with me" 
                />
              </InputField>
              
              <InputField label="Logo URL">
                <TextInput 
                  value={form.logo_url || ""} 
                  onChange={(v: string) => update("logo_url", v)} 
                  placeholder="https://your-website.com/logo.png" 
                />
              </InputField>
            </div>
          </WizardCard>
        );

      case 4: // Advanced Settings
        return (
          <WizardCard title="Advanced Settings" subtitle="Optional features for your booking">
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Payment Settings</h3>
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg border border-border">
                  <div>
                    <p className="text-foreground font-medium">Require Payment</p>
                    <p className="text-muted-foreground text-sm">Charge for bookings before confirmation</p>
                  </div>
                  <button
                    onClick={() => update("require_payment", !form.require_payment)}
                    className={`w-12 h-6 rounded-full transition-all flex items-center ${
                      form.require_payment ? 'bg-primary justify-end' : 'bg-border justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 bg-white rounded-full mx-1 shadow" />
                  </button>
                </div>
                
                {form.require_payment && (
                  <div className="grid grid-cols-2 gap-3">
                    <InputField label="Amount">
                      <TextInput
                        type="number"
                        min={0}
                        step={0.01}
                        value={form.payment_amount}
                        onChange={(v: string) => update("payment_amount", Number(v))}
                        placeholder="500"
                      />
                    </InputField>
                    <InputField label="Currency">
                      <select
                        value={form.payment_currency}
                        onChange={e => update("payment_currency", e.target.value)}
                        className="w-full bg-muted border border-border rounded-lg px-4 py-3 text-foreground focus:border-primary"
                      >
                        <option value="INR">INR ₹</option>
                        <option value="USD">USD $</option>
                        <option value="EUR">EUR €</option>
                      </select>
                    </InputField>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Booking Limits</h3>
                <div className="grid grid-cols-2 gap-3">
                  <InputField label="Max Bookings/Day">
                    <TextInput
                      type="number"
                      min={1}
                      value={form.max_bookings_per_day}
                      onChange={(v: string) => update("max_bookings_per_day", Number(v))}
                    />
                  </InputField>
                  <InputField label="Minimum Notice (hours)">
                    <TextInput
                      type="number"
                      min={0}
                      value={form.minimum_notice_hours}
                      onChange={(v: string) => update("minimum_notice_hours", Number(v))}
                    />
                  </InputField>
                </div>
              </div>
            </div>
          </WizardCard>
        );

      case 5: // Review & Launch
        return (
          <WizardCard title="Review & Launch Your Event" subtitle="Everything looks good? Let's go live!">
            <div className="space-y-6">
              {/* Event Summary */}
              <div className="bg-muted rounded-lg p-4 border border-border">
                <h3 className="text-foreground font-semibold text-lg mb-3">{form.title}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="text-foreground ml-2">{form.duration_minutes} minutes</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <span className="text-foreground ml-2">{form.location_type}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">URL:</span>
                    <span className="text-primary ml-2">/book/{form.slug}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Available Days:</span>
                    <span className="text-foreground ml-2">{availability.filter(a => a.is_available).length}</span>
                  </div>
                </div>
              </div>

              {/* Activation Toggle */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-500/10 to-primary/10 rounded-lg border border-green-500/30">
                <div>
                  <p className="text-foreground font-semibold">Activate Event</p>
                  <p className="text-muted-foreground text-sm">Make this event live and bookable</p>
                </div>
                <button
                  onClick={() => update("is_active", !form.is_active)}
                  className={`w-12 h-6 rounded-full transition-all flex items-center ${
                    form.is_active ? 'bg-green-500 justify-end' : 'bg-border justify-start'
                  }`}
                >
                  <div className="w-4 h-4 bg-white rounded-full mx-1 shadow" />
                </button>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-primary text-black py-4 rounded-lg font-bold text-lg hover:bg-primary-dark transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    {isEditing ? "Update Event" : "Create Event"}
                  </>
                )}
              </button>
            </div>
          </WizardCard>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header with Prominent Back Button */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/20 px-4 sm:px-6 py-3">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate("/bookings")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-card hover:bg-surface-hover border border-border/20 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Events</span>
          </button>
          <div className="flex-1">
            <h1 className="text-base sm:text-lg font-semibold text-foreground">
              {isEditing ? "Edit Event" : "Create New Event"}
            </h1>
            <p className="text-xs text-muted-foreground/60">Step {currentStep + 1} of {WIZARD_STEPS.length}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        {/* Step Indicator */}
        <StepIndicator 
          steps={WIZARD_STEPS} 
          currentStep={currentStep} 
          completedSteps={completedSteps} 
        />

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {renderStepContent()}
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6 gap-3">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
              currentStep === 0 
                ? 'bg-card text-muted-foreground/40 cursor-not-allowed' 
                : 'bg-card text-foreground hover:bg-surface-hover border border-border/20'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            Previous
          </button>

          {currentStep < WIZARD_STEPS.length - 1 ? (
            <button
              onClick={nextStep}
              className="flex items-center gap-2 px-4 sm:px-6 py-2.5 bg-primary text-black rounded-lg text-sm font-medium hover:bg-primary-dark transition-all"
            >
              Next Step
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="text-muted-foreground text-sm">
              Ready to launch? Review and save above ↑
            </div>
          )}
        </div>
      </div>
    </div>
  );
}