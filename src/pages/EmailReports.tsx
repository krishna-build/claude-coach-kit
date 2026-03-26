import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import Layout from "@/components/Layout";
import { motion } from "framer-motion";
import {
  Mail, Eye, MousePointerClick, UserX, TrendingUp,
  BarChart2, Send, RefreshCw, Users, Filter, Megaphone,
  AlertTriangle, CheckCircle, IndianRupee, ShieldX
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────
interface EmailLog {
  id: string;
  contYOUR_AD_ACCOUNT_IDid: string;
  sequence_id: string | null;
  step_id: string | null;
  campaign_id: string | null;
  email_to: string;
  subject: string;
  status: string;
  opened_at: string | null;
  clicked_at: string | null;
  sent_at: string | null;
  track_id: string | null;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  paid_299: boolean;
  status: string;
}

// ─── Helpers ───────────────────────────────────────────────────
function fmt(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true
  });
}

function pct(num: number, den: number) {
  if (den === 0) return "0%";
  return (num / den * 100).toFixed(1) + "%";
}

// ─── Main Page ─────────────────────────────────────────────────
export default function EmailReports() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<"all" | "sequences" | "campaigns">("all");
  const [contactFilter, setContactFilter] = useState<"all" | "opened" | "clicked" | "not_opened" | "bounced">("all");

  // Queries
  const { data: emailLogs = [] } = useQuery<EmailLog[]>({
    queryKey: ["email-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("automation_email_log").select("*").order("sent_at", { ascending: false });
      return data || [];
    },
  });

  const { data: contactsList = [] } = useQuery<Contact[]>({
    queryKey: ["contacts-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("automation_contacts").select("id, first_name, last_name, email, paid_299, status");
      return data || [];
    },
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("automation_campaigns").select("id, name").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: sequences = [] } = useQuery({
    queryKey: ["sequences-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("automation_sequences").select("id, name").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: steps = [] } = useQuery({
    queryKey: ["steps-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("automation_sequence_steps").select("id, sequence_id, step_order, email_subject").order("step_order");
      return data || [];
    },
  });

  const contacts = useMemo(() => new Map(contactsList.map(c => [c.id, c])), [contactsList]);
  const campaignMap = useMemo(() => new Map(campaigns.map((c: any) => [c.id, c.name])), [campaigns]);
  const sequenceMap = useMemo(() => new Map(sequences.map((s: any) => [s.id, s.name])), [sequences]);
  const stepMap = useMemo(() => new Map(steps.map((s: any) => [s.id, s])), [steps]);

  // Filter logs by view
  const filteredLogs = useMemo(() => {
    if (view === "sequences") return emailLogs.filter(l => l.sequence_id && !l.campaign_id);
    if (view === "campaigns") return emailLogs.filter(l => l.campaign_id);
    return emailLogs;
  }, [emailLogs, view]);

  // Stats
  const totalSent = filteredLogs.length;
  const totalBounced = filteredLogs.filter(l => l.status === "bounced").length;
  const totalComplained = filteredLogs.filter(l => l.status === "complained").length;
  const totalDelivered = totalSent - totalBounced;
  const totalOpened = filteredLogs.filter(l => l.opened_at || l.status === "opened" || l.status === "clicked").length;
  const totalClicked = filteredLogs.filter(l => l.clicked_at || l.status === "clicked").length;
  const totalUnsubscribed = filteredLogs.filter(l => { const c = contacts.get(l.contYOUR_AD_ACCOUNT_IDid); return c && (c as any).status === "unsubscribed"; }).length;
  // REAL conversions only: must have clicked an email AND paid
  const convertedContactIds = new Set(
    filteredLogs
      .filter(l => l.clicked_at && contacts.get(l.contYOUR_AD_ACCOUNT_IDid)?.paid_299)
      .map(l => l.contYOUR_AD_ACCOUNT_IDid)
  );
  const totalConverted = convertedContactIds.size;
  // Revenue: count ₹299 for each truly converted contact
  const totalRevenue = totalConverted * 299;

  // Contact filter
  const displayLogs = useMemo(() => {
    let logs = filteredLogs;
    if (contactFilter === "opened") logs = logs.filter(l => l.opened_at || l.status === "opened" || l.status === "clicked");
    if (contactFilter === "clicked") logs = logs.filter(l => l.clicked_at || l.status === "clicked");
    if (contactFilter === "not_opened") logs = logs.filter(l => !l.opened_at && l.status !== "opened" && l.status !== "clicked" && l.status !== "bounced");
    if (contactFilter === "bounced") logs = logs.filter(l => l.status === "bounced");
    return logs;
  }, [filteredLogs, contactFilter]);

  const openedCount = filteredLogs.filter(l => l.opened_at || l.status === "opened" || l.status === "clicked").length;
  const clickedCount = filteredLogs.filter(l => l.clicked_at || l.status === "clicked").length;
  const notOpenedCount = filteredLogs.filter(l => !l.opened_at && l.status !== "opened" && l.status !== "clicked" && l.status !== "bounced").length;
  const bouncedCount = filteredLogs.filter(l => l.status === "bounced").length;

  const getSource = (log: EmailLog) => {
    if (log.campaign_id) return campaignMap.get(log.campaign_id) || "Campaign";
    if (log.sequence_id) {
      const step = log.step_id ? stepMap.get(log.step_id) : null;
      const seqName = sequenceMap.get(log.sequence_id) || "Sequence";
      return step ? `${seqName} → Email ${step.step_order}` : seqName;
    }
    return "Unknown";
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-primary" />
              Email Reports
            </h1>
            <p className="text-sm text-muted-foreground">Opens, clicks, and conversions across all emails</p>
          </div>
          <button
            onClick={async () => {
              setRefreshing(true);
              try {
                await qc.refetchQueries({ queryKey: ["email-logs"], type: "active" });
                await qc.refetchQueries({ queryKey: ["contacts-lookup"], type: "active" });
                await qc.refetchQueries({ queryKey: ["campaigns-lookup"], type: "active" });
                await qc.refetchQueries({ queryKey: ["sequences-lookup"], type: "active" });
                await qc.refetchQueries({ queryKey: ["steps-lookup"], type: "active" });
              } catch (e) {
                console.error("Refresh error:", e);
              }
              setRefreshing(false);
            }}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-card border border-border/50 text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/30 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* View Toggle: All | Sequences | Campaigns */}
        <div className="flex gap-2 overflow-x-auto whitespace-nowrap mt-2">
          {([
            { key: "all" as const, label: "All Emails", icon: Mail },
            { key: "sequences" as const, label: "Sequences", icon: Filter },
            { key: "campaigns" as const, label: "Campaigns", icon: Megaphone },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => { setView(tab.key); setContactFilter("all"); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${view === tab.key
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "bg-card text-muted-foreground border-border/50 hover:text-foreground"
                }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overall Stats - Row 1: Core Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          {[
            { icon: Send, label: "Sent", value: totalSent, color: "text-foreground", bg: "bg-muted/30" },
            { icon: CheckCircle, label: "Delivered", value: totalDelivered, sub: pct(totalDelivered, totalSent), color: "text-emerald-400", bg: "bg-emerald-500/10" },
            { icon: Eye, label: "Opened", value: totalOpened, sub: pct(totalOpened, totalDelivered), color: "text-blue-400", bg: "bg-blue-500/10" },
            { icon: MousePointerClick, label: "Clicked", value: totalClicked, sub: pct(totalClicked, totalDelivered), color: "text-primary", bg: "bg-primary/10" },
          ].map(card => (
            <div key={card.label} className="bg-card rounded-2xl border border-border/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.bg} ${card.color}`}>
                  <card.icon className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground uppercase">{card.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
              {card.sub && <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>}
            </div>
          ))}
        </div>

        {/* Row 2: Conversion + Health Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          {[
            { icon: TrendingUp, label: "Converted", value: totalConverted, sub: pct(totalConverted, totalDelivered), color: "text-emerald-400", bg: "bg-emerald-500/10" },
            { icon: IndianRupee, label: "Revenue", value: `₹${totalRevenue.toLocaleString("en-IN")}`, sub: totalConverted > 0 ? `₹${Math.round(totalRevenue / totalConverted)} per conversion` : "", color: "text-primary", bg: "bg-primary/10" },
            { icon: AlertTriangle, label: "Bounced", value: totalBounced, sub: pct(totalBounced, totalSent), color: totalBounced > 0 ? "text-red-400" : "text-muted-foreground", bg: totalBounced > 0 ? "bg-red-500/10" : "bg-muted/30" },
            { icon: UserX, label: "Unsubscribed", value: totalUnsubscribed + totalComplained, sub: pct(totalUnsubscribed + totalComplained, totalSent), color: totalUnsubscribed + totalComplained > 0 ? "text-orange-400" : "text-muted-foreground", bg: totalUnsubscribed + totalComplained > 0 ? "bg-orange-500/10" : "bg-muted/30" },
          ].map(card => (
            <div
              key={card.label}
              className="bg-card rounded-2xl border border-border/50 p-4 overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${card.bg} ${card.color}`}>
                  <card.icon className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground uppercase flex-1 leading-tight">
                  {card.label}
                </span>
              </div>

              <p className="text-2xl font-bold text-foreground">
                {card.value}
              </p>

              {card.sub && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {card.sub}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Contact Activity Section */}
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden mt-2">
          {/* Section header + filter tabs */}
          <div className="p-4 border-b border-border/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Recipient Activity</h2>
                <span className="text-xs text-muted-foreground">({displayLogs.length})</span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {([
                { key: "all" as const, label: `All (${totalSent})` },
                { key: "opened" as const, label: `Opened (${openedCount})` },
                { key: "clicked" as const, label: `Clicked (${clickedCount})` },
                { key: "not_opened" as const, label: `Not Opened (${notOpenedCount})` },
                { key: "bounced" as const, label: `Bounced (${bouncedCount})` },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setContactFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${contactFilter === tab.key
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "bg-surface text-muted-foreground border-border/50 hover:text-foreground"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contact list - immediately visible, no accordion */}
          <div className="max-h-[500px] overflow-y-auto divide-y divide-border/20">
            {displayLogs.length === 0 ? (
              <div className="py-12 text-center">
                <Mail className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No recipients in this filter</p>
              </div>
            ) : (
              displayLogs.slice(0, 100).map((log) => {
                const contact = contacts.get(log.contYOUR_AD_ACCOUNT_IDid);
                const name = contact ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || log.email_to?.split("@")[0] : log.email_to?.split("@")[0] || "Unknown";
                const isOpened = !!(log.opened_at || log.status === "opened" || log.status === "clicked");
                const isClicked = !!(log.clicked_at || log.status === "clicked");
                // Only show PAID badge if they clicked this email AND paid (real conversion)
                const converted = isClicked && contact?.paid_299;

                return (
                  <div key={log.id} className="flex items-center gap-3 py-3 px-4 hover:bg-surface/50 transition-colors">
                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isClicked ? "bg-blue-500/15 text-blue-400" :
                        isOpened ? "bg-emerald-500/15 text-emerald-400" :
                          "bg-muted/30 text-muted-foreground"
                      }`}>
                      {name[0]?.toUpperCase() || "?"}
                    </div>

                    {/* Name + email + source */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{name}</p>
                        {converted && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 flex-shrink-0">PAID</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{log.email_to}</p>
                      <p className="text-[10px] text-muted-foreground/60 truncate">{getSource(log)}</p>
                    </div>

                    {/* Status + timestamps */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {isClicked ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/20">Clicked</span>
                      ) : isOpened ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Opened</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted/30 text-muted-foreground border border-border/50">Not opened</span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {log.opened_at ? fmt(log.opened_at) : log.sent_at ? `Sent ${fmt(log.sent_at)}` : ""}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            {displayLogs.length > 100 && (
              <p className="text-xs text-muted-foreground text-center py-3">Showing 100 of {displayLogs.length} — filter to see more</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
