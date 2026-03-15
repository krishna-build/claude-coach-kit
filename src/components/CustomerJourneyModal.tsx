import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import {
  X,
  MousePointerClick,
  Globe,
  Smartphone,
  Monitor,
  MapPin,
  Calendar,
  CreditCard,
  Mail,
  MailOpen,
  ExternalLink,
  Trophy,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────
interface UtmVisitor {
  visitor_id: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  city: string | null;
  region: string | null;
  device: string | null;
  age_group: string | null;
  created_at: string;
  razorpay_payment_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  amount: number | null;
  payment_status: string | null;
  matched_at: string | null;
}

interface AutomationContact {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  paid_299: boolean | null;
  paid_299_at: string | null;
  purchased_50k: boolean | null;
  purchased_50k_at: string | null;
  higher_ticket_amount: number | null;
  higher_ticket_program: string | null;
  higher_ticket_date: string | null;
  call_booked: boolean | null;
  call_booked_at: string | null;
  tags: string[] | null;
  created_at: string;
}

interface EmailLog {
  id: string;
  sequence_id: string | null;
  step_id: string | null;
  email_to: string | null;
  subject: string | null;
  status: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  sent_at: string | null;
}

interface SequenceEnrollment {
  id: string;
  sequence_id: string | null;
  status: string | null;
  current_step: number | null;
  started_at: string | null;
  completed_at: string | null;
}

interface CustomerJourneyModalProps {
  visitor: UtmVisitor;
  onClose: () => void;
}

// ─── Timeline Step Component ──────────────────────────────────
function TimelineStep({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  date,
  children,
  isLast = false,
  isActive = true,
  index = 0,
}: {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  date?: string | null;
  children: React.ReactNode;
  isLast?: boolean;
  isActive?: boolean;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35 }}
      className="flex gap-3"
    >
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-lg ${iconBg} ${
            !isActive ? "opacity-40" : ""
          }`}
        >
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        {!isLast && (
          <div
            className={`w-0.5 flex-1 my-1 rounded-full ${
              isActive ? "bg-border/60" : "bg-border/20"
            }`}
          />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 pb-5 ${!isActive ? "opacity-50" : ""}`}>
        <div className="flex items-center justify-between gap-2 mb-1">
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
          {date && (
            <span className="text-[11px] text-muted-foreground flex-shrink-0">
              {format(new Date(date), "dd MMM yyyy, h:mm a")}
            </span>
          )}
        </div>
        <div className="space-y-1">{children}</div>
      </div>
    </motion.div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground min-w-[80px]">{label}:</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function CustomerJourneyModal({ visitor, onClose }: CustomerJourneyModalProps) {
  const [contact, setContact] = useState<AutomationContact | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [enrollments, setEnrollments] = useState<SequenceEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllEmails, setShowAllEmails] = useState(false);

  useEffect(() => {
    async function fetchJourney() {
      setLoading(true);
      const email = visitor.customer_email;
      if (!email) {
        setLoading(false);
        return;
      }

      // Fetch automation_contacts by email
      const { data: contactData } = await supabase
        .from("automation_contacts")
        .select("*")
        .eq("email", email)
        .limit(1);

      const contactRecord = contactData?.[0] || null;
      setContact(contactRecord);

      // Fetch email logs by email
      const { data: emailData } = await supabase
        .from("automation_email_log")
        .select("*")
        .eq("email_to", email)
        .order("sent_at", { ascending: true });

      setEmailLogs((emailData as EmailLog[]) || []);

      // Fetch sequence enrollments if contact exists
      if (contactRecord?.id) {
        const { data: enrollData } = await supabase
          .from("automation_sequence_enrollments")
          .select("*")
          .eq("contYOUR_AD_ACCOUNT_IDid", contactRecord.id)
          .order("started_at", { ascending: true });

        setEnrollments((enrollData as SequenceEnrollment[]) || []);
      }

      setLoading(false);
    }

    fetchJourney();
  }, [visitor.customer_email]);

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const isMobile =
    (visitor.device || "").toLowerCase().includes("mobile") ||
    (visitor.device || "").toLowerCase().includes("android") ||
    (visitor.device || "").toLowerCase().includes("iphone") ||
    (visitor.device || "").toLowerCase().includes("ios");

  const hasPaid = visitor.payment_status === "captured";
  const hasHighTicket = contact?.purchased_50k || (contact?.higher_ticket_amount && contact.higher_ticket_amount > 0);
  const emailsToShow = showAllEmails ? emailLogs : emailLogs.slice(0, 5);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl max-h-[90vh] bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-border/30 bg-gradient-to-r from-card via-card to-primary/5 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-black font-bold text-base flex-shrink-0">
                  {(visitor.customer_name || "A").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-foreground truncate">
                    {visitor.customer_name || "Anonymous Visitor"}
                  </h2>
                  <p className="text-xs text-muted-foreground truncate">
                    {visitor.customer_email || visitor.visitor_id}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-surface hover:bg-surface-hover flex items-center justify-center transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Quick status badges */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {hasPaid && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[11px] font-bold">
                  <CheckCircle2 className="w-3 h-3" />
                  ₹299 Paid
                </span>
              )}
              {!hasPaid && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/50 border border-border text-muted-foreground text-[11px] font-semibold">
                  <XCircle className="w-3 h-3" />
                  Not Paid
                </span>
              )}
              {hasHighTicket && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 text-[11px] font-bold">
                  <Trophy className="w-3 h-3" />
                  High Ticket ₹{(contact?.higher_ticket_amount || 50000).toLocaleString("en-IN")}
                </span>
              )}
              {contact?.call_booked && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/25 text-blue-400 text-[11px] font-bold">
                  <Calendar className="w-3 h-3" />
                  Call Booked
                </span>
              )}
              {emailLogs.length > 0 && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-400 text-[11px] font-bold">
                  <Mail className="w-3 h-3" />
                  {emailLogs.length} email{emailLogs.length !== 1 ? "s" : ""}
                </span>
              )}
              {contact?.tags && contact.tags.length > 0 && (
                <span className="text-[11px] text-muted-foreground/60 truncate max-w-[200px]">
                  Tags: {(Array.isArray(contact.tags) ? contact.tags : []).join(", ")}
                </span>
              )}
            </div>
          </div>

          {/* Body - scrollable timeline */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">Loading journey...</span>
              </div>
            ) : (
              <div className="space-y-0">
                {/* Step 1: Ad Click */}
                <TimelineStep
                  icon={MousePointerClick}
                  iconColor="text-blue-400"
                  iconBg="bg-blue-500/20"
                  title="Ad Click"
                  date={visitor.created_at}
                  index={0}
                >
                  <InfoRow label="Ad Creative" value={visitor.utm_content || "Direct / Organic"} />
                  <InfoRow label="Ad Set" value={visitor.utm_term} />
                  <InfoRow label="Campaign" value={visitor.utm_campaign} />
                  <InfoRow label="Source" value={visitor.utm_source} />
                  <InfoRow label="Medium" value={visitor.utm_medium} />
                </TimelineStep>

                {/* Step 2: Landing */}
                <TimelineStep
                  icon={Globe}
                  iconColor="text-indigo-400"
                  iconBg="bg-indigo-500/20"
                  title="Visited Landing Page"
                  date={visitor.created_at}
                  index={1}
                >
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs">
                      {isMobile ? (
                        <Smartphone className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                      <span className="text-foreground">{visitor.device || "Unknown device"}</span>
                    </div>
                    {visitor.city && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-foreground">
                          {visitor.city}
                          {visitor.region ? `, ${visitor.region}` : ""}
                        </span>
                      </div>
                    )}
                    {visitor.age_group && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-foreground">Age: {visitor.age_group}</span>
                      </div>
                    )}
                  </div>
                </TimelineStep>

                {/* Step 3: ₹299 Payment */}
                <TimelineStep
                  icon={CreditCard}
                  iconColor={hasPaid ? "text-emerald-400" : "text-muted-foreground"}
                  iconBg={hasPaid ? "bg-emerald-500/20" : "bg-muted/30"}
                  title={hasPaid ? "₹299 Payment Captured" : "₹299 Payment — Not Completed"}
                  date={hasPaid ? (visitor.matched_at || visitor.created_at) : null}
                  isActive={hasPaid}
                  index={2}
                >
                  {hasPaid ? (
                    <>
                      <InfoRow label="Amount" value={`₹${(visitor.amount || 299).toLocaleString("en-IN")}`} />
                      <InfoRow label="Razorpay ID" value={visitor.razorpay_payment_id} />
                      {visitor.matched_at && (
                        <InfoRow
                          label="Time to Pay"
                          value={(() => {
                            const diff = new Date(visitor.matched_at).getTime() - new Date(visitor.created_at).getTime();
                            const mins = Math.floor(diff / 60000);
                            if (mins < 60) return `${mins} minute${mins !== 1 ? "s" : ""}`;
                            const hours = Math.floor(mins / 60);
                            if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""}`;
                            return `${Math.floor(hours / 24)} day${Math.floor(hours / 24) !== 1 ? "s" : ""}`;
                          })()}
                        />
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Visitor did not complete payment
                    </p>
                  )}
                </TimelineStep>

                {/* Step 4: Email Sequences */}
                <TimelineStep
                  icon={Mail}
                  iconColor={emailLogs.length > 0 ? "text-violet-400" : "text-muted-foreground"}
                  iconBg={emailLogs.length > 0 ? "bg-violet-500/20" : "bg-muted/30"}
                  title={
                    emailLogs.length > 0
                      ? `Email Sequence (${emailLogs.length} email${emailLogs.length !== 1 ? "s" : ""})`
                      : "Email Sequence — Not Enrolled"
                  }
                  date={enrollments[0]?.started_at || emailLogs[0]?.sent_at}
                  isActive={emailLogs.length > 0}
                  index={3}
                >
                  {enrollments.length > 0 && (
                    <div className="mb-2">
                      {enrollments.map((e) => (
                        <div key={e.id} className="flex items-center gap-2 text-xs mb-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              e.status === "completed"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : e.status === "active"
                                ? "bg-blue-500/15 text-blue-400"
                                : "bg-muted/50 text-muted-foreground"
                            }`}
                          >
                            {e.status || "unknown"}
                          </span>
                          <span className="text-muted-foreground">
                            Sequence {e.sequence_id?.slice(0, 8)}… · Step {e.current_step || 0}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {emailLogs.length > 0 ? (
                    <div className="space-y-1.5">
                      {emailsToShow.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-start gap-2 px-3 py-2 rounded-lg bg-surface/40 border border-border/20"
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            {log.clicked_at ? (
                              <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                            ) : log.opened_at ? (
                              <MailOpen className="w-3.5 h-3.5 text-blue-400" />
                            ) : (
                              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">
                              {log.subject || "No subject"}
                            </p>
                            <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
                              {log.sent_at && (
                                <span>Sent {format(new Date(log.sent_at), "dd MMM, h:mm a")}</span>
                              )}
                              {log.opened_at && (
                                <span className="text-blue-400">
                                  Opened {format(new Date(log.opened_at), "dd MMM, h:mm a")}
                                </span>
                              )}
                              {log.clicked_at && (
                                <span className="text-emerald-400">
                                  Clicked {format(new Date(log.clicked_at), "dd MMM, h:mm a")}
                                </span>
                              )}
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  log.status === "delivered"
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : log.status === "sent"
                                    ? "bg-blue-500/10 text-blue-400"
                                    : log.status === "bounced" || log.status === "failed"
                                    ? "bg-red-500/10 text-red-400"
                                    : "bg-muted/50 text-muted-foreground"
                                }`}
                              >
                                {log.status || "unknown"}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                      {emailLogs.length > 5 && (
                        <button
                          onClick={() => setShowAllEmails(!showAllEmails)}
                          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-semibold transition-colors pt-1"
                        >
                          {showAllEmails ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" />
                              Show less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              Show all {emailLogs.length} emails
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      No emails sent to this contact
                    </p>
                  )}
                </TimelineStep>

                {/* Step 5: Call Booked */}
                {contact && (
                  <TimelineStep
                    icon={Calendar}
                    iconColor={contact.call_booked ? "text-blue-400" : "text-muted-foreground"}
                    iconBg={contact.call_booked ? "bg-blue-500/20" : "bg-muted/30"}
                    title={contact.call_booked ? "Sales Call Booked" : "Sales Call — Not Booked"}
                    date={contact.call_booked_at}
                    isActive={!!contact.call_booked}
                    index={4}
                  >
                    {contact.call_booked ? (
                      <p className="text-xs text-foreground">Call was scheduled</p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No call booked yet</p>
                    )}
                  </TimelineStep>
                )}

                {/* Step 6: High Ticket Conversion */}
                <TimelineStep
                  icon={Trophy}
                  iconColor={hasHighTicket ? "text-amber-400" : "text-muted-foreground"}
                  iconBg={hasHighTicket ? "bg-amber-500/20" : "bg-muted/30"}
                  title={
                    hasHighTicket
                      ? `High Ticket Conversion — ₹${(contact?.higher_ticket_amount || 50000).toLocaleString("en-IN")}`
                      : "High Ticket — Not Yet"
                  }
                  date={contact?.purchased_50k_at || contact?.higher_ticket_date}
                  isActive={!!hasHighTicket}
                  isLast={true}
                  index={5}
                >
                  {hasHighTicket ? (
                    <>
                      <InfoRow label="Amount" value={`₹${(contact?.higher_ticket_amount || 50000).toLocaleString("en-IN")}`} />
                      <InfoRow label="Program" value={contact?.higher_ticket_program} />
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Has not converted to high-ticket program
                    </p>
                  )}
                </TimelineStep>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
